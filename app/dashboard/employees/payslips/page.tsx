'use client'

import { useEffect, useState } from 'react'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type Slip = {
  employeeId: string
  empCode?: string
  pdfUrl?: string
  name: string
  email: string
  role?: string
  month: string
  yearlySalary: number
  monthlyTakeHome: number
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function downloadSlip(employeeId: string, month: string) {
  const file = await apiRequest<{ filename: string; html: string }>(
    `/hr/payslips/${employeeId}/${month}/download`
  )
  const blob = new Blob([file.html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function PaySlipsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [rows, setRows] = useState<Slip[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (value: string) => {
    setLoading(true)
    try {
      const data = await apiRequest<Slip[]>(`/hr/payslips?month=${encodeURIComponent(value)}`)
      setRows(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setRows([])
      toast.error(err instanceof Error ? err.message : 'Failed to load pay slips')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(month)
  }, [month])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pay Slips</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Monthly pay slips are created for employees who have a take-home salary. Super Admin can download every slip.
        </p>
      </div>
      <Card className="p-4 max-w-xs">
        <Label htmlFor="payslip-month">Month</Label>
        <Input id="payslip-month" type="month" className="bg-white mt-1" value={month} onChange={(e) => setMonth(e.target.value)} />
      </Card>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No pay slips for this month.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Employee code</th>
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Yearly</th>
                <th className="py-2 px-3 text-left">Take-home</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employeeId} className="border-t">
                  <td className="py-2 px-3">{row.empCode || '—'}</td>
                  <td className="py-2 px-3">
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-neutral-500">{row.email}</div>
                  </td>
                  <td className="py-2 px-3">{row.yearlySalary}</td>
                  <td className="py-2 px-3">{row.monthlyTakeHome}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end gap-2">
                      <label className="inline-flex">
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            try {
                              const fd = new FormData()
                              fd.append('file', file)
                              fd.append('kind', 'payslip')
                              const token = localStorage.getItem('authToken')
                              const { apiUrl } = await import('@/lib/api')
                              const res = await fetch(apiUrl('/employees/upload'), {
                                method: 'POST',
                                headers: token ? { Authorization: `Bearer ${token}` } : {},
                                body: fd,
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data?.message || 'Upload failed')
                              await apiRequest(`/hr/payslips/${row.employeeId}`, {
                                method: 'POST',
                                body: JSON.stringify({ month: row.month, pdfUrl: data.url }),
                              })
                              toast.success('Pay slip PDF uploaded')
                              void load(month)
                            } catch (err: unknown) {
                              toast.error(err instanceof Error ? err.message : 'Upload failed')
                            }
                          }}
                        />
                        <span className="inline-flex h-8 items-center rounded-md border px-3 text-xs cursor-pointer">Upload PDF</span>
                      </label>
                      {row.pdfUrl ? (
                        <a className="inline-flex h-8 items-center text-xs text-sky-700" href={resolveUploadUrl(row.pdfUrl)} target="_blank" rel="noreferrer">View PDF</a>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => void downloadSlip(row.employeeId, row.month).catch((err) => toast.error(err.message))}>
                          Download
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
