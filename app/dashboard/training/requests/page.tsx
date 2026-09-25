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

type Person = { _id?: string; name?: string; email?: string }
type TrainingRequest = {
  _id: string
  requestedBy?: Person | string | null
  schoolName: string
  schoolCode?: string
  zone?: string
  subject: string
  preferredDate: string
  remarks?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  rejectionReason?: string
}

function personName(value?: Person | string | null) {
  if (!value) return '—'
  if (typeof value === 'string') return value
  return value.name || '—'
}

export default function TrainingRequestsReviewPage() {
  const [status, setStatus] = useState('Pending')
  const [items, setItems] = useState<TrainingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const query = status === 'All' ? '' : `?status=${status}`
      const data = await apiRequest<TrainingRequest[]>(`/training-requests${query}`)
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load training requests')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const approve = async (id: string) => {
    setActing(true)
    try {
      await apiRequest(`/training-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify({}) })
      toast.success('Training request approved')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve')
    } finally {
      setActing(false)
    }
  }

  const confirmReject = async () => {
    if (!rejectId) return
    const reason = rejectionReason.trim()
    if (!reason) {
      toast.error('Rejection reason is required')
      return
    }
    setActing(true)
    try {
      await apiRequest(`/training-requests/${rejectId}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ rejectionReason: reason }),
      })
      toast.success('Training request rejected')
      setRejectId(null)
      setRejectionReason('')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Training Requests</h1>
          <p className="text-sm text-neutral-600 mt-1">Approve or reject training requests raised by BDEs.</p>
        </div>
        <div className="w-full sm:w-48">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="bg-white mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
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
                <th className="py-2 px-3 text-left">School</th>
                <th className="py-2 px-3 text-left">Subject</th>
                <th className="py-2 px-3 text-left">Preferred date</th>
                <th className="py-2 px-3 text-left">Remarks</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-4 px-3 text-center text-neutral-500">
                    No training requests
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="border-b last:border-0">
                    <td className="py-2 px-3">{personName(item.requestedBy)}</td>
                    <td className="py-2 px-3">
                      {item.schoolName}
                      {item.schoolCode ? ` (${item.schoolCode})` : ''}
                      {item.zone ? <div className="text-xs text-neutral-500">{item.zone}</div> : null}
                    </td>
                    <td className="py-2 px-3">{item.subject}</td>
                    <td className="py-2 px-3">{new Date(item.preferredDate).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-neutral-600">
                      {item.status === 'Rejected' ? item.rejectionReason || '—' : item.remarks || '—'}
                    </td>
                    <td className="py-2 px-3">{item.status}</td>
                    <td className="py-2 px-3 text-right">
                      {item.status === 'Pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" disabled={acting} onClick={() => approve(item._id)}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            disabled={acting}
                            onClick={() => {
                              setRejectId(item._id)
                              setRejectionReason('')
                            }}
                          >
                            Reject
                          </Button>
                        </div>
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

      <Dialog open={Boolean(rejectId)} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject training request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" disabled={acting} onClick={confirmReject}>
              {acting ? 'Rejecting…' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
