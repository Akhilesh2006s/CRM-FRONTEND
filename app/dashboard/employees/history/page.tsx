'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type ArchiveRow = {
  _id: string
  previousName?: string
  email?: string
  yearlySalary?: number
  monthlyTakeHome?: number
  archivedAt?: string
  note?: string
  personal?: Record<string, unknown>
  leaves?: unknown[]
  paySlips?: unknown[]
  [key: string]: unknown
}

function labelFor(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase())
}

function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-neutral-400">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-neutral-400">None</span>
    return <div className="space-y-2">{value.map((item, index) => <div key={index} className="rounded border bg-neutral-50 p-2"><DetailValue value={item} /></div>)}</div>
  }
  if (typeof value === 'object') {
    return (
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {Object.entries(value as Record<string, unknown>)
          .filter(([key]) => !['password', '__v'].includes(key))
          .map(([key, item]) => (
            <div key={key} className="rounded border bg-white p-2">
              <dt className="text-xs font-medium text-neutral-500">{labelFor(key)}</dt>
              <dd className="mt-1 break-words text-sm"><DetailValue value={item} /></dd>
            </div>
          ))}
      </dl>
    )
  }
  return <span>{String(value)}</span>
}

export default function EmployeeHistoryPage() {
  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ArchiveRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const showDetails = async (id: string) => {
    setLoadingDetail(true)
    try {
      setSelected(await apiRequest<ArchiveRow>(`/hr/history/${id}`))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load employee details')
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<ArchiveRow[]>('/hr/history')
        setRows(Array.isArray(data) ? data : [])
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load history')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Employee History</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Archived personal records kept for audit. They are not shown on the employee login.
        </p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {!loading && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No archived employee records.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Previous employee</th>
                <th className="py-2 px-3 text-left">Login</th>
                <th className="py-2 px-3 text-left">Yearly salary</th>
                <th className="py-2 px-3 text-left">Take-home</th>
                <th className="py-2 px-3 text-left">Archived</th>
                <th className="py-2 px-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t hover:bg-neutral-50">
                  <td className="py-2 px-3">{row.previousName || '—'}</td>
                  <td className="py-2 px-3">{row.email || '—'}</td>
                  <td className="py-2 px-3">{row.yearlySalary ?? '—'}</td>
                  <td className="py-2 px-3">{row.monthlyTakeHome ?? '—'}</td>
                  <td className="py-2 px-3">{row.archivedAt ? new Date(row.archivedAt).toLocaleString() : '—'}</td>
                  <td className="py-2 px-3">
                    <Button size="sm" variant="outline" disabled={loadingDetail} onClick={() => void showDetails(row._id)}>
                      View complete details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <Card className="max-h-[90vh] w-full max-w-5xl overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{selected.previousName || 'Employee'} — Complete details</h2>
                <p className="text-sm text-neutral-500">Archived {selected.archivedAt ? new Date(selected.archivedAt).toLocaleString() : '—'}</p>
              </div>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <DetailValue value={selected} />
          </Card>
        </div>
      )}
    </div>
  )
}
