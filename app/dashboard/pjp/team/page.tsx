'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { PjpList } from '@/components/pjp/PjpList'
import type { Pjp } from '@/lib/pjp'

const FILTERS = [
  { key: 'Waiting', label: 'Waiting for approval' },
  { key: '', label: 'All' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
]

/** Team PJP: plans submitted by the people this user manages (Admin / Super Admin: everyone). */
export default function TeamPjpPage() {
  const [status, setStatus] = useState('Waiting')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Pjp[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setRows(null)
    setError('')
    const qs = new URLSearchParams({ scope: 'team' })
    if (status) qs.set('status', status)
    if (from) qs.set('from', from)
    if (to) qs.set('to', to)
    apiRequest<Pjp[]>(`/pjp?${qs.toString()}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the plans'))
  }, [status, from, to])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!rows || !s) return rows
    return rows.filter((p) =>
      (p.employeeId && typeof p.employeeId === 'object' ? `${p.employeeId.name} ${p.employeeId.empCode}` : '').toLowerCase().includes(s)
    )
  }, [rows, q])
  const totals = useMemo(() => {
    const t = { planned: 0, completed: 0, pending: 0, missed: 0 }
    for (const p of shown || []) {
      t.planned += p.summary?.planned || 0
      t.completed += p.summary?.completed || 0
      t.pending += p.summary?.pending || 0
      t.missed += p.summary?.missed || 0
    }
    return t
  }, [shown])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Team PJP</h1>
        <p className="text-sm text-neutral-600">Approve your team&apos;s plans and track completed, pending and missed visits.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.key)}
            className={`rounded-full border px-3 py-1 text-sm ${status === f.key ? 'border-sky-600 bg-sky-600 text-white' : 'bg-white text-neutral-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input className="bg-white" placeholder="Search employee" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input className="bg-white" type="date" allowPastDates value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input className="bg-white" type="date" allowPastDates value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>
      {shown?.length ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <span>Planned: {totals.planned}</span>
          <span className="text-green-700">Completed: {totals.completed}</span>
          <span className="text-amber-700">Pending: {totals.pending}</span>
          <span className="text-red-700">Missed: {totals.missed}</span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {shown ? <PjpList rows={shown} showEmployee /> : !error ? <p className="text-sm text-neutral-500">Loading…</p> : null}
    </div>
  )
}
