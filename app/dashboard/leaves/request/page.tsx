'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { getCurrentUser } from '@/lib/auth'

export default function LeaveRequestPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Only authenticated employees can access this page
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (currentUser.role !== 'Executive') {
      toast.error('Access denied. This page is only for employees.')
      router.push('/dashboard')
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
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/leaves/create', { method: 'POST', body: JSON.stringify(form) })
      setForm({ leaveType: 'Casual Leave', startDate: '', endDate: '', reason: '' })
      toast.success('Leave request submitted successfully!')
    } catch (e: any) {
      setError(e?.message || 'Failed to submit leave')
    } finally {
      setSubmitting(false)
    }
  }

  // Redirect if not authenticated or not employee
  if (!currentUser || currentUser.role !== 'Employee') {
    return null
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leave Request</h1>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
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
          <div>
            <Label>Start Date</Label>
            <Input className="bg-white text-neutral-900" type="date" name="startDate" value={form.startDate} onChange={onChange} required />
          </div>
          <div>
            <Label>End Date</Label>
            <Input className="bg-white text-neutral-900" type="date" name="endDate" value={form.endDate} onChange={onChange} required />
          </div>
          <div className="md:col-span-2">
            <Label>Reason</Label>
            <Textarea className="bg-white text-neutral-900" name="reason" value={form.reason} onChange={onChange} required />
          </div>
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Request'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


