'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PJP_PURPOSES, daysBetween, dmy, periodEnd, weekday, type Pjp, type PjpItem } from '@/lib/pjp'

type School = { schoolName: string; schoolCode?: string; town?: string; zone?: string; leadId?: string }

const todayIst = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)
const blankRow = (date: string): PjpItem => ({ date, time: '10:00', schoolName: '', location: '', purpose: '', notes: '' })
const selectClass = 'h-9 w-full rounded-md border border-input bg-white px-2 text-sm'

/** Create or change a weekly / monthly plan. An approved plan's change goes to the reporting manager. */
export function PjpEditor({ initial, onSaved }: { initial?: Pjp; onSaved: (p: Pjp) => void }) {
  const approved = initial?.status === 'Approved'
  const [period, setPeriod] = useState<'Weekly' | 'Monthly'>(initial?.period || 'Weekly')
  const [from, setFrom] = useState(initial?.fromDate || todayIst())
  const [to, setTo] = useState(initial?.toDate || periodEnd('Weekly', todayIst()))
  const [items, setItems] = useState<PjpItem[]>(
    initial?.items?.length
      ? initial.items.map(({ visitStatus, actual, ...it }) => it)
      : [blankRow(initial?.fromDate || todayIst())]
  )
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [schools, setSchools] = useState<School[]>([])
  const days = useMemo(() => daysBetween(from, to), [from, to])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    const t = setTimeout(() => {
      apiRequest<School[]>(`/field-day/schools?q=${encodeURIComponent(q)}`)
        .then((r) => setSchools(Array.isArray(r) ? r : []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const setRow = (i: number, patch: Partial<PjpItem>) => setItems((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const changePeriod = (p: 'Weekly' | 'Monthly') => {
    setPeriod(p)
    setTo(periodEnd(p, from))
  }
  const changeFrom = (d: string) => {
    setFrom(d)
    setTo(periodEnd(period, d))
  }
  const pickSchool = (i: number, name: string) => {
    const s = schools.find((x) => x.schoolName === name)
    setRow(i, s ? { schoolName: s.schoolName, schoolCode: s.schoolCode || '', leadId: s.leadId, location: s.town || s.zone || '' } : { schoolName: name, schoolCode: '', leadId: undefined })
    setQuery(name)
  }

  const save = async (submit: boolean) => {
    if (approved && !reason.trim()) {
      toast.error('Give a reason for changing the approved plan')
      return
    }
    setSaving(true)
    try {
      const body = JSON.stringify({ period, fromDate: from, toDate: to, items, submit, reason })
      const saved = initial
        ? await apiRequest<Pjp>(`/pjp/${initial._id}`, { method: 'PUT', body })
        : await apiRequest<Pjp>('/pjp', { method: 'POST', body })
      toast.success(
        approved
          ? saved.changeRequest?.status === 'Pending'
            ? 'Change sent to your reporting manager for approval'
            : 'Plan changed'
          : submit
            ? saved.status === 'Approved'
              ? 'Plan submitted and approved'
              : 'Plan submitted to your reporting manager'
            : 'Draft saved'
      )
      onSaved(saved)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the plan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Plan</Label>
          <select className={`${selectClass} mt-1`} value={period} disabled={approved} onChange={(e) => changePeriod(e.target.value as 'Weekly' | 'Monthly')}>
            <option value="Weekly">Weekly</option>
            <option value="Monthly">Monthly</option>
          </select>
        </div>
        <div>
          <Label>From</Label>
          <Input className="mt-1 bg-white" type="date" allowPastDates={!!initial} value={from} onChange={(e) => changeFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input className="mt-1 bg-white" type="date" allowPastDates={!!initial} min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <datalist id="pjp-schools">
        {schools.map((s) => (
          <option key={`${s.schoolCode}-${s.schoolName}`} value={s.schoolName}>
            {[s.schoolCode, s.town || s.zone].filter(Boolean).join(' · ')}
          </option>
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              {['Date', 'Time', 'School name', 'Location', 'Visit purpose', 'Notes', ''].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i} className="border-t align-top">
                <td className="px-2 py-2 w-40">
                  <select className={selectClass} value={r.date} onChange={(e) => setRow(i, { date: e.target.value })}>
                    {!days.includes(r.date) ? <option value={r.date}>{dmy(r.date)} (outside)</option> : null}
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {weekday(d)} {dmy(d)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 w-32">
                  <Input className="bg-white" type="time" value={r.time} onChange={(e) => setRow(i, { time: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <Input
                    className="bg-white"
                    list="pjp-schools"
                    placeholder="Type to search"
                    value={r.schoolName}
                    onFocus={() => setQuery(r.schoolName)}
                    onChange={(e) => pickSchool(i, e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <Input className="bg-white" placeholder="Area / town" value={r.location || ''} onChange={(e) => setRow(i, { location: e.target.value })} />
                </td>
                <td className="px-2 py-2 w-44">
                  <select className={selectClass} value={r.purpose} onChange={(e) => setRow(i, { purpose: e.target.value })}>
                    <option value="">Choose</option>
                    {PJP_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <Input className="bg-white" value={r.notes || ''} onChange={(e) => setRow(i, { notes: e.target.value })} />
                </td>
                <td className="px-2 py-2 w-10">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove visit"
                    disabled={items.length === 1}
                    onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        onClick={() => setItems((rows) => [...rows, { ...blankRow(rows[rows.length - 1]?.date || from), time: rows[rows.length - 1]?.time || '10:00' }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Add visit
      </Button>

      {approved ? (
        <div>
          <Label>Reason for the change *</Label>
          <Textarea className="mt-1 bg-white" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the approved plan changes" />
          <p className="mt-1 text-xs text-neutral-500">The change goes to your reporting manager for approval.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {approved ? (
          <Button onClick={() => void save(false)} disabled={saving}>
            {saving ? 'Sending…' : 'Send change for approval'}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
              Save draft
            </Button>
            <Button onClick={() => void save(true)} disabled={saving}>
              {saving ? 'Saving…' : initial?.status === 'Submitted' ? 'Save' : 'Submit plan'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
