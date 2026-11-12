'use client'

import { useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { leaveTypeLabel } from '@/lib/leaveTypes'

type MonthRow = {
  month: string
  approvedDays: number
  paidDays: number
  lopDays: number
  pendingDays: number
  rejectedDays: number
  presentDays: number
  leaves: { _id: string; leaveType: string; status: string; from: string; to: string; days: number; lopDays: number; reason?: string }[]
}
type History = {
  employee: { name?: string; empCode?: string }
  year: string
  totals: { approvedDays: number; paidDays: number; lopDays: number; pendingDays: number; rejectedDays: number; presentDays: number }
  months: MonthRow[]
}

const monthName = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const dmy = (k: string) => k.split('-').reverse().join('/')
const ymd = (v: string) => new Date(new Date(v).getTime() + 330 * 60000).toISOString().slice(0, 10)
const plural = (n: number) => (n === 1 ? 'day' : 'days')

/** Employee's leave year month by month (final approver: HR / Admin / Super Admin). */
export function LeaveHistoryButton({ employeeId, name }: { employeeId: string; name?: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<History | null>(null)
  const [error, setError] = useState('')
  const show = async () => {
    setOpen(true)
    setError('')
    try {
      setData(await apiRequest<History>(`/leaves/history?employeeId=${encodeURIComponent(employeeId)}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the leave history')
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void show()}>
        Leave history
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Leave history: {data?.employee?.name || name || 'Employee'} {data ? `(${data.year})` : ''}
            </DialogTitle>
          </DialogHeader>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!data && !error ? <p className="text-sm">Loading…</p> : null}
          {data ? (
            <div className="space-y-3 text-sm">
              <p className="text-neutral-600">
                This year: {data.totals.approvedDays} days approved ({data.totals.paidDays} paid, {data.totals.lopDays} loss of pay) ·{' '}
                {data.totals.pendingDays} pending · {data.totals.rejectedDays} rejected · {data.totals.presentDays} days present
              </p>
              <table className="w-full border text-left">
                <thead className="bg-neutral-50">
                  <tr>
                    {['Month', 'Present', 'Approved', 'Paid', 'Loss of pay', 'Pending', 'Rejected'].map((h) => (
                      <th key={h} className="px-2 py-1.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month} className="border-t align-top">
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{monthName(m.month)}</div>
                        {m.leaves.map((l) => (
                          <div key={`${l._id}-${l.from}`} className="text-xs text-neutral-500">
                            {leaveTypeLabel(l.leaveType)}: {dmy(l.from)}
                            {l.to !== l.from ? ` – ${dmy(l.to)}` : ''} ({l.days} {plural(l.days)}, {l.status})
                          </div>
                        ))}
                      </td>
                      <td className="px-2 py-1.5">{m.presentDays}</td>
                      <td className="px-2 py-1.5">{m.approvedDays}</td>
                      <td className="px-2 py-1.5">{m.paidDays}</td>
                      <td className={`px-2 py-1.5 ${m.lopDays ? 'text-red-600' : ''}`}>{m.lopDays}</td>
                      <td className="px-2 py-1.5">{m.pendingDays}</td>
                      <td className="px-2 py-1.5">{m.rejectedDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Approve fewer days or other dates (final approver). */
export function ApproveWithChangesButton({
  leave,
  disabled,
  onDone,
}: {
  leave: { _id: string; startDate: string; endDate: string; dayType?: string; days?: number }
  disabled?: boolean
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(ymd(leave.startDate))
  const [to, setTo] = useState(ymd(leave.endDate))
  const [halfDay, setHalfDay] = useState(leave.dayType === 'Half Day')
  const [saving, setSaving] = useState(false)
  const days = halfDay ? 0.5 : from && to && to >= from ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 : 0
  const save = async () => {
    if (!from || (!halfDay && (!to || to < from))) {
      toast.error('Choose the dates to approve')
      return
    }
    setSaving(true)
    try {
      await apiRequest(`/leaves/${leave._id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'Approved',
          approveStartDate: from,
          approveEndDate: halfDay ? from : to,
          approveDayType: halfDay ? 'Half Day' : 'Full Day',
        }),
      })
      toast.success(`Approved for ${days} ${plural(days)}`)
      setOpen(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not approve')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        Approve with changes
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve fewer days or other dates</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-neutral-600">
              Asked: {dmy(ymd(leave.startDate))}
              {ymd(leave.endDate) !== ymd(leave.startDate) ? ` – ${dmy(ymd(leave.endDate))}` : ''} ({leave.days ?? '—'} days)
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={halfDay} onChange={(e) => setHalfDay(e.target.checked)} /> Half day only
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{halfDay ? 'Date' : 'From'}</Label>
                <Input type="date" allowPastDates value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              {!halfDay ? (
                <div>
                  <Label>To</Label>
                  <Input type="date" allowPastDates value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                </div>
              ) : null}
            </div>
            <p className="font-medium">
              Approve: {days} {plural(days)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving || !days}>
              {saving ? 'Saving…' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** "Asked for …" when the final approver changed the dates. */
export function leaveDateChangeText(l: { requestedStartDate?: string; requestedEndDate?: string; requestedDays?: number }) {
  if (!l.requestedStartDate) return ''
  const a = ymd(l.requestedStartDate)
  const b = l.requestedEndDate ? ymd(l.requestedEndDate) : a
  return `Asked for ${dmy(a)}${b !== a ? ` – ${dmy(b)}` : ''} (${l.requestedDays ?? '—'} days); dates changed at approval.`
}
