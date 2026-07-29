'use client'

import { useState } from 'react'
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
import { todayDateString, isBeforeToday } from '@/lib/todayDate'

const LEAVE_REQUEST_PATH = '/dashboard/leaves/request'

export default function LeaveRequestPage() {
  const router = useRouter()
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
    if (isBeforeToday(form.startDate) || isBeforeToday(form.endDate)) {
      setError('Past dates cannot be selected for leave.')
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

  const minDate = todayDateString()

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Apply for Leave</h1>
        <Link href="/dashboard/leaves/approved">
          <Button variant="outline">View My Leaves</Button>
        </Link>
      </div>

      <Card className="p-6 shadow-sm max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
          )}

          <div>
            <Label htmlFor="leaveType">Leave Type</Label>
            <Select
              value={form.leaveType}
              onValueChange={(v) => setForm((f) => ({ ...f, leaveType: v }))}
            >
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                <SelectItem value="Earned Leave">Earned Leave</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                min={minDate}
                className="bg-white mt-1"
                value={form.startDate}
                onChange={onChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                min={minDate}
                className="bg-white mt-1"
                value={form.endDate}
                onChange={onChange}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              className="bg-white mt-1 min-h-[100px]"
              value={form.reason}
              onChange={onChange}
              required
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Leave Request'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
