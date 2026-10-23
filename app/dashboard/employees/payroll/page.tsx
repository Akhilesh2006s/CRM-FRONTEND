'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { apiRequest, apiUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { isSuperAdmin } from '@/lib/permissions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type PayrollRow = {
  employeeId: string
  empCode?: string
  name: string
  designation?: string
  department?: string
  zone?: string
  uanNumber?: string
  esiNumber?: string
  monthlyCtc: number
  daysInMonth: number
  paidDays: number
  presentDays?: number
  approvedLeaveDays?: number
  autoPaidDays?: number
  lopDays?: number
  attendanceTracked?: boolean
  paidDaysEdited?: boolean
  gross: number
  basic: number
  hra: number
  conveyance: number
  earnedGross: number
  pt: number
  ptOverride?: number | null
  tds: number
  employeeEsi: number
  employeePf: number
  advances: number
  totalDeductions: number
  netPay: number
  employerPf: number
  employerEsi: number
  ctcComputed: number
  remarks?: string
}

type PayrollData = {
  month: string
  status: 'draft' | 'finalized'
  finalizedAt?: string
  rows: PayrollRow[]
  missingCtc: { _id: string; name: string; empCode?: string; role?: string }[]
  totals: Record<string, number>
}

type Inputs = { paidDays: string; tds: string; advances: string; ptOverride: string; remarks: string }

const inr = (n: number | undefined) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const previousMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Monthly payroll: salary worked out from each employee's CTC (as in the HR salary sheet). */
export default function PayrollPage() {
  const [month, setMonth] = useState(previousMonth())
  const [data, setData] = useState<PayrollData | null>(null)
  const [inputs, setInputs] = useState<Record<string, Inputs>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [search, setSearch] = useState('')
  const [superAdmin, setSuperAdmin] = useState(false)

  useEffect(() => {
    setSuperAdmin(isSuperAdmin(getCurrentUser() as any))
  }, [])

  const applyData = (next: PayrollData) => {
    setData(next)
    const map: Record<string, Inputs> = {}
    next.rows.forEach((r) => {
      map[r.employeeId] = {
        paidDays: String(r.paidDays ?? r.daysInMonth),
        tds: String(r.tds || 0),
        advances: String(r.advances || 0),
        ptOverride: r.ptOverride === null || r.ptOverride === undefined ? '' : String(r.ptOverride),
        remarks: r.remarks || '',
      }
    })
    setInputs(map)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      applyData(await apiRequest<PayrollData>(`/hr/payroll/${month}`))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payroll')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  const editable = data?.status === 'draft'
  const rowsPayload = () =>
    (data?.rows || []).map((r) => {
      const i = inputs[r.employeeId]
      // Paid days are sent only when HR changed them; otherwise they stay automatic.
      const entered = i?.paidDays === '' || i?.paidDays === undefined ? null : Number(i.paidDays)
      const auto = r.autoPaidDays ?? r.daysInMonth
      return {
        employeeId: r.employeeId,
        paidDays: entered === null || (entered === auto && !r.paidDaysEdited) ? null : entered,
        tds: Number(i?.tds) || 0,
        advances: Number(i?.advances) || 0,
        ptOverride: i?.ptOverride === '' || i?.ptOverride === undefined ? null : Number(i.ptOverride),
        remarks: i?.remarks || '',
      }
    })

  const call = async (label: string, path: string, method: 'PUT' | 'POST', body?: unknown, success?: string) => {
    setBusy(label)
    try {
      applyData(await apiRequest<PayrollData>(path, { method, body: body ? JSON.stringify(body) : undefined }))
      if (success) toast.success(success)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy('')
    }
  }

  const save = () => call('save', `/hr/payroll/${month}`, 'PUT', { rows: rowsPayload() }, 'Payroll recalculated and saved')
  const finalize = () => {
    if (!window.confirm(`Finalize payroll for ${month}? Pay slips will be issued to every employee in this list.`)) return
    call('finalize', `/hr/payroll/${month}/finalize`, 'POST', { rows: rowsPayload() }, 'Payroll finalized and pay slips issued')
  }
  const reopen = () => call('reopen', `/hr/payroll/${month}/reopen`, 'POST', undefined, 'Payroll reopened for changes')

  const exportExcel = async () => {
    setBusy('export')
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const res = await fetch(apiUrl(`/hr/payroll/${month}/export`), { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Salaries-${month}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy('')
    }
  }

  const setInput = (id: string, patch: Partial<Inputs>) => setInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.rows || []).filter((r) =>
      !q || [r.name, r.empCode, r.designation, r.department, r.zone].some((v) => String(v || '').toLowerCase().includes(q)))
  }, [data, search])

  const t = data?.totals || {}
  const numInput = (id: string, key: keyof Inputs, width = 'w-20', placeholder?: string) => (
    <Input
      type="number"
      min={0}
      step={key === 'paidDays' ? 0.5 : 1}
      className={`${width} h-8 bg-white text-right`}
      value={inputs[id]?.[key] ?? ''}
      placeholder={placeholder}
      disabled={!editable}
      onChange={(e) => setInput(id, { [key]: e.target.value } as Partial<Inputs>)}
    />
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Payroll</h1>
          <p className="text-sm text-neutral-600">
            Salary is worked out from each employee&apos;s CTC: Basic 60% of gross, Conveyance ₹900, HRA the rest; PF 12% of basic,
            ESI (gross up to ₹21,000), PT slab; pro-rated by paid days.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-neutral-600 block">Month</label>
            <Input type="month" className="bg-white h-9" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!!busy || loading}>Export Excel</Button>
          {editable && (
            <>
              <Button variant="outline" onClick={save} disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save & recalculate'}</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={finalize} disabled={!!busy || !data?.rows.length}>
                {busy === 'finalize' ? 'Finalizing…' : 'Finalize & issue pay slips'}
              </Button>
            </>
          )}
          {data?.status === 'finalized' && superAdmin && (
            <Button variant="outline" onClick={reopen} disabled={!!busy}>Reopen</Button>
          )}
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ['Employees', String(data.rows.length)],
            ['Gross earned', inr(t.earnedGross)],
            ['Deductions', inr(t.totalDeductions)],
            ['Net pay', inr(t.netPay)],
            ['Total CTC (with employer PF/ESI)', inr(t.ctcComputed)],
          ].map(([label, value]) => (
            <Card key={label} className="p-3">
              <div className="text-xs text-neutral-500">{label}</div>
              <div className="text-lg font-semibold text-neutral-900">{value}</div>
            </Card>
          ))}
        </div>
      )}

      {data?.status === 'finalized' && (
        <p className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          Finalized{data.finalizedAt ? ` on ${new Date(data.finalizedAt).toLocaleDateString('en-IN')}` : ''}. Pay slips were issued; employees see them under Pay Slips.
        </p>
      )}
      {data && data.missingCtc.length > 0 && (
        <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          {data.missingCtc.length} active employee{data.missingCtc.length === 1 ? '' : 's'} have no CTC and are left out:{' '}
          {data.missingCtc.slice(0, 8).map((e) => e.name).join(', ')}{data.missingCtc.length > 8 ? '…' : ''}. Set CTC on the employee
          (Edit Employee) or in <Link href="/dashboard/employees/salary" className="underline">Salary</Link>.
        </p>
      )}

      <Card className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <Input className="bg-white max-w-xs" placeholder="Search name, code, department, zone" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-xs text-neutral-500">
            Paid days are automatic: days in month minus loss-of-pay days (Mon–Sat with no check-in and no approved leave; Sundays paid;
            no check-ins all month = full month). Edit paid days, TDS, advances or PT, then Save &amp; recalculate. Clear a paid-days box to go back to automatic.
          </span>
        </div>
        {loading ? (
          <p className="py-8 text-center text-neutral-500">Loading…</p>
        ) : !shown.length ? (
          <p className="py-8 text-center text-neutral-500">No employees with a CTC for this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-neutral-50 text-left text-neutral-600">
                  {['Emp ID', 'Name', 'Department / Zone', 'Monthly CTC', 'Gross', 'Present / Leave', 'Paid days', 'Earned gross', 'PT', 'TDS', 'ESI', 'PF', 'Advances', 'Deductions', 'Net pay', 'Employer PF / ESI'].map((h) => (
                    <th key={h} className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.employeeId} className="border-b last:border-0 align-top">
                    <td className="px-2 py-1.5 font-mono">{r.empCode || '-'}</td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-neutral-900">{r.name}</div>
                      <div className="text-neutral-500">{r.designation}</div>
                      <div className="text-neutral-400">{r.uanNumber ? `UAN ${r.uanNumber}` : 'No PF'} · {r.esiNumber ? `ESI ${r.esiNumber}` : 'No ESI'}</div>
                    </td>
                    <td className="px-2 py-1.5">{r.department || '-'}<div className="text-neutral-500">{r.zone || ''}</div></td>
                    <td className="px-2 py-1.5 text-right">{inr(r.monthlyCtc)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {inr(r.gross)}
                      <div className="text-neutral-400">B {inr(r.basic)} · H {inr(r.hra)} · C {inr(r.conveyance)}</div>
                    </td>
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      {editable ? `${r.presentDays ?? 0} / ${r.approvedLeaveDays ?? 0}` : '-'}
                      {editable && (
                        <div className="text-neutral-400">
                          {r.attendanceTracked ? `LOP ${r.lopDays ?? 0}` : 'no check-ins'}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {numInput(r.employeeId, 'paidDays', 'w-16')}
                      <div className="text-neutral-400">of {r.daysInMonth}</div>
                      {editable && (r.paidDaysEdited
                        ? <div className="text-amber-700">edited (auto {r.autoPaidDays})</div>
                        : <div className="text-neutral-400">auto</div>)}
                    </td>
                    <td className="px-2 py-1.5 text-right">{inr(r.earnedGross)}</td>
                    <td className="px-2 py-1.5">{numInput(r.employeeId, 'ptOverride', 'w-16', String(r.pt))}</td>
                    <td className="px-2 py-1.5">{numInput(r.employeeId, 'tds')}</td>
                    <td className="px-2 py-1.5 text-right">{inr(r.employeeEsi)}</td>
                    <td className="px-2 py-1.5 text-right">{inr(r.employeePf)}</td>
                    <td className="px-2 py-1.5">{numInput(r.employeeId, 'advances')}</td>
                    <td className="px-2 py-1.5 text-right">{inr(r.totalDeductions)}</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-neutral-900">{inr(r.netPay)}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{inr(r.employerPf)} / {inr(r.employerEsi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
