'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

const START_LABELS: Record<string, string> = { home1: 'Home 1', home2: 'Home 2', other: 'Others' }

type Person = { _id: string; name?: string; empCode?: string; role?: string; zone?: string }
type DayRow = {
  employee: Person
  attendanceId: string
  mode: 'office' | 'field'
  officeName?: string
  startLocationType?: string
  startLocationDetails?: string
  modeChangedFrom?: string
  modeChangedAt?: string | null
  startTime: string
  endTime?: string | null
  checkoutMode?: 'office' | 'field' | null
  reviewStatus: 'none' | 'pending' | 'approved' | 'rejected'
  reviewReason?: string
  fieldPermission: boolean
  missedEndDay?: boolean
  missedCheckouts?: number
  town?: string
  distanceKm: number
  tripCount: number
  schoolCount: number
  schoolMinutes: number
  travelMinutes: number
  workingMinutes: number
}
type Trip = {
  _id: string
  sequence?: number
  vehicle?: string
  startedAt: string
  endedAt?: string
  distanceKm: number
  status: string
  startPoint?: { latitude: number; longitude: number } | null
  endPoint?: { latitude: number; longitude: number } | null
}
type Visit = {
  _id: string
  schoolName: string
  entryAt: string
  exitAt?: string
  durationMinutes?: number
  entryLatitude: number
  entryLongitude: number
  exitLatitude?: number
  exitLongitude?: number
  exitDistanceFromEntryM?: number
  status: 'open' | 'closed'
  schoolCode?: string
  activityType?: string
  activity?: { subject?: string; term?: string; level?: string; participants?: number; remarks?: string }
  feedbackFormName?: string
  missedCheckout?: boolean
  missedReason?: string
}
type Attendance = {
  _id: string
  startTime: string
  endTime?: string
  latitude: number
  longitude: number
  checkoutLatitude?: number
  checkoutLongitude?: number
  mode?: string
  officeName?: string
  checkoutMode?: string
  checkoutOfficeName?: string
  reviewStatus?: string
  reviewReason?: string
  reviewRemarks?: string
  missedEndDay?: boolean
  missedReason?: string
}
type Request = { _id: string; reason: string; places?: string; status: string; remarks?: string; decidedBy?: { name?: string } }
type DayDetail = {
  attendances: Attendance[]
  trips: Trip[]
  visits: Visit[]
  requests: Request[]
  summary: { distanceKm: number; schoolMinutes: number; travelMinutes: number; workingMinutes: number }
}

const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
const time = (v?: string | null) =>
  v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
const hours = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes || 0))
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
const mapLink = (lat?: number, lng?: number) =>
  typeof lat === 'number' && typeof lng === 'number' ? `https://www.google.com/maps?q=${lat},${lng}` : ''
const REVIEW: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting for review', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Review approved', cls: 'bg-green-100 text-green-800' },
  rejected: { label: 'Review rejected', cls: 'bg-red-100 text-red-700' },
}

function MapLink({ lat, lng, label = 'Map' }: { lat?: number; lng?: number; label?: string }) {
  const href = mapLink(lat, lng)
  return href ? (
    <a className="text-sky-700 underline" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : null
}

/** Field Tracking: every employee's day — office / field, trips, schools with entry / exit photos and totals. */
export default function FieldTrackingPage() {
  const [day, setDay] = useState(todayIST())
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [detail, setDetail] = useState<DayDetail | null>(null)
  const [photo, setPhoto] = useState<{ title: string; src: string | null; loading: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<{ rows: DayRow[] }>(`/field-day/days?date=${day}`)
      setRows(Array.isArray(data?.rows) ? data.rows : [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load field tracking')
    } finally {
      setLoading(false)
    }
  }, [day])

  useEffect(() => {
    load()
    setOpen(null)
    setDetail(null)
  }, [load])

  const toggle = async (employeeId: string) => {
    if (open === employeeId) {
      setOpen(null)
      setDetail(null)
      return
    }
    setOpen(employeeId)
    setDetail(null)
    try {
      setDetail(await apiRequest<DayDetail>(`/field-day/days/${employeeId}?date=${day}`))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load the day')
    }
  }

  const showPhoto = async (title: string, path: string) => {
    setPhoto({ title, src: null, loading: true })
    try {
      const res = await apiRequest<{ photo: string | null }>(path)
      setPhoto({ title, src: res?.photo || null, loading: false })
    } catch {
      setPhoto({ title, src: null, loading: false })
    }
  }

  const q = search.trim().toLowerCase()
  const shown = rows.filter(
    (r) => !q || [r.employee?.name, r.employee?.empCode, r.employee?.role, r.employee?.zone].some((v) => String(v || '').toLowerCase().includes(q))
  )
  const totals = shown.reduce(
    (t, r) => ({ km: t.km + (r.distanceKm || 0), schools: t.schools + (r.schoolCount || 0), pending: t.pending + (r.reviewStatus === 'pending' ? 1 : 0) }),
    { km: 0, schools: 0, pending: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Field Tracking</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Office or field check-in, trips with distance, schools with entry and exit photos, and working hours for each employee.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/tracking/approvals"><Button variant="outline" size="sm">Approvals</Button></Link>
          <Link href="/dashboard/tracking/approvers"><Button variant="outline" size="sm">Approvers</Button></Link>
          <Link href="/dashboard/settings/offices"><Button variant="outline" size="sm">Office locations</Button></Link>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="day">Day</Label>
          <Input id="day" type="date" allowPastDates max={todayIST()} className="mt-1 bg-white" value={day} onChange={(e) => setDay(e.target.value || todayIST())} />
        </div>
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="search">Employee</Label>
          <Input id="search" placeholder="Name, Emp ID, role or zone" className="mt-1 bg-white" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="text-sm text-neutral-700">
          {shown.length} checked in · {totals.km.toFixed(2)} km · {totals.schools} schools
          {totals.pending ? <span className="text-amber-700"> · {totals.pending} waiting for review</span> : null}
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="p-4 text-sm text-neutral-600">Nobody checked in on this day.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 text-left">
                <th className="py-2 px-3">Employee</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">In</th>
                <th className="py-2 px-3">Out</th>
                <th className="py-2 px-3 text-right">Trips</th>
                <th className="py-2 px-3 text-right">Distance</th>
                <th className="py-2 px-3 text-right">Schools</th>
                <th className="py-2 px-3 text-right">At schools</th>
                <th className="py-2 px-3 text-right">Working</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const id = r.employee?._id
                const isOpen = open === id
                return (
                  <Fragment key={r.attendanceId}>
                    <tr className={`border-t cursor-pointer hover:bg-neutral-50 ${isOpen ? 'bg-sky-50' : ''}`} onClick={() => id && toggle(id)}>
                      <td className="py-2 px-3">
                        <div className="font-medium">{r.employee?.name || '—'}</div>
                        <div className="text-xs text-neutral-500">
                          {[r.employee?.empCode, r.employee?.role, r.employee?.zone].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {r.mode === 'office' ? `Office${r.officeName ? `: ${r.officeName}` : ''}` : 'Field'}
                        {r.modeChangedFrom === 'office' ? (
                          <div className="text-xs text-sky-700">Changed from Office at {time(r.modeChangedAt || undefined)} (approved)</div>
                        ) : r.fieldPermission ? (
                          <div className="text-xs text-sky-700">Field visit approved</div>
                        ) : null}
                        {START_LABELS[r.startLocationType || ''] ? (
                          <div className="text-xs text-neutral-500">
                            From {START_LABELS[r.startLocationType || '']}
                            {r.startLocationDetails ? `: ${r.startLocationDetails}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 px-3">{time(r.startTime)}</td>
                      <td className="py-2 px-3">
                        {r.endTime ? time(r.endTime) : <span className="text-green-700">Working</span>}
                        {r.missedEndDay ? <div className="text-xs text-amber-700">End Day missed</div> : null}
                        {r.missedCheckouts ? <div className="text-xs text-amber-700">{r.missedCheckouts} school check-out missed</div> : null}
                        {r.checkoutMode ? <div className="text-xs text-neutral-500">{r.checkoutMode === 'office' ? 'at office' : 'in field'}</div> : null}
                      </td>
                      <td className="py-2 px-3 text-right">{r.tripCount}</td>
                      <td className="py-2 px-3 text-right">{(r.distanceKm || 0).toFixed(2)} km</td>
                      <td className="py-2 px-3 text-right">{r.schoolCount}</td>
                      <td className="py-2 px-3 text-right">{hours(r.schoolMinutes)}</td>
                      <td className="py-2 px-3 text-right">{hours(r.workingMinutes)}</td>
                      <td className="py-2 px-3">
                        {REVIEW[r.reviewStatus] ? (
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${REVIEW[r.reviewStatus].cls}`} title={r.reviewReason}>
                            {REVIEW[r.reviewStatus].label}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">OK</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-t bg-neutral-50/60">
                        <td colSpan={10} className="p-4">
                          {!detail ? (
                            <p className="text-sm text-neutral-500">Loading the day…</p>
                          ) : (
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div className="space-y-2">
                                <h3 className="font-semibold">Attendance</h3>
                                {detail.attendances.map((a) => (
                                  <div key={a._id} className="rounded border bg-white p-3 text-sm space-y-1">
                                    <div>
                                      In {time(a.startTime)} ({a.mode === 'office' ? `office${a.officeName ? `: ${a.officeName}` : ''}` : 'field'}) ·{' '}
                                      <MapLink lat={a.latitude} lng={a.longitude} /> ·{' '}
                                      <button className="text-sky-700 underline" onClick={() => showPhoto('Check-in photo', `/attendance/${a._id}/photo`)}>
                                        Photo
                                      </button>
                                    </div>
                                    <div>
                                      Out {time(a.endTime)}
                                      {a.checkoutMode ? ` (${a.checkoutMode === 'office' ? `office${a.checkoutOfficeName ? `: ${a.checkoutOfficeName}` : ''}` : 'field'})` : ''}
                                      {a.endTime ? (
                                        <>
                                          {' · '}
                                          <MapLink lat={a.checkoutLatitude} lng={a.checkoutLongitude} />
                                          {' · '}
                                          <button className="text-sky-700 underline" onClick={() => showPhoto('Exit photo', `/attendance/${a._id}/photo?which=checkout`)}>
                                            Photo
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                    {a.missedEndDay ? (
                                      <div className="text-amber-700">End Day missed. Reason: {a.missedReason}</div>
                                    ) : null}
                                    {a.reviewStatus && a.reviewStatus !== 'none' ? (
                                      <div className="text-amber-700">
                                        {REVIEW[a.reviewStatus]?.label}: {a.reviewReason}
                                        {a.reviewRemarks ? ` — ${a.reviewRemarks}` : ''}
                                      </div>
                                    ) : null}
                                  </div>
                                ))}
                                {detail.requests.map((q) => (
                                  <div key={q._id} className="rounded border bg-white p-3 text-sm">
                                    Field visit request ({q.status}): {q.reason}
                                    {q.places ? ` · ${q.places}` : ''}
                                    {q.decidedBy?.name ? ` · by ${q.decidedBy.name}` : ''}
                                    {q.remarks ? ` — ${q.remarks}` : ''}
                                  </div>
                                ))}
                                <div className="text-sm text-neutral-700">
                                  Total {detail.summary.distanceKm.toFixed(2)} km · travelling {hours(detail.summary.travelMinutes)} · at schools{' '}
                                  {hours(detail.summary.schoolMinutes)} · working {hours(detail.summary.workingMinutes)}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h3 className="font-semibold">Trips and schools</h3>
                                {detail.trips.length === 0 && detail.visits.length === 0 && (
                                  <p className="text-sm text-neutral-500">No trips or school visits.</p>
                                )}
                                {[
                                  ...detail.trips.map((t) => ({ at: t.startedAt, trip: t, visit: null as Visit | null })),
                                  ...detail.visits.map((v) => ({ at: v.entryAt, trip: null as Trip | null, visit: v })),
                                ]
                                  .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                                  .map(({ trip, visit }) =>
                                    trip ? (
                                      <div key={trip._id} className="rounded border bg-white p-3 text-sm">
                                        🛵 Trip {trip.sequence || ''} ({trip.vehicle}) · {time(trip.startedAt)} – {trip.endedAt ? time(trip.endedAt) : 'running'} ·{' '}
                                        {(trip.distanceKm || 0).toFixed(2)} km ·{' '}
                                        <MapLink lat={trip.startPoint?.latitude} lng={trip.startPoint?.longitude} label="Start" />{' '}
                                        <MapLink lat={trip.endPoint?.latitude} lng={trip.endPoint?.longitude} label="End" />
                                      </div>
                                    ) : visit ? (
                                      <div key={visit._id} className="rounded border bg-white p-3 text-sm space-y-1">
                                        <div className="font-medium">
                                          🏫 {visit.schoolName}
                                          {visit.schoolCode ? <span className="text-neutral-500"> · {visit.schoolCode}</span> : null}
                                        </div>
                                        <div>
                                          Entry {time(visit.entryAt)} · <MapLink lat={visit.entryLatitude} lng={visit.entryLongitude} /> ·{' '}
                                          <button className="text-sky-700 underline" onClick={() => showPhoto(`${visit.schoolName}: entry`, `/field-day/visits/${visit._id}/photo?which=entry`)}>
                                            Photo
                                          </button>
                                        </div>
                                        <div>
                                          Exit {visit.exitAt ? time(visit.exitAt) : 'still inside'}
                                          {visit.exitAt ? (
                                            <>
                                              {' · '}
                                              <MapLink lat={visit.exitLatitude} lng={visit.exitLongitude} />
                                              {' · '}
                                              <button className="text-sky-700 underline" onClick={() => showPhoto(`${visit.schoolName}: exit`, `/field-day/visits/${visit._id}/photo?which=exit`)}>
                                                Photo
                                              </button>
                                            </>
                                          ) : null}
                                        </div>
                                        <div className="text-neutral-600">
                                          Time spent {hours(visit.durationMinutes || 0)}
                                          {typeof visit.exitDistanceFromEntryM === 'number' && visit.exitDistanceFromEntryM > 300
                                            ? ` · exit photo ${visit.exitDistanceFromEntryM} m from entry`
                                            : ''}
                                        </div>
                                        {visit.missedCheckout ? (
                                          <div className="text-amber-700">Check-out missed; exit time entered later. Reason: {visit.missedReason}</div>
                                        ) : null}
                                        {visit.activityType ? (
                                          <div className="text-neutral-700">
                                            {visit.activityType}: {[visit.activity?.subject, visit.activity?.term, visit.activity?.level].filter(Boolean).join(' · ')}
                                            {visit.activity?.participants ? ` · ${visit.activity.participants} attended` : ''}
                                            {visit.activity?.remarks ? ` · ${visit.activity.remarks}` : ''}
                                            {' · '}
                                            <button className="text-sky-700 underline" onClick={() => showPhoto(`${visit.schoolName}: feedback form`, `/field-day/visits/${visit._id}/photo?which=feedback`)}>
                                              Feedback form
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null
                                  )}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {photo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPhoto(null)}>
          <div className="max-w-lg w-full rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <div className="font-semibold">{photo.title}</div>
              <Button variant="ghost" size="sm" onClick={() => setPhoto(null)}>Close</Button>
            </div>
            {photo.loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : photo.src?.startsWith('data:application/pdf') ? (
              <iframe src={photo.src} title={photo.title} className="h-[70vh] w-full rounded" />
            ) : photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.src} alt={photo.title} className="max-h-[70vh] w-full rounded object-contain" />
            ) : (
              <p className="text-sm text-neutral-500">No photo.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
