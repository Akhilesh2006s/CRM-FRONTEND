'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

type ArchiveRow = {
  _id: string
  previousName?: string
  email?: string
  yearlySalary?: number
  monthlyTakeHome?: number
  archivedAt?: string
  note?: string
}

export default function EmployeeHistoryPage() {
  const [rows, setRows] = useState<ArchiveRow[]>([])
  const [loading, setLoading] = useState(true)

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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="py-2 px-3">{row.previousName || '—'}</td>
                  <td className="py-2 px-3">{row.email || '—'}</td>
                  <td className="py-2 px-3">{row.yearlySalary ?? '—'}</td>
                  <td className="py-2 px-3">{row.monthlyTakeHome ?? '—'}</td>
                  <td className="py-2 px-3">{row.archivedAt ? new Date(row.archivedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
