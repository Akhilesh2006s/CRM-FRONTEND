'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { TEAM_ATTENDANCE_ROLES } from '@/lib/access'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { toast } from 'sonner'

type AttendanceRow = {
  _id: string
  startTime?: string
  endTime?: string
  attendanceReason?: string
  town?: string
}

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'office', label: 'Office' },
  { value: 'employee', label: 'Field work' },
  { value: 'collection', label: 'Collection' },
  { value: 'service', label: 'Service' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
]

function when(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

/** Shrink a camera photo to a small JPEG data URL (the API stores it as the check-in photo). */
function photoToDataUrl(file: File, maxSide = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read the photo'))
    }
    img.src = url
  })
}

function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new Error('Allow location access to check in')),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  })
}

export default function MyAttendancePage() {
  const { user } = usePermissions()
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [active, setActive] = useState<AttendanceRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ attendanceReason: 'office', town: '', pincode: '', remarks: '' })
  const [photo, setPhoto] = useState('')

  const load = useCallback(async () => {
    try {
      const [history, current] = await Promise.all([
        apiRequest<AttendanceRow[]>('/attendance/history'),
        apiRequest<{ attendance: AttendanceRow | null; isActive: boolean }>('/attendance/current'),
      ])
      setRows(Array.isArray(history) ? history : [])
      setActive(current?.isActive ? current.attendance : null)
      setError('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return setPhoto('')
    try {
      setPhoto(await photoToDataUrl(file))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not read the photo')
    }
  }

  const checkIn = async () => {
    if (!photo) return toast.error('Take a photo to check in')
    if (!form.town.trim() || !/^\d{6}$/.test(form.pincode.trim())) {
      return toast.error('Enter your town and a 6-digit pincode')
    }
    setBusy(true)
    try {
      const position = await currentPosition()
      await apiRequest('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          town: form.town.trim(),
          pincode: form.pincode.trim(),
          remarks: form.remarks.trim() || undefined,
          photo,
          ...position,
        }),
      })
      toast.success('Checked in')
      setPhoto('')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Check-in failed')
    } finally {
      setBusy(false)
    }
  }

  const checkOut = async () => {
    setBusy(true)
    try {
      await apiRequest('/attendance/check-out', { method: 'POST' })
      toast.success('Checked out')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Check-out failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Attendance</h1>
        <p className="text-sm text-neutral-600 mt-1">Check in when you start work and check out when you finish. Your check-in history is below.</p>
        {user && TEAM_ATTENDANCE_ROLES.has(user.role) && (
          <Link href="/dashboard/employees/attendance" className="mt-2 inline-block text-sm font-medium text-sky-700 underline">
            View your team&apos;s attendance →
          </Link>
        )}
      </div>

      {!loading && (
        <Card className="p-5 space-y-4 max-w-2xl">
          {active ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-green-700">Checked in</div>
                <div className="text-sm text-neutral-600">
                  Since {when(active.startTime)}{active.town ? ` · ${active.town}` : ''}
                </div>
              </div>
              <Button onClick={checkOut} disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
                {busy ? 'Checking out…' : 'Check Out'}
              </Button>
            </div>
          ) : (
            <>
              <div className="font-semibold text-neutral-900">Check In</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="reason">Reason *</Label>
                  <select
                    id="reason"
                    className="mt-1 h-10 w-full rounded-md border bg-white px-2 text-sm"
                    value={form.attendanceReason}
                    onChange={(e) => setForm({ ...form, attendanceReason: e.target.value })}
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="photo">Photo *</Label>
                  <Input id="photo" type="file" accept="image/*" capture="user" className="mt-1 bg-white" onChange={onPhoto} />
                </div>
                <div>
                  <Label htmlFor="town">Town *</Label>
                  <Input id="town" className="mt-1 bg-white" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input id="pincode" inputMode="numeric" maxLength={6} className="mt-1 bg-white" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '') })} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input id="remarks" className="mt-1 bg-white" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                </div>
              </div>
              {photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Check-in photo" className="h-24 w-24 rounded border object-cover" />
              )}
              <p className="text-xs text-neutral-500">Your location is recorded when you check in.</p>
              <Button onClick={checkIn} disabled={busy} className="bg-green-600 hover:bg-green-700 text-white">
                {busy ? 'Checking in…' : 'Check In'}
              </Button>
            </>
          )}
        </Card>
      )}

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
                  <td className="py-2 px-3">{REASONS.find((r) => r.value === row.attendanceReason)?.label || row.attendanceReason || '—'}</td>
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
