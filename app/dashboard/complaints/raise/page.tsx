'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Complaint = {
  _id: string
  subject: string
  description: string
  schoolName?: string
  status: 'Open' | 'Resolved'
  resolutionNote?: string
  createdAt: string
}

const emptyForm = { subject: '', description: '', schoolName: '', schoolCode: '' }

export default function RaiseComplaintPage() {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [items, setItems] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Complaint[]>('/complaints/my')
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load complaints')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error('Subject and description are required')
      return
    }
    setSubmitting(true)
    try {
      await apiRequest('/complaints', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast.success('Complaint sent to the coordinator')
      setForm(emptyForm)
      load()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send complaint')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Raise Complaint</h1>
        <p className="text-sm text-neutral-600 mt-1">Send a complaint to the coordinator.</p>
      </div>

      <Card className="p-4 md:p-6 max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Subject *</Label>
            <Input
              className="bg-white"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School name</Label>
              <Input
                className="bg-white"
                value={form.schoolName}
                onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>School code</Label>
              <Input
                className="bg-white"
                value={form.schoolCode}
                onChange={(e) => setForm((f) => ({ ...f, schoolCode: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description *</Label>
            <Textarea
              className="bg-white"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send to coordinator'}
          </Button>
        </form>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <div className="px-4 py-3 border-b font-medium">My complaints</div>
        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">Subject</th>
                <th className="py-2 px-3 text-left">School</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Raised</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 px-3 text-center text-neutral-500">
                    No complaints yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b last:border-0 align-top">
                    <td className="py-2 px-3">
                      <div className="font-medium">{item.subject}</div>
                      <div className="text-neutral-600">{item.description}</div>
                      {item.resolutionNote ? (
                        <div className="text-xs text-neutral-500 mt-1">Note: {item.resolutionNote}</div>
                      ) : null}
                    </td>
                    <td className="py-2 px-3">{item.schoolName || '—'}</td>
                    <td className="py-2 px-3">{item.status}</td>
                    <td className="py-2 px-3">{new Date(item.createdAt).toLocaleDateString()}</td>
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
