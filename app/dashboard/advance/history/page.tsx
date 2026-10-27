'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { AdvanceHistory, AdvancePerson, Advance, advanceMoney, advanceDate, advanceAmountLabel } from '@/lib/advance'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { AdvanceDetails, AdvanceStatusBadge } from '@/components/advances/AdvanceDetails'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdvanceHistoryPage() {
  const { user } = usePermissions()
  const [people, setPeople] = useState<AdvancePerson[]>([])
  const [employeeId, setEmployeeId] = useState('')
  const [history, setHistory] = useState<AdvanceHistory | null>(null)
  const [selected, setSelected] = useState<Advance | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const canViewAll = user?.isSuperAdmin || ['Super Admin', 'Admin', 'Finance Manager'].includes(user?.role || '')
  const chosenId = employeeId || user?._id
  useEffect(() => {
    if (!canViewAll) return
    apiRequest<AdvancePerson[]>('/advances/people').then(setPeople).catch((err) => setError(err.message))
  }, [canViewAll])
  useEffect(() => {
    if (!chosenId) return
    let active = true
    let loading = false
    setHistory(null)
    const load = async () => {
      if (loading) return
      loading = true
      try {
        const data = await apiRequest<AdvanceHistory>(`/advances/history?employeeId=${encodeURIComponent(chosenId)}`)
        if (active) { setHistory(data); setError('') }
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load history.') }
      finally { loading = false }
    }
    void load()
    const interval = setInterval(load, 30000)
    window.addEventListener('focus', load)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', load) }
  }, [chosenId, refresh])
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Advance History</h2>
      <div className="flex gap-2">{canViewAll && <select aria-label="Employee history" className="max-w-xs rounded-md border bg-white px-3 text-sm" value={chosenId || ''} onChange={(e) => { setEmployeeId(e.target.value); setSelected(null) }}>
        {!people.some((p) => p._id === user?._id) && <option value={user?._id}>My history</option>}
        {people.map((p) => <option key={p._id} value={p._id}>{p.name}{p.empCode ? ` (${p.empCode})` : ''}</option>)}
      </select>}<Button variant="outline" onClick={() => setRefresh((n) => n + 1)}>Refresh</Button></div>
    </div>
    <p className="text-sm text-neutral-500">All-time balance = approved Employee Request advances − final approved expenses. Incentives are tracked separately. Updates automatically after expense approval.</p>
    {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!history ? <p className="py-8 text-neutral-500">{error ? 'History is unavailable. Use Refresh to try again.' : 'Loading history…'}</p> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Approved Advances', history.totalAdvance], ['Total Approved Expenses', history.totalApprovedExpenses], ['Remaining Balance', history.remainingBalance], ['Incentives (Excluded)', history.totalIncentives]].map(([label, value]) => <Card key={label} className="p-5">
          <p className="text-sm text-neutral-500">{label}</p><p className={`mt-2 text-2xl font-semibold ${label === 'Remaining Balance' ? Number(value) < 0 ? 'text-red-700' : Number(value) > 0 ? 'text-green-700' : '' : ''}`}>{advanceMoney(Number(value))}</p>
          {label === 'Remaining Balance' && <p className="mt-1 text-xs text-neutral-500">{Number(value) > 0 ? 'Positive balance · advance available' : Number(value) < 0 ? 'Negative balance · expenses exceed advances' : 'Zero balance'}</p>}
        </Card>)}
      </div>
      <h3 className="text-lg font-medium">Balance History</h3>
      <Card className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-neutral-50"><tr>{['Approval Date', 'Entry', 'Description', 'Amount', 'Running Balance'].map((h) => <th key={h} className="p-4 font-medium">{h}</th>)}</tr></thead>
        <tbody>{history.ledger.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-neutral-500">No approved advances or expenses yet.</td></tr> : history.ledger.map((entry) => <tr key={entry.id} className="border-b last:border-0">
          <td className="whitespace-nowrap p-4">{advanceDate(entry.date)}</td><td className="p-4">{entry.kind === 'incentive' ? 'Incentive (excluded)' : entry.kind === 'advance' ? 'Advance' : 'Approved expense'}</td>
          <td className="max-w-sm break-words p-4">{entry.description}</td><td className="whitespace-nowrap p-4">{entry.kind === 'expense' ? '−' : entry.kind === 'advance' ? '+' : ''}{advanceMoney(entry.amount)}</td><td className={`whitespace-nowrap p-4 font-medium ${entry.balance < 0 ? 'text-red-700' : entry.balance > 0 ? 'text-green-700' : ''}`}>{advanceMoney(entry.balance)}</td>
        </tr>)}</tbody></table></Card>
      <h3 className="text-lg font-medium">All Advance Requests</h3>
      <Card className="divide-y">{history.requests.length === 0 ? <p className="p-6 text-center text-sm text-neutral-500">No advance requests yet.</p> : history.requests.map((request) => <div key={request._id} className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
        <div><p className="font-medium">{request.advanceType} · {advanceAmountLabel(request)}</p><p className="text-neutral-500">{advanceDate(request.date)}</p></div><AdvanceStatusBadge advance={request} /><Button variant="outline" onClick={() => setSelected(request)}>Details</Button>
      </div>)}</Card>
    </>}
    {selected && <AdvanceDetails key={selected._id} advance={selected} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); setRefresh((n) => n + 1) }} />}
  </div>
}
