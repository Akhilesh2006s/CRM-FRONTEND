'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { apiFetchUrl, apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { formatDate } from '@/lib/dateFormat'
import { todayDateString } from '@/lib/todayDate'

export type PayoutsMode = 'list' | 'bank-sheet' | 'credit-status' | 'salary-sheet'

type SalaryMonth = { month: string; label: string; employees: number; total: number; credited: number }

type PayoutEmployee = {
  _id: string
  name: string
  empCode: string
  role: string
  zone: string
  hasBankDetails: boolean
  bankName: string
  ifsc: string
  accountLast4: string
}

type PayoutItem = {
  kind: 'expense' | 'advance' | 'salary'
  id: string
  employee: PayoutEmployee | null
  label: string
  date: string | null
  requestedAmount: number
  kilometres?: number | null
  approvedAmount: number
  approvedAt: string | null
  payout: { status: string; remark: string; updatedAt: string | null; bankSheetAt: string | null }
}

type PayoutGroup = { employee: PayoutEmployee | null; items: PayoutItem[]; total: number }

type PayoutsResponse = {
  items: PayoutItem[]
  groups?: PayoutGroup[]
  summary: { count: number; total: number; byStatus: Record<string, { count: number; amount: number }> }
  settings: { debitAccountNo: string }
}

const CREDITED = 'Amount Credited to Bank'
const NOT_CREDITED = 'Not Credited'
const ALL = 'all'

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** Large, high-contrast checkboxes: selecting employees is the main action on these pages. */
const CHECKBOX_CLASS =
  'size-5 border-2 border-neutral-600 bg-white data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white disabled:border-neutral-300 disabled:bg-neutral-100 disabled:opacity-100'
const groupKey = (g: PayoutGroup) => g.employee?._id || g.items[0]?.id || ''

const COPY: Record<PayoutsMode, { title: string; subtitle: string; defaultStatus: string }> = {
  list: {
    title: 'Approved Expenses & Advances',
    subtitle: 'Every expense and advance approved by the Finance Manager. Filter and download the report.',
    defaultStatus: ALL,
  },
  'bank-sheet': {
    title: 'Generate Bank Sheet',
    subtitle: 'Select employees to pay. The file follows the bank payment format: one row per employee with the total amount.',
    defaultStatus: 'open',
  },
  'credit-status': {
    title: 'Bank Credit Status',
    subtitle:
      'Employees sent in a bank sheet. Tick those whose amount was credited; for the rest, a remark explaining the failure or delay is required.',
    defaultStatus: 'Pending',
  },
  'salary-sheet': {
    title: 'Salary Sheet',
    subtitle:
      'Net salaries from a finalized payroll month. Select employees and generate the salary bank sheet in the bank payment format, then update their credit status under Bank Credit Status (Type: Salary).',
    defaultStatus: 'open',
  },
}

function StatusBadge({ status }: { status: string }) {
  if (status === CREDITED) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{status}</Badge>
  if (status === NOT_CREDITED) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{status}</Badge>
  return <Badge variant="secondary">Pending</Badge>
}

/** Download a POST response (the bank sheet) as a file. */
async function downloadPost(apiPath: string, body: unknown, fallbackName: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
  const response = await fetch(apiFetchUrl(apiPath), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Could not generate the bank sheet' }))
    throw new Error(error.message || 'Could not generate the bank sheet')
  }
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const match = /filename="?([^"]+)"?/i.exec(response.headers.get('Content-Disposition') || '')
  a.download = match?.[1] || fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

function defaultNarration(kind: string, salaryMonthLabel = '') {
  if (kind === 'salary') return `${salaryMonthLabel || new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })} Sal`
  const month = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })
  if (kind === 'advance') return `${month} Advance`
  if (kind === 'expense') return `${month} Expenses`
  return `${month} Exp & Adv`
}

export default function PayoutsWorkspace({ mode }: { mode: PayoutsMode }) {
  const copy = COPY[mode]
  const grouped = mode !== 'list'
  /** Bank sheet pages: pick employees and generate the bank payment file. */
  const isSheet = mode === 'bank-sheet' || mode === 'salary-sheet'
  const [type, setType] = useState(mode === 'salary-sheet' ? 'salary' : ALL)
  const [salaryMonths, setSalaryMonths] = useState<SalaryMonth[]>([])
  const [month, setMonth] = useState('')
  const [status, setStatus] = useState(copy.defaultStatus)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [zone, setZone] = useState(ALL)
  const [q, setQ] = useState('')
  const [zones, setZones] = useState<string[]>([])
  const [data, setData] = useState<PayoutsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [paymentDate, setPaymentDate] = useState(todayDateString())
  const [narration, setNarration] = useState(defaultNarration(ALL))
  const [debitAccountNo, setDebitAccountNo] = useState('')

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (type !== ALL) p.set('type', type)
    if (type === 'salary' && month) p.set('month', month)
    if (status !== ALL) p.set('status', status)
    if (from) p.set('from', from)
    if (to) p.set('to', to)
    if (zone !== ALL) p.set('zone', zone)
    if (q.trim()) p.set('q', q.trim())
    if (grouped) p.set('group', 'employee')
    if (mode === 'credit-status') p.set('inSheet', '1')
    return p.toString()
  }, [type, month, status, from, to, zone, q, grouped, mode])

  const load = useCallback(async () => {
    // The salary sheet waits for its month.
    if (mode === 'salary-sheet' && !month) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiRequest<PayoutsResponse>(`/finance/payouts?${query}`)
      setData(res)
      setSelected(new Set())
      setRemarks({})
      setDebitAccountNo((prev) => prev || res.settings?.debitAccountNo || '')
    } catch (error: any) {
      toast.error(error?.message || 'Could not load approved expenses and advances')
    } finally {
      setLoading(false)
    }
  }, [query, mode, month])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (mode !== 'salary-sheet') return
    apiRequest<SalaryMonth[]>('/finance/salary-months')
      .then((list) => {
        setSalaryMonths(list || [])
        setMonth((prev) => prev || list?.[0]?.month || '')
      })
      .catch(() => setSalaryMonths([]))
  }, [mode])

  useEffect(() => {
    apiRequest<{ zones: string[] }>('/finance/payees')
      .then((res) => setZones(res?.zones || []))
      .catch(() => setZones([]))
  }, [])

  useEffect(() => {
    if (isSheet) setNarration(defaultNarration(type, salaryMonths.find((m) => m.month === month)?.label))
  }, [type, mode, isSheet, month, salaryMonths])

  const groups = data?.groups || []
  const selectableGroups = isSheet ? groups.filter((g) => g.employee?.hasBankDetails) : groups
  const allSelected = selectableGroups.length > 0 && selectableGroups.every((g) => selected.has(groupKey(g)))
  const selectedGroups = groups.filter((g) => selected.has(groupKey(g)))
  const selectedTotal = selectedGroups.reduce((s, g) => s + g.total, 0)

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })

  const downloadReport = async () => {
    setBusy(true)
    try {
      const p = new URLSearchParams(query)
      p.delete('group')
      await downloadReportFile(
        `/finance/payouts/export?${p.toString()}`,
        type === 'salary' ? 'Salary_Payouts.xlsx' : 'Approved_Expenses_Advances.xlsx'
      )
    } catch (error: any) {
      toast.error(error?.message || 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  const generateSheet = async () => {
    if (!selectedGroups.length) return toast.error('Select at least one employee to pay.')
    if (!paymentDate) return toast.error('Pick the payment date.')
    if (!narration.trim()) return toast.error('Enter the narration.')
    if (!/^\d{6,20}$/.test(debitAccountNo.trim())) return toast.error('Enter the company debit account number (6 to 20 digits).')
    setBusy(true)
    try {
      await downloadPost(
        '/finance/bank-sheet',
        {
          items: selectedGroups.flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id }))),
          paymentDate,
          narration: narration.trim(),
          debitAccountNo: debitAccountNo.trim(),
        },
        'Bank payment File.xlsx'
      )
      toast.success(`Bank sheet generated for ${selectedGroups.length} employee(s). Update the credit status once the bank confirms.`)
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Could not generate the bank sheet')
    } finally {
      setBusy(false)
    }
  }

  const saveCreditStatus = async () => {
    if (!groups.length) return
    const missing = groups.filter((g) => !selected.has(groupKey(g)) && !(remarks[groupKey(g)] || '').trim())
    if (missing.length) {
      return toast.error(
        `Enter a remark for employees whose amount was not credited: ${missing.map((g) => g.employee?.name || 'Unknown').join(', ')}`
      )
    }
    const credited = selectedGroups.flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id })))
    const notCredited = groups
      .filter((g) => !selected.has(groupKey(g)))
      .flatMap((g) => g.items.map((i) => ({ kind: i.kind, id: i.id, remark: remarks[groupKey(g)].trim() })))
    setBusy(true)
    try {
      const res = await apiRequest<{ message: string }>('/finance/credit-status', {
        method: 'PUT',
        body: JSON.stringify({ credited, notCredited }),
      })
      toast.success(res?.message || 'Credit status updated')
      await load()
    } catch (error: any) {
      toast.error(error?.message || 'Could not update the credit status')
    } finally {
      setBusy(false)
    }
  }

  const summary = data?.summary

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">{copy.title}</h1>
        <p className="text-sm text-neutral-600">{copy.subtitle}</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 [&>div]:min-w-0">
          {mode === 'salary-sheet' ? (
            <div>
              <Label className="mb-1 block text-xs">Payroll month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="No finalized payroll" /></SelectTrigger>
                <SelectContent>
                  {salaryMonths.map((m) => (
                    <SelectItem key={m.month} value={m.month}>
                      {m.label} · {m.employees} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="mb-1 block text-xs">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Expenses & Advances</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                  <SelectItem value="advance">Advances</SelectItem>
                  {mode !== 'bank-sheet' && <SelectItem value="salary">Salary</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode !== 'credit-status' && (
            <div>
              <Label className="mb-1 block text-xs">Bank status</Label>
              <Select value={status} onValueChange={setStatus}>
                {/* Long labels are cut with … so they don't run into the next field. */}
                <SelectTrigger className="w-full min-w-0 bg-white [&>span]:block [&>span]:min-w-0 [&>span]:truncate" title={status === 'open' ? 'To pay (not yet sent + Not Credited)' : undefined}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mode === 'list' && <SelectItem value={ALL}>All</SelectItem>}
                  <SelectItem value="open">To pay (not yet sent + Not Credited)</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value={NOT_CREDITED}>Not Credited</SelectItem>
                  {mode === 'list' && <SelectItem value={CREDITED}>{CREDITED}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {mode !== 'salary-sheet' && (
            <>
              <div>
                <Label className="mb-1 block text-xs">Approved from</Label>
                <Input type="date" allowPastDates value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Approved to</Label>
                <Input type="date" allowPastDates value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <Label className="mb-1 block text-xs">Zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Employee</Label>
            <Input placeholder="Name or Emp ID" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadReport} disabled={busy || loading || !data?.items.length}>
            <Download className="mr-1 h-4 w-4" /> Download Report
          </Button>
          {summary && (
            <span className="text-sm text-neutral-600">
              {summary.count} item(s) · {money(summary.total)}
            </span>
          )}
        </div>
      </Card>

      {isSheet && (
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs">Payment date *</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Narration (Consultancy column) *</Label>
              <Input value={narration} maxLength={60} onChange={(e) => setNarration(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Company debit account no. *</Label>
              <Input
                inputMode="numeric"
                value={debitAccountNo}
                maxLength={20}
                onChange={(e) => setDebitAccountNo(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={generateSheet} disabled={busy || !selectedGroups.length}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Generate Bank Sheet{selectedGroups.length ? ` (${selectedGroups.length} · ${money(selectedTotal)})` : ''}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-sm text-neutral-500">Loading…</p>
        ) : !data?.items.length ? (
          <p className="p-6 text-sm text-neutral-500">
            {mode === 'credit-status'
              ? 'No employees are waiting for a credit update. Generate a bank sheet first.'
              : mode === 'salary-sheet'
                ? salaryMonths.length
                  ? 'No salaries to pay for this month with these filters.'
                  : 'No finalized payroll yet. HR finalizes the month in Payroll first.'
                : type === 'salary'
                  ? 'No salaries match these filters.'
                  : 'No Finance-approved expenses or advances match these filters.'}
          </p>
        ) : mode === 'list' ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Expense / Advance</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Kilometer</TableHead>
                <TableHead className="text-right">Approved</TableHead>
                <TableHead>Finance Approved Date</TableHead>
                <TableHead>Bank Status</TableHead>
                <TableHead>Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={`${i.kind}:${i.id}`}>
                  <TableCell className="capitalize">{i.kind}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.employee?.name || '-'}</div>
                    <div className="text-xs text-neutral-500">{[i.employee?.empCode, i.employee?.role].filter(Boolean).join(' · ')}</div>
                  </TableCell>
                  <TableCell>{i.employee?.zone || '-'}</TableCell>
                  <TableCell>{i.label}</TableCell>
                  <TableCell>{formatDate(i.date) || '-'}</TableCell>
                  <TableCell className="text-right">{i.kilometres ?? '-'}</TableCell>
                  <TableCell className="text-right font-medium">{money(i.approvedAmount)}</TableCell>
                  <TableCell>{formatDate(i.approvedAt) || '-'}</TableCell>
                  <TableCell><StatusBadge status={i.payout.status} /></TableCell>
                  <TableCell className="max-w-xs text-xs text-neutral-600">{i.payout.remark || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(on) =>
                      setSelected(on ? new Set(selectableGroups.map(groupKey)) : new Set())
                    }
                    aria-label={mode === 'credit-status' ? 'Mark all as credited' : 'Select all'}
                    className={CHECKBOX_CLASS}
                  />
                </TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Expenses / Advances</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>{mode === 'credit-status' ? 'Sent to bank' : 'Bank Status'}</TableHead>
                {mode === 'credit-status' && <TableHead className="min-w-[240px]">Remark (required if not credited)</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const key = groupKey(g)
                const noBank = !g.employee?.hasBankDetails
                const disabled = isSheet && noBank
                const statuses = [...new Set(g.items.map((i) => i.payout.status))]
                const sheetAt = g.items.map((i) => i.payout.bankSheetAt).filter(Boolean).sort().pop() || null
                return (
                  <TableRow key={key} className={disabled ? 'opacity-60' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(key)}
                        disabled={disabled}
                        onCheckedChange={(on) => toggle(key, on === true)}
                        aria-label={`Select ${g.employee?.name || 'employee'}`}
                        className={CHECKBOX_CLASS}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{g.employee?.name || '-'}</div>
                      <div className="text-xs text-neutral-500">
                        {[g.employee?.empCode, g.employee?.role, g.employee?.zone].filter(Boolean).join(' · ')}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {noBank ? (
                        <span className="font-medium text-red-600">No bank details. Add them in the employee profile.</span>
                      ) : (
                        <>
                          <div>{g.employee?.bankName || g.employee?.ifsc}</div>
                          <div className="text-neutral-500">A/c ••••{g.employee?.accountLast4} · {g.employee?.ifsc}</div>
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.items.map((i) => (
                        <div key={`${i.kind}:${i.id}`}>
                          {i.label}{i.kind === 'salary' ? '' : ` · ${formatDate(i.date) || '-'}`} · {money(i.approvedAmount)}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(g.total)}</TableCell>
                    <TableCell>
                      {mode === 'credit-status' ? (
                        formatDate(sheetAt) || '-'
                      ) : (
                        <div className="space-y-1">
                          {statuses.map((s) => <StatusBadge key={s} status={s} />)}
                          {g.items.find((i) => i.payout.remark) && (
                            <div className="text-xs text-red-700">{g.items.find((i) => i.payout.remark)?.payout.remark}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {mode === 'credit-status' && (
                      <TableCell>
                        <Input
                          placeholder={selected.has(key) ? 'Credited' : 'Reason for failure or delay'}
                          disabled={selected.has(key)}
                          value={selected.has(key) ? '' : remarks[key] || ''}
                          onChange={(e) => setRemarks((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {mode === 'credit-status' && groups.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="text-sm text-neutral-600">
            {selectedGroups.length} credited · {groups.length - selectedGroups.length} not credited
          </span>
          <Button onClick={saveCreditStatus} disabled={busy}>
            <CheckCircle2 className="mr-1 h-4 w-4" /> Update Credit Status
          </Button>
        </div>
      )}
    </div>
  )
}
