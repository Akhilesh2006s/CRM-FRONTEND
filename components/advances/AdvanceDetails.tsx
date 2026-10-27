'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Advance, AdvancePerson, advanceMoney, advanceDate, advanceApprovalLabel, advanceCurrentAmount, advanceAmountLabel } from '@/lib/advance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { usePermissions } from '@/components/permissions/PermissionsProvider'

export function AdvanceStatusBadge({ advance }: { advance: Advance }) {
  const color = advance.status === 'Approved' ? 'bg-green-50 text-green-700' : advance.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
  return <div><span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${color}`}>{advance.status}</span>
    {advance.status === 'Pending' && <p className="mt-1 text-xs text-neutral-600">Pending with {advance.pendingWith.join(', ')}</p>}
  </div>
}

export function AdvanceDetails({ advance, onClose, onUpdated }: { advance: Advance; onClose: () => void; onUpdated: (advance: Advance) => void }) {
  const { hasPermission } = usePermissions()
  const canReview = hasPermission('advance.status.page.view') || hasPermission('advance.approvals.page.view')
  const [people, setPeople] = useState<AdvancePerson[]>([])
  const [ids, setIds] = useState<string[]>(advance.approvals.filter((a) => a.stage === 'tagged').map((a) => a.approverId?._id || '').filter(Boolean))
  const [search, setSearch] = useState('')
  const [remarks, setRemarks] = useState('')
  const [amount, setAmount] = useState(String(advanceCurrentAmount(advance)))
  const amountValue = Number(amount)
  const amountValid = /^\d+(\.\d{1,2})?$/.test(amount.trim()) && amountValue > 0
  const amountChanged = amountValid && Math.abs(amountValue - advanceCurrentAmount(advance)) > 0.001
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [peopleReady, setPeopleReady] = useState(false)
  const savedIds = advance.approvals.filter((a) => a.stage === 'tagged').map((a) => a.approverId?._id || '').filter(Boolean)
  const tagsChanged = [...ids].sort().join() !== [...savedIds].sort().join()

  useEffect(() => {
    if (!advance.canTagApprovers) return
    let active = true
    apiRequest<AdvancePerson[]>('/advances/people?purpose=approvers')
      .then((data) => { if (active) { setPeople(data); setPeopleReady(true) } })
      .catch((err) => { if (active) setError(err.message || 'Unable to load approvers.') })
    return () => { active = false }
  }, [advance.canTagApprovers])

  async function mutate(path: string, body: object) {
    setBusy(true); setError('')
    try {
      const updated = await apiRequest<Advance>(`/advances/${advance._id}/${path}`, { method: 'PUT', body: JSON.stringify({ ...body, version: advance.__v }) })
      onUpdated(updated)
      setRemarks('')
      setAmount(String(advanceCurrentAmount(updated)))
      toast.success(path === 'approvers' ? 'Approvers updated' : 'Decision saved')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update advance.') }
    finally { setBusy(false) }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Advance Request · {advanceAmountLabel(advance)}</DialogTitle><DialogDescription>{advance.employeeId?.name || 'Employee'} · {advance.advanceType}</DialogDescription></DialogHeader>
      <AdvanceStatusBadge advance={advance} />
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-neutral-500">Date</dt><dd>{advanceDate(advance.date)}</dd></div>
        <div><dt className="text-neutral-500">Submitted</dt><dd>{advanceDate(advance.createdAt)}</dd></div>
        <div><dt className="text-neutral-500">Requested Amount</dt><dd>{advanceMoney(advance.amount)}</dd></div>
        {advance.approvedAmount != null && <div><dt className="text-neutral-500">{advance.status === 'Approved' ? 'Approved Amount' : 'Amount Approved So Far'}</dt><dd className="font-medium">{advanceMoney(advance.approvedAmount)}</dd></div>}
        {[['Reason for Advance', advance.reason], ['Schedule Details', advance.scheduleDetails || '—'], ['Remark', advance.remark]].map(([label, value]) => <div key={label} className="sm:col-span-2"><dt className="text-neutral-500">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}
      </dl>
      {advance.advanceType === 'Special Advance (Incentives)' && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">This incentive is excluded from all expense deductions and balance adjustments.</p>}
      <div className="space-y-3 border-t pt-4"><h3 className="font-medium">Approval History</h3>
        {advance.approvals.map((approval, index) => <div key={`${approval.stage}-${index}`} className="rounded-md border p-3 text-sm">
          <div className="flex justify-between gap-2"><span className="font-medium">{advanceApprovalLabel(approval)}</span><span>{advance.status === 'Rejected' && approval.status === 'Pending' ? 'Not required — request rejected' : approval.status}</span></div>
          {approval.decidedBy && <p className="text-neutral-500">{approval.decidedBy.name}{approval.decidedAt && ` · ${advanceDate(approval.decidedAt)}`}{approval.status === 'Approved' && approval.amount != null && ` · Approved ${advanceMoney(approval.amount)}`}</p>}
          {approval.remarks && <p className="mt-1 whitespace-pre-wrap break-words">{approval.remarks}</p>}
        </div>)}
      </div>
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {advance.canTagApprovers && canReview && <div className="space-y-3 border-t pt-4">
        <h3 className="font-medium">Tag Employees for Approval</h3><p className="text-sm text-neutral-500">Optional. All tagged employees must approve after Admin and before Finance Manager. Save changes before approving.</p>
        <Input aria-label="Search approvers" placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
          {!peopleReady && <p className="text-sm text-neutral-500">Loading employees…</p>}
          {people.filter((p) => p._id !== advance.employeeId?._id && `${p.name} ${p.empCode || ''}`.toLowerCase().includes(search.toLowerCase())).map((person) => <label key={person._id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ids.includes(person._id)} disabled={busy} onChange={(e) => setIds((old) => e.target.checked ? [...old, person._id] : old.filter((id) => id !== person._id))} />
            {person.name} {person.empCode && `(${person.empCode})`} · {person.role}
          </label>)}
        </div>
        <Button variant="outline" disabled={busy || !peopleReady || !tagsChanged} onClick={() => mutate('approvers', { approverIds: ids })}>Save Approvers ({ids.length})</Button>
      </div>}
      {advance.canDecide && canReview && <div className="space-y-3 border-t pt-4">
        {advance.canEditAmount && <div className="space-y-1">
          <Label htmlFor="approvedAmount">Approved Amount (₹)</Label>
          <Input id="approvedAmount" inputMode="decimal" className="max-w-xs" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
          <p className="text-xs text-neutral-500">Requested {advanceMoney(advance.amount)}{advance.approvedAmount != null && Math.abs(advance.approvedAmount - advance.amount) > 0.001 ? ` · previous approver set ${advanceMoney(advance.approvedAmount)}` : ''}. Change it if needed; a remark is then required.</p>
          {!amountValid && <p className="text-xs text-red-700">Enter an amount greater than 0 with at most two decimals.</p>}
        </div>}
        <Label htmlFor="decisionRemarks">{amountChanged ? 'Remark (required: amount changed)' : 'Approval Remarks / Rejection Reason'}</Label>
        <Textarea id="decisionRemarks" maxLength={2000} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={amountChanged ? 'Why the amount was changed' : 'Optional when approving; required when rejecting'} />
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || tagsChanged || (advance.canEditAmount && (!amountValid || (amountChanged && !remarks.trim())))}
            onClick={() => mutate('decision', { decision: 'Approved', remarks, ...(advance.canEditAmount ? { amount: amount.trim() } : {}) })}>
            {busy ? 'Saving…' : amountChanged ? `Approve ${advanceMoney(amountValue)}` : 'Approve'}
          </Button>
          <Button variant="destructive" disabled={busy || tagsChanged || !remarks.trim()} onClick={() => mutate('decision', { decision: 'Rejected', remarks })}>Reject</Button>
        </div>
      </div>}
    </DialogContent>
  </Dialog>
}
