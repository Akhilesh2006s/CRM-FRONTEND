'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type AttendanceRow = {
  _id: string
  startTime?: string
  endTime?: string
  attendanceReason?: string
  town?: string
}

function when(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MyAttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<AttendanceRow[]>('/attendance/history')
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
        <p className="text-sm text-neutral-600 mt-1">Your check-in and check-out records.</p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <p className="p-4 text-sm">Loading…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && rows.length === 0 && <p className="p-4 text-sm text-neutral-600">No attendance records yet.</p>}
        {!loading && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100">
                <th className="py-2 px-3 text-left">Check in</th>
                <th className="py-2 px-3 text-left">Check out</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3 text-left">Town</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="border-t">
                  <td className="py-2 px-3">{when(row.startTime)}</td>
                  <td className="py-2 px-3">{when(row.endTime)}</td>
                  <td className="py-2 px-3">{row.attendanceReason || '—'}</td>
                  <td className="py-2 px-3">{row.town || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
