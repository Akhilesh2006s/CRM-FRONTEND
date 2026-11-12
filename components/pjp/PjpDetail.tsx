'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  dmy,
  pjpStatusClass,
  pjpStatusLabel,
  time12,
  visitStatusClass,
  weekday,
  type Pjp,
  type PjpItem,
} from '@/lib/pjp'

const name = (p: Pjp['employeeId'] | undefined) => (p && typeof p === 'object' ? p.name || '' : '')

export function PjpSummaryChips({ p }: { p: Pjp }) {
  const s = p.summary
  if (!s) return null
  const chips: [string, number, string][] = [
    ['Planned', s.planned, 'bg-neutral-100 text-neutral-800'],
    ['Completed', s.completed, 'bg-green-100 text-green-800'],
    ['Pending', s.pending, 'bg-amber-100 text-amber-800'],
    ['Missed', s.missed, 'bg-red-100 text-red-700'],
    ['Not in plan', s.unplanned, 'bg-sky-100 text-sky-800'],
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map(([label, n, cls]) => (
        <span key={label} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
          {label}: {n}
        </span>
      ))}
    </div>
  )
}

function ItemsTable({ items, showStatus }: { items: PjpItem[]; showStatus: boolean }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-neutral-50 text-left">
          <tr>
            {['Date', 'Time', 'School name', 'Location', 'Visit purpose', ...(showStatus ? ['Status'] : [])].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it._id || i} className="border-t align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                {weekday(it.date)} {dmy(it.date)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{time12(it.time)}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{it.schoolName}</div>
                {it.notes ? <div className="text-xs text-neutral-500">{it.notes}</div> : null}
              </td>
              <td className="px-3 py-2">{it.location || '—'}</td>
              <td className="px-3 py-2">{it.purpose}</td>
              {showStatus ? (
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${visitStatusClass(it.visitStatus)}`}>{it.visitStatus || 'Pending'}</span>
                  {it.actual ? <div className="mt-1 text-xs text-neutral-500">{it.actual.kind}</div> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** One plan: plan vs actual, the pending change, approve / reject, and the history. */
export function PjpDetail({ p, onChanged, onEdit }: { p: Pjp; onChanged: (p: Pjp | null) => void; onEdit?: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const showStatus = p.status === 'Approved' || p.status === 'Submitted'

  const decide = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !remarks.trim()) {
      toast.error('Give a reason for rejecting')
      return
    }
    setBusy(true)
    try {
      const out = await apiRequest<Pjp>(`/pjp/${p._id}/decide`, { method: 'PUT', body: JSON.stringify({ action, remarks }) })
      toast.success(action === 'approve' ? 'Approved' : 'Rejected')
      setRemarks('')
      onChanged(out)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }
  const submit = async () => {
    setBusy(true)
    try {
      onChanged(await apiRequest<Pjp>(`/pjp/${p._id}/submit`, { method: 'POST' }))
      toast.success('Plan submitted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not submit')
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!window.confirm('Delete this plan?')) return
    setBusy(true)
    try {
      await apiRequest(`/pjp/${p._id}`, { method: 'DELETE' })
      toast.success('Plan deleted')
      onChanged(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete')
    } finally {
      setBusy(false)
    }
  }

  const cr = p.changeRequest
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">
              {p.isOwn ? 'My' : `${name(p.employeeId)}'s`} {p.period.toLowerCase()} plan
            </div>
            <div className="text-sm text-neutral-600">
              {dmy(p.fromDate)} – {dmy(p.toDate)}
              {p.employeeId && typeof p.employeeId === 'object' && p.employeeId.role ? ` · ${p.employeeId.role}` : ''}
            </div>
            <div className="text-xs text-neutral-500">
              Approver: {name(p.approverId) || 'Admin / Super Admin'}
              {p.decidedBy && name(p.decidedBy) ? ` · Decided by ${name(p.decidedBy)}` : ''}
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${pjpStatusClass(p)}`}>{pjpStatusLabel(p)}</span>
        </div>
        {p.status === 'Rejected' && p.remarks ? <div className="text-sm text-red-700">Reason: {p.remarks}</div> : null}
        <PjpSummaryChips p={p} />
        {p.isOwn ? (
          <div className="flex flex-wrap gap-2">
            {p.canEdit && onEdit ? (
              <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>
                {p.status === 'Approved' ? 'Change plan' : 'Edit'}
              </Button>
            ) : null}
            {p.canSubmit ? (
              <Button size="sm" onClick={() => void submit()} disabled={busy}>
                Submit plan
              </Button>
            ) : null}
            {p.canDelete ? (
              <Button size="sm" variant="outline" className="text-red-700" onClick={() => void remove()} disabled={busy}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {cr && cr.status === 'Pending' ? (
        <Card className="space-y-2 border-amber-300 p-4">
          <div className="font-semibold text-amber-800">Change waiting for approval</div>
          <div className="text-sm text-neutral-700">Reason: {cr.reason || '—'}</div>
          {cr.fromDate && (cr.fromDate !== p.fromDate || cr.toDate !== p.toDate) ? (
            <div className="text-sm text-neutral-700">
              New period: {dmy(cr.fromDate)} – {dmy(cr.toDate)}
            </div>
          ) : null}
          <div className="text-sm font-medium">Changed plan</div>
          <ItemsTable items={cr.items} showStatus={false} />
        </Card>
      ) : null}
      {cr && cr.status === 'Rejected' && cr.remarks ? (
        <div className="text-sm text-red-700">Last change rejected: {cr.remarks}</div>
      ) : null}

      {p.canDecide ? (
        <Card className="space-y-2 p-4">
          <div className="font-semibold">{cr?.status === 'Pending' ? 'Decide the change' : 'Decide the plan'}</div>
          <Textarea className="bg-white" placeholder="Remarks (required to reject)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          <div className="flex gap-2">
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => void decide('approve')} disabled={busy}>
              Approve
            </Button>
            <Button variant="destructive" onClick={() => void decide('reject')} disabled={busy}>
              Reject
            </Button>
          </div>
        </Card>
      ) : null}

      <div>
        <div className="mb-2 font-semibold">{showStatus ? 'Planned vs actual' : 'Planned visits'}</div>
        <ItemsTable items={p.items} showStatus={showStatus} />
      </div>

      {p.unplanned?.length ? (
        <div>
          <div className="mb-2 font-semibold">Visits not in the plan</div>
          <ul className="space-y-1 text-sm text-neutral-700">
            {p.unplanned.map((u, i) => (
              <li key={i}>
                {dmy(u.day)} · {u.schoolName} ({u.kind})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.history?.length ? (
        <div>
          <div className="mb-2 font-semibold">History</div>
          <ul className="space-y-1 text-xs text-neutral-600">
            {p.history.map((h, i) => (
              <li key={i}>
                {new Date(h.at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })} · {h.action}
                {h.by && typeof h.by === 'object' && h.by.name ? ` by ${h.by.name}` : ''}
                {h.note ? ` — ${h.note}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
