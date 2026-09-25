'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const SUBJECTS = [
  'Abacus',
  'Vedic Maths',
  'EEL',
  'IIT',
  'Financial literacy',
  'Brain bytes',
  'Spelling bee',
  'Skill pro',
  'Maths lab',
  'Codechamp',
]

type TrainingRequest = {
  _id: string
  schoolName: string
  schoolCode?: string
  subject: string
  preferredDate: string
  remarks?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  rejectionReason?: string
  createdAt: string
}

type ClientSchool = {
  id: string
  name: string
  code: string
  zone: string
}

const emptyForm = {
  schoolId: '',
  schoolName: '',
  schoolCode: '',
  zone: '',
  subject: '',
  preferredDate: '',
  remarks: '',
}

export default function TrainingRequestPage() {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<TrainingRequest[]>([])
  const [schools, setSchools] = useState<ClientSchool[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [requests, clients] = await Promise.all([
        apiRequest<TrainingRequest[]>('/training-requests/my').catch(() => [] as TrainingRequest[]),
        apiRequest<ClientSchool[]>('/training-requests/schools').catch(() => [] as ClientSchool[]),
      ])
      setItems(Array.isArray(requests) ? requests : [])
      setSchools(Array.isArray(clients) ? clients : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load requests')
      setItems([])
      setSchools([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.schoolName.trim() || !form.subject || !form.preferredDate) {
      toast.error('School, subject, and preferred date are required')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/training-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success('Training request sent to the coordinator')
      setForm(emptyForm)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Training Request</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Raise a training request. The coordinator will approve or reject it.
        </p>
      </div>

      <Card className="p-4 md:p-6 max-w-3xl">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="training-school">School *</Label>
            <select
              id="training-school"
              className="h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900"
              value={form.schoolId}
              disabled={loading}
              onChange={(e) => {
                const schoolId = e.target.value
                const school = schools.find((item) => item.id === schoolId)
                setForm((f) => ({
                  ...f,
                  schoolId,
                  schoolName: school?.name || '',
                  schoolCode: school?.code || '',
                  zone: school?.zone || '',
                }))
              }}
            >
              <option value="">
                {loading ? 'Loading schools…' : 'Select school or school code'}
              </option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.code ? `${school.name} — ${school.code}` : school.name}
                </option>
              ))}
            </select>
            {!loading && schools.length === 0 ? (
              <p className="text-xs text-neutral-500">No schools are saved under your clients yet.</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Select value={form.subject || undefined} onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preferred date *</Label>
            <Input
              className="bg-white"
              type="date"
              value={form.preferredDate}
              onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Remarks</Label>
            <Textarea
              className="bg-white"
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={3}
            />
          </div>
          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send to coordinator'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">My requests</div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">School</th>
                <th className="py-2 px-3 text-left">Subject</th>
                <th className="py-2 px-3 text-left">Preferred date</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-center text-neutral-500">
                    No training requests yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      {item.schoolName}
                      {item.schoolCode ? ` (${item.schoolCode})` : ''}
                    </td>
                    <td className="py-2 px-3">{item.subject}</td>
                    <td className="py-2 px-3">{new Date(item.preferredDate).toLocaleDateString()}</td>
                    <td className="py-2 px-3">{item.status}</td>
                    <td className="py-2 px-3 text-neutral-600">{item.rejectionReason || item.remarks || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
