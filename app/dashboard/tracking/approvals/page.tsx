'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Person = { _id: string; name?: string; empCode?: string; role?: string; zone?: string }
type FieldRequest = {
  _id: string
  employeeId: Person
  day: string
  reason: string
  places?: string
  status: string
  remarks?: string
  createdAt: string
  approverId?: { name?: string } | null
  decidedBy?: { name?: string } | null
}
type Review = {
  _id: string
  employeeId: Person
  startTime: string
  endTime?: string
  mode?: string
  officeName?: string
  checkoutMode?: string
  checkoutOfficeName?: string
  reviewStatus: string
  reviewReason?: string
  reviewRemarks?: string
  reviewApproverId?: { name?: string } | null
  reviewedBy?: { name?: string } | null
}

type LocationRequest = {
  _id: string
  employeeId: Person
  schoolCode: string
  schoolName?: string
  latitude: number
  longitude: number
  status: string
  remarks?: string
  createdAt: string
  approverId?: { name?: string } | null
  decidedBy?: { name?: string } | null
}
type Kind = 'request' | 'review' | 'location'
const DECIDE_PATH: Record<Kind, (id: string) => string> = {
  request: (id) => `/field-day/permission/${id}/decide`,
  review: (id) => `/field-day/reviews/${id}/decide`,
  location: (id) => `/field-day/school-location/${id}/decide`,
}

const when = (v?: string) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'
const place = (mode?: string, office?: string) => (mode === 'office' ? `office${office ? `: ${office}` : ''}` : mode || 'no location')
const who = (p?: Person) => [p?.name, p?.empCode, p?.role].filter(Boolean).join(' · ') || '—'

/**
 * Field visit requests from office staff, and check-outs that did not match the check-in
 * (office ↔ field). A reviewed day counts for attendance only when approved.
 */
export default function FieldApprovalsPage() {
  const [history, setHistory] = useState(false)
  const [requests, setRequests] = useState<FieldRequest[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [locations, setLocations] = useState<LocationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [remarks, setRemarks] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<{ requests: FieldRequest[]; reviews: Review[]; locations?: LocationRequest[] }>(`/field-day/approvals${history ? '?history=1' : ''}`)
      setRequests(Array.isArray(data?.requests) ? data.requests : [])
      setReviews(Array.isArray(data?.reviews) ? data.reviews : [])
      setLocations(Array.isArray(data?.locations) ? data.locations : [])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not load approvals')
    } finally {
      setLoading(false)
    }
  }, [history])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (kind: Kind, id: string, decision: 'approve' | 'reject') => {
    const note = (remarks[id] || '').trim()
    if (decision === 'reject' && !note) return toast.error('Enter the reason for rejecting')
    setBusy(`${id}-${decision}`)
    try {
      await apiRequest(DECIDE_PATH[kind](id), {
        method: 'PUT',
        body: JSON.stringify({ decision, remarks: note }),
      })
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected')
      await load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save the decision')
    } finally {
      setBusy('')
    }
  }

  const actions = (kind: Kind, id: string) =>
    history ? null : (
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Input
          className="max-w-sm bg-white"
          placeholder="Remarks (required to reject)"
          value={remarks[id] || ''}
          onChange={(e) => setRemarks((r) => ({ ...r, [id]: e.target.value }))}
        />
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={!!busy} onClick={() => decide(kind, id, 'approve')}>
          {busy === `${id}-approve` ? 'Saving…' : 'Approve'}
        </Button>
        <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => decide(kind, id, 'reject')}>
          {busy === `${id}-reject` ? 'Saving…' : 'Reject'}
        </Button>
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Field Approvals</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Office to Field attendance change requests (approved = the day becomes a field day), check-outs that did not match the check-in, and school
            location updates asked by employees (the school&apos;s location changes only when approved). A reviewed day counts for attendance only when approved.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={history ? 'outline' : 'default'} onClick={() => setHistory(false)}>Waiting</Button>
          <Button size="sm" variant={history ? 'default' : 'outline'} onClick={() => setHistory(true)}>Decided</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm">Loading…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Office to Field requests ({requests.length})</h2>
            {requests.length === 0 && <p className="text-sm text-neutral-500">None.</p>}
            {requests.map((r) => (
              <Card key={r._id} className="p-4 text-sm space-y-1">
                <div className="font-medium">{who(r.employeeId)}</div>
                <div className="text-neutral-600">
                  For {r.day} · asked {when(r.createdAt)}
                  {r.approverId?.name ? ` · reviewer ${r.approverId.name}` : ' · reviewer Admin'}
                </div>
                <div>Reason: {r.reason}</div>
                {r.places ? <div>Places: {r.places}</div> : null}
                {history ? (
                  <div className={r.status === 'approved' ? 'text-green-700' : 'text-red-600'}>
                    {r.status === 'approved' ? 'Approved' : 'Rejected'}
                    {r.decidedBy?.name ? ` by ${r.decidedBy.name}` : ''}
                    {r.remarks ? `: ${r.remarks}` : ''}
                  </div>
                ) : null}
                {actions('request', r._id)}
              </Card>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">School location updates ({locations.length})</h2>
            {locations.length === 0 && <p className="text-sm text-neutral-500">None.</p>}
            {locations.map((l) => (
              <Card key={l._id} className="p-4 text-sm space-y-1">
                <div className="font-medium">
                  {l.schoolName || l.schoolCode} <span className="text-neutral-500">({l.schoolCode})</span>
                </div>
                <div className="text-neutral-600">
                  Asked by {who(l.employeeId)} · {when(l.createdAt)}
                  {l.approverId?.name ? ` · reviewer ${l.approverId.name}` : ' · reviewer Admin'}
                </div>
                <div>
                  New location: {Number(l.latitude).toFixed(6)}, {Number(l.longitude).toFixed(6)} ·{' '}
                  <a
                    className="text-blue-700 hover:underline"
                    href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </div>
                {history ? (
                  <div className={l.status === 'approved' ? 'text-green-700' : 'text-red-600'}>
                    {l.status === 'approved' ? 'Approved' : 'Rejected'}
                    {l.decidedBy?.name ? ` by ${l.decidedBy.name}` : ''}
                    {l.remarks ? `: ${l.remarks}` : ''}
                  </div>
                ) : null}
                {actions('location', l._id)}
              </Card>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Attendance reviews ({reviews.length})</h2>
            {reviews.length === 0 && <p className="text-sm text-neutral-500">None.</p>}
            {reviews.map((a) => (
              <Card key={a._id} className="p-4 text-sm space-y-1">
                <div className="font-medium">{who(a.employeeId)}</div>
                <div className="text-neutral-600">
                  In {when(a.startTime)} ({place(a.mode, a.officeName)}) · Out {when(a.endTime)} ({place(a.checkoutMode, a.checkoutOfficeName)})
                </div>
                {a.reviewReason ? <div>{a.reviewReason}</div> : null}
                {history ? (
                  <div className={a.reviewStatus === 'approved' ? 'text-green-700' : 'text-red-600'}>
                    {a.reviewStatus === 'approved' ? 'Approved' : 'Rejected'}
                    {a.reviewedBy?.name ? ` by ${a.reviewedBy.name}` : ''}
                    {a.reviewRemarks ? `: ${a.reviewRemarks}` : ''}
                  </div>
                ) : null}
                {actions('review', a._id)}
              </Card>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
