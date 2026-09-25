'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Person = { name?: string }
type Complaint = {
  _id: string
  raisedBy?: Person | string | null
  subject: string
  description: string
  schoolName?: string
  schoolCode?: string
  status: 'Open' | 'Resolved'
  resolutionNote?: string
  createdAt: string
}

function personName(value?: Person | string | null) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return value.name || '—'
}

export default function ComplaintsInboxPage() {
  const [status, setStatus] = useState('Open')
  const [items, setItems] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = status === 'All' ? '' : `?status=${status}`
      const data = await apiRequest<Complaint[]>(`/complaints${query}`)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load complaints')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const confirmResolve = async () => {
    if (!resolveId) return
    setActing(true)
    try {
      await apiRequest(`/complaints/${resolveId}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ resolutionNote }),
      })
      toast.success('Complaint marked resolved')
      setResolveId(null)
      setResolutionNote('')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to resolve complaint')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">BDE Complaints</h1>
          <p className="text-sm text-neutral-600 mt-1">Complaints raised by BDEs.</p>
        </div>
        <div className="w-full sm:w-48">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
              <SelectItem value="All">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-4 text-sm text-neutral-600">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-3 text-left">BDE</th>
                <th className="py-2 px-3 text-left">Subject</th>
                <th className="py-2 px-3 text-left">School</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">Raised</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 px-3 text-center text-neutral-500">
                    No complaints
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b last:border-0 align-top">
                    <td className="py-2 px-3">{personName(item.raisedBy)}</td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{item.subject}</div>
                      <div className="text-neutral-600">{item.description}</div>
                      {item.resolutionNote ? (
                        <div className="text-xs text-neutral-500 mt-1">Note: {item.resolutionNote}</div>
                      ) : null}
                    </td>
                    <td className="py-2 px-3">
                      {item.schoolName || '—'}
                      {item.schoolCode ? ` (${item.schoolCode})` : ''}
                    </td>
                    <td className="py-2 px-3">{item.status}</td>
                    <td className="py-2 px-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-right">
                      {item.status === 'Open' ? (
                        <Button
                          size="sm"
                          disabled={acting}
                          onClick={() => {
                            setResolveId(item._id)
                            setResolutionNote('')
                          }}
                        >
                          Resolve
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={Boolean(resolveId)} onOpenChange={(open) => !open && setResolveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve complaint</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              rows={3}
              placeholder="Optional note for the BDE"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>
              Cancel
            </Button>
            <Button disabled={acting} onClick={confirmResolve}>
              {acting ? 'Saving…' : 'Mark resolved'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
