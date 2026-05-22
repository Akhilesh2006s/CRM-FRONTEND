'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { getCurrentUser } from '@/lib/auth'
import { canApplyForLeave, getLeaveAccessDeniedRedirect } from '@/lib/leaveAccess'

export default function LeaveRequestPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (!canApplyForLeave(currentUser.role)) {
      toast.error('You do not have permission to access this page.')
      router.push(getLeaveAccessDeniedRedirect(currentUser.role))
    }
  }, [currentUser, router])

  const [form, setForm] = useState({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.reason.trim()) {
      setError('Please provide a reason for your leave request.')
      return
    }
    if (!form.startDate || !form.endDate) {
      setError('Start date and end date are required.')
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setError('End date must be on or after start date.')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest('/leaves/create', { method: 'POST', body: JSON.stringify(form) })
      toast.success('Leave request submitted successfully!')
      router.push('/dashboard/leaves/approved?submitted=1')
    } catch (e: unknown) {
      setError((e as Error)?.message || 'Failed to submit leave')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentUser || !canApplyForLeave(currentUser.role)) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Apply for Leave</h1>
        <Link
          href="/dashboard/leaves/approved"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View My Leaves
        </Link>
      </div>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={form.leaveType} onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}>
              <SelectTrigger className="bg-white text-neutral-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                <SelectItem value="Annual Leave">Annual Leave</SelectItem>
                <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-start">Start Date</Label>
            <Input
              id="leave-start"
              className="bg-white text-neutral-900"
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={onChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leave-end">End Date</Label>
            <Input
              id="leave-end"
              className="bg-white text-neutral-900"
              type="date"
              name="endDate"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={onChange}
              required
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="leave-reason">Reason</Label>
            <Textarea
              id="leave-reason"
              className="bg-white text-neutral-900"
              name="reason"
              value={form.reason}
              onChange={onChange}
              required
              placeholder="Brief reason for leave"
            />
          </div>
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {submitting ? 'Submitting…' : 'Submit Request'}
            </Button>
            <Link href="/dashboard/leaves/approved">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
