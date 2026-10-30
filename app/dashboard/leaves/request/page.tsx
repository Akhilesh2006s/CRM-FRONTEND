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
import { LEAVE_TYPE_OPTIONS, LEAVE_DAY_TYPES, HALF_DAY_SESSIONS, leaveDayCount, formatLeaveDays } from '@/lib/leaveTypes'

const LEAVE_REQUEST_PATH = '/dashboard/leaves/request'

export default function LeaveRequestPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    leaveType: 'Casual Leave',
    dayType: 'Full Day',
    halfDaySession: 'First Half',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const isHalfDay = form.dayType === 'Half Day'
  // Half Day is a single date: the end date follows the start date.
  const effectiveEndDate = isHalfDay ? form.startDate : form.endDate
  const dayCount =
    form.startDate && effectiveEndDate && new Date(effectiveEndDate) >= new Date(form.startDate)
      ? leaveDayCount({ dayType: form.dayType, startDate: form.startDate, endDate: effectiveEndDate })
      : 0
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
    if (!form.startDate || !effectiveEndDate) {
      setError(isHalfDay ? 'Leave date is required.' : 'Start date and end date are required.')
      return
    }
    if (isBeforeToday(form.startDate) || isBeforeToday(effectiveEndDate)) {
      setError('Past dates cannot be selected for leave.')
      return
    }
    if (new Date(effectiveEndDate) < new Date(form.startDate)) {
      setError('End date must be on or after start date.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        leaveType: form.leaveType,
        dayType: form.dayType,
        ...(isHalfDay ? { halfDaySession: form.halfDaySession } : {}),
        startDate: form.startDate,
        endDate: effectiveEndDate,
        reason: form.reason,
      }
      await apiRequest('/leaves/create', { method: 'POST', body: JSON.stringify(payload) })
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
                {LEAVE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Leave Duration</Label>
            <div className="mt-1 inline-flex rounded-md border bg-white p-1" role="radiogroup" aria-label="Leave duration">
              {LEAVE_DAY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.dayType === t}
                  onClick={() => setForm((f) => ({ ...f, dayType: t }))}
                  className={`px-4 py-1.5 text-sm rounded ${
                    form.dayType === t ? 'bg-neutral-900 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {t === 'Half Day' ? 'Half-Day Leave' : 'Full-Day Leave'}
                </button>
              ))}
            </div>
          </div>

          {isHalfDay && (
            <div>
              <Label htmlFor="halfDaySession">Which half</Label>
              <Select
                value={form.halfDaySession}
                onValueChange={(v) => setForm((f) => ({ ...f, halfDaySession: v }))}
              >
                <SelectTrigger id="halfDaySession" className="mt-1 bg-white">
                  <SelectValue placeholder="Select half" />
                </SelectTrigger>
                <SelectContent>
                  {HALF_DAY_SESSIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className={`grid grid-cols-1 gap-4 ${isHalfDay ? '' : 'sm:grid-cols-2'}`}>
            <div>
              <Label htmlFor="startDate">{isHalfDay ? 'Leave Date' : 'Start Date'}</Label>
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
            {!isHalfDay && (
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  name="endDate"
                  type="date"
                  min={form.startDate || minDate}
                  className="bg-white mt-1"
                  value={form.endDate}
                  onChange={onChange}
                  required
                />
              </div>
            )}
          </div>

          {dayCount > 0 && (
            <p className="text-sm text-neutral-600">
              Total: <span className="font-medium text-neutral-900">{formatLeaveDays(dayCount)}</span>
              {isHalfDay ? ` (${form.halfDaySession})` : ''}
            </p>
          )}

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
