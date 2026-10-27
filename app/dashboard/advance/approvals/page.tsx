'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Advance, advanceDate, advanceMoney } from '@/lib/advance'
import { AdvanceDetails, AdvanceStatusBadge } from '@/components/advances/AdvanceDetails'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

type Tab = 'all' | 'Pending' | 'Rejected'
const TABS: [Tab, string][] = [['all', 'All'], ['Pending', 'Pending'], ['Rejected', 'Rejected']]

/** Other employees' advance requests this user reviews; their own requests stay on Advance Status. */
export default function AdvanceApprovalsPage() {
  const [rows, setRows] = useState<Advance[]>([])
  const [selected, setSelected] = useState<Advance | null>(null)
  const [tab, setTab] = useState<Tab>('Pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRows(await apiRequest<Advance[]>('/advances/approvals')) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load advance approvals.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const count = (t: Tab) => rows.filter((row) => t === 'all' || row.status === t).length
  const awaitingMe = rows.filter((row) => row.canDecide).length
  // Requests waiting on this user come first in every tab.
  const visible = rows
    .filter((row) => (tab === 'all' || row.status === tab)
      && `${row.employeeId?.name || ''} ${row.employeeId?.empCode || ''} ${row.reason} ${row.advanceType}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.canDecide) - Number(a.canDecide))
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Advance Approvals</h2><Button variant="outline" onClick={load} disabled={loading}>Refresh</Button></div>
    <p className="text-sm text-neutral-500">
      Advance requests from other employees that you review. Your own requests are under Advance Status.
      {awaitingMe > 0 && <span className="ml-1 font-medium text-amber-700">{awaitingMe} waiting for your approval.</span>}
    </p>
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Approval status" className="flex gap-1 rounded-lg bg-neutral-100 p-1">
        {TABS.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}>
          {label} <span className="text-xs text-neutral-500">({count(key)})</span>
        </button>)}
      </div>
      <Input className="max-w-sm" placeholder="Search employee, reason, or type…" aria-label="Search advance approvals" value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Card className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="border-b bg-neutral-50"><tr>{['Employee', 'Advance Type / Reason', 'Date', 'Amount', 'Status', ''].map((h, i) => <th key={i} className="p-4 font-medium">{h}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Loading requests…</td></tr> : visible.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-neutral-500">No advance requests here.</td></tr> : visible.map((row) => <tr key={row._id} className={`border-b last:border-0 ${row.canDecide ? 'bg-amber-50/50' : ''}`}>
        <td className="p-4">{row.employeeId?.name || 'Employee'}<div className="text-xs text-neutral-500">{row.employeeId?.empCode}</div></td>
        <td className="max-w-sm p-4"><div className="font-medium">{row.advanceType}</div><p className="mt-1 line-clamp-2 break-words text-neutral-500">{row.reason}</p></td>
        <td className="whitespace-nowrap p-4">{advanceDate(row.date)}</td><td className="whitespace-nowrap p-4 font-medium">{advanceMoney(row.amount)}</td>
        <td className="p-4"><AdvanceStatusBadge advance={row} />{row.canDecide && <p className="mt-1 text-xs font-medium text-amber-700">Awaiting your approval</p>}</td>
        <td className="p-4"><Button variant={row.canDecide ? 'default' : 'outline'} onClick={() => setSelected(row)}>{row.canDecide ? 'Review' : 'Details'}</Button></td>
      </tr>)}</tbody>
    </table></Card>
    {selected && <AdvanceDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); setRows((old) => old.map((row) => row._id === updated._id ? updated : row)) }} />}
  </div>
}
