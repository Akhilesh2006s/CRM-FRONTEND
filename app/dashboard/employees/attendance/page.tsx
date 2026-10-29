'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { displayRoleName } from '@/lib/roleLabels'
import { formatEmployeeCode } from '@/lib/employeeCode'

type RosterRow = {
  _id: string
  startTime?: string
  endTime?: string
  attendanceReason?: string
  town?: string
  pincode?: string
  latitude?: number
  longitude?: number
  source?: 'login_selfie' | 'manual'
  employeeId?: { name?: string; empCode?: string; role?: string; zone?: string } | string
}

function when(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

/** Today's date in India as yyyy-mm-dd. */
function todayIST() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
}

/** yyyy-mm-dd (India day) to the UTC instants the API filters on. */
function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00+05:30`)
  return { from: start.toISOString(), to: new Date(start.getTime() + 86400000 - 1).toISOString() }
}

export default function AttendanceRosterPage() {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [day, setDay] = useState(todayIST())
  const [selfie, setSelfie] = useState<{ row: RosterRow; photo: string | null; loading: boolean } | null>(null)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const query = day ? `?fromDate=${encodeURIComponent(dayRange(day).from)}&toDate=${day}` : ''
        const data = await apiRequest<RosterRow[]>(`/attendance/roster${query}`)
        const { from, to } = day ? dayRange(day) : { from: '', to: '' }
        const list = Array.isArray(data) ? data : []
        setRows(day ? list.filter((r) => r.startTime && r.startTime >= from && r.startTime <= to) : list)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load attendance')
      } finally {
        setLoading(false)
      }
    })()
  }, [day])

  const viewSelfie = async (row: RosterRow) => {
    setSelfie({ row, photo: null, loading: true })
    try {
      const res = await apiRequest<{ photo: string | null }>(`/attendance/${row._id}/photo`)
      setSelfie({ row, photo: res?.photo || null, loading: false })
    } catch {
      setSelfie({ row, photo: null, loading: false })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Attendance</h1>
        <p className="text-sm text-neutral-600 mt-1">Super Admin, Admin and HR see every employee. A Product Manager sees their trainers, a Zonal Manager their BDEs, and a Coordinator the BDEs, trainers and Zonal Managers in their zones. Your own check-ins are under Attendance.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="day" className="text-sm font-medium text-neutral-700">Date</label>
          <Input id="day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="mt-1 w-44 bg-white" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setDay(todayIST())}>Today</Button>
        <Button variant="outline" size="sm" onClick={() => setDay('')}>All recent</Button>
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
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Check in</th>
                <th className="py-2 px-3 text-left">Check out</th>
                <th className="py-2 px-3 text-left">Location</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3 text-left">Selfie</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const employee = typeof row.employeeId === 'object' && row.employeeId ? row.employeeId : null
                return (
                  <tr key={row._id} className="border-t">
                    <td className="py-2 px-3">{formatEmployeeCode(employee?.empCode)}</td>
                    <td className="py-2 px-3">{employee?.name || '—'}</td>
                    <td className="py-2 px-3">{employee?.role ? displayRoleName(employee.role) : '—'}</td>
                    <td className="py-2 px-3">{employee?.zone || '—'}</td>
                    <td className="py-2 px-3">
                      {row.endTime ? (
                        <span className="text-neutral-600">Checked out</span>
                      ) : (
                        <span className="text-green-700">Checked in</span>
                      )}
                    </td>
                    <td className="py-2 px-3">{when(row.startTime)}</td>
                    <td className="py-2 px-3">{when(row.endTime)}</td>
                    <td className="py-2 px-3">
                      {[row.town, row.pincode].filter(Boolean).join(' - ') || '—'}
                      {typeof row.latitude === 'number' && typeof row.longitude === 'number' && (
                        <a
                          className="ml-2 text-xs text-sky-700 underline"
                          href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Map
                        </a>
                      )}
                    </td>
                    <td className="py-2 px-3">{row.attendanceReason || '—'}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <Button variant="link" size="sm" className="h-auto p-0 text-sky-700" onClick={() => viewSelfie(row)}>
                        View
                      </Button>
                      {row.source === 'login_selfie' && <span className="ml-2 text-xs text-green-700">App selfie</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={!!selfie} onOpenChange={(open) => !open && setSelfie(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selfie && typeof selfie.row.employeeId === 'object' && selfie.row.employeeId?.name ? selfie.row.employeeId.name : 'Check-in selfie'}
            </DialogTitle>
            <DialogDescription>
              {selfie ? `${when(selfie.row.startTime)} · ${[selfie.row.town, selfie.row.pincode].filter(Boolean).join(' - ')}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selfie?.loading ? (
            <p className="text-sm text-neutral-600">Loading…</p>
          ) : selfie?.photo ? (
            <img src={selfie.photo} alt="Check-in selfie" className="w-full rounded border object-contain max-h-[70vh]" />
          ) : (
            <p className="text-sm text-neutral-600">No photo saved for this check-in.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
