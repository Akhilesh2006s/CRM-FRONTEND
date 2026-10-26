'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { todayDateString } from '@/lib/todayDate'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { advanceRequestApprovalDescription } from '@/lib/advance'

export default function RequestAdvancePage() {
  const { user } = usePermissions()
  const router = useRouter()
  const [form, setForm] = useState({ advanceType: 'Employee Request', amount: '', reason: '', scheduleDetails: '', date: todayDateString(), remark: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((old) => ({ ...old, [key]: value }))
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!form.reason.trim() || !form.remark.trim()) { setError('Reason for advance and remark are required.'); return }
    setBusy(true)
    setError('')
    try {
      await apiRequest('/advances', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Advance request submitted')
      router.push('/dashboard/advance/status')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to submit advance.') }
    finally { setBusy(false) }
  }
  return <Card className="max-w-2xl p-6">
    <h2 className="mb-5 text-xl font-semibold">Request Advance</h2>
    <form onSubmit={submit} className="space-y-5">
      {error && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="space-y-2"><Label htmlFor="advanceType">Advance Type *</Label>
        <select id="advanceType" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.advanceType} onChange={(e) => update('advanceType', e.target.value)}>
          <option>Employee Request</option><option>Special Advance (Incentives)</option>
        </select>
        <p className="text-sm text-neutral-500">{form.advanceType === 'Employee Request'
          ? advanceRequestApprovalDescription(user?.role)
          : 'Requires Super Admin approval only. Incentives are excluded from expense deductions and balance adjustments.'}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="amount">Advance Amount (₹) *</Label><Input id="amount" type="number" min="0.01" max="999999999.99" step="0.01" required value={form.amount} onChange={(e) => update('amount', e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="date">Date *</Label><Input id="date" type="date" required value={form.date} onChange={(e) => update('date', e.target.value)} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="reason">Reason for Advance *</Label><Textarea id="reason" required maxLength={2000} value={form.reason} onChange={(e) => update('reason', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="schedule">Schedule Details (optional)</Label><Textarea id="schedule" maxLength={2000} value={form.scheduleDetails} onChange={(e) => update('scheduleDetails', e.target.value)} /></div>
      <div className="space-y-2"><Label htmlFor="remark">Remark *</Label><Textarea id="remark" required maxLength={2000} value={form.remark} onChange={(e) => update('remark', e.target.value)} /></div>
      <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Request'}</Button>
    </form>
  </Card>
}
