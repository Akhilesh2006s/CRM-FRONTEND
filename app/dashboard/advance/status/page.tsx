'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Advance, advanceDate, advanceMoney } from '@/lib/advance'
import { AdvanceDetails, AdvanceStatusBadge } from '@/components/advances/AdvanceDetails'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export default function AdvanceStatusPage() {
  const { user } = usePermissions()
  const [rows, setRows] = useState<Advance[]>([])
  const [selected, setSelected] = useState<Advance | null>(null)
  const [status, setStatus] = useState('all')
  const [scope, setScope] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setRows(await apiRequest<Advance[]>('/advances')) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load advances.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const visible = rows.filter((row) => (status === 'all' || row.status === status)
    && (scope === 'all' || (scope === 'mine' ? row.employeeId?._id === user?._id : row.canDecide))
    && `${row.employeeId?.name || ''} ${row.reason} ${row.advanceType}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Advance Status</h2><Button variant="outline" onClick={load} disabled={loading}>Refresh</Button></div>
    <p className="text-sm text-neutral-500">Employees see their own requests and requests assigned to them for approval. Admin, Super Admin, and Finance Manager see all requests.</p>
    <div className="flex flex-wrap gap-3">
      <Input className="max-w-sm" placeholder="Search employee, reason, or type…" aria-label="Search advance requests" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select aria-label="Filter status" className="rounded-md border bg-white px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{['Pending', 'Approved', 'Rejected'].map((s) => <option key={s}>{s}</option>)}</select>
      <select aria-label="Filter requests" className="rounded-md border bg-white px-3 py-2 text-sm" value={scope} onChange={(e) => setScope(e.target.value)}><option value="all">All visible requests</option><option value="mine">My requests</option><option value="review">Awaiting my approval</option></select>
    </div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Card className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead className="border-b bg-neutral-50"><tr>{['Employee', 'Advance Type / Reason', 'Date', 'Amount', 'Status', ''].map((h, i) => <th key={i} className="p-4 font-medium">{h}</th>)}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Loading requests…</td></tr> : visible.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-neutral-500">No advance requests found.</td></tr> : visible.map((row) => <tr key={row._id} className="border-b last:border-0">
        <td className="p-4">{row.employeeId?.name || 'Employee'}<div className="text-xs text-neutral-500">{row.employeeId?.empCode}</div></td>
        <td className="max-w-sm p-4"><div className="font-medium">{row.advanceType}</div><p className="mt-1 line-clamp-2 break-words text-neutral-500">{row.reason}</p></td>
        <td className="whitespace-nowrap p-4">{advanceDate(row.date)}</td><td className="whitespace-nowrap p-4 font-medium">{advanceMoney(row.amount)}</td>
        <td className="p-4"><AdvanceStatusBadge advance={row} /></td><td className="p-4"><Button variant="outline" onClick={() => setSelected(row)}>{row.canDecide ? 'Review' : 'Details'}</Button></td>
      </tr>)}</tbody>
    </table></Card>
    {selected && <AdvanceDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); setRows((old) => old.map((row) => row._id === updated._id ? updated : row)) }} />}
  </div>
}
