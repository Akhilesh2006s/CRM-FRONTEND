'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { displayRoleName } from '@/lib/roleLabels'

type RosterRow = {
  _id: string
  startTime?: string
  endTime?: string
  attendanceReason?: string
  town?: string
  employeeId?: { name?: string; empCode?: string; role?: string; zone?: string } | string
}

function when(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AttendanceRosterPage() {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<RosterRow[]>('/attendance/roster')
        setRows(Array.isArray(data) ? data : [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Attendance</h1>
        <p className="text-sm text-neutral-600 mt-1">HR sees every employee. A head sees the people under them.</p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No attendance records.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Employee code</th>
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Role</th>
                <th className="py-2 px-3 text-left">Zone</th>
                <th className="py-2 px-3 text-left">Check in</th>
                <th className="py-2 px-3 text-left">Check out</th>
                <th className="py-2 px-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const employee = typeof row.employeeId === 'object' && row.employeeId ? row.employeeId : null
                return (
                  <tr key={row._id} className="border-t">
                    <td className="py-2 px-3">{employee?.empCode || '—'}</td>
                    <td className="py-2 px-3">{employee?.name || '—'}</td>
                    <td className="py-2 px-3">{employee?.role ? displayRoleName(employee.role) : '—'}</td>
                    <td className="py-2 px-3">{employee?.zone || '—'}</td>
                    <td className="py-2 px-3">{when(row.startTime)}</td>
                    <td className="py-2 px-3">{when(row.endTime)}</td>
                    <td className="py-2 px-3">{row.attendanceReason || row.town || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
