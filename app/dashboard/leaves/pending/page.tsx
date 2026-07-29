'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type Leave = {
  _id: string
  employeeId: {
    _id?: string
    name?: string
    executiveManagerId?: { _id?: string; name?: string } | string
  } | string | null
  reason?: string
  startDate: string
  endDate: string
  status: string
  leaveType?: string
}

export default function AdminPendingLeavesPage() {
  const { user, permissionsReady } = usePermissions()
  const isExecutiveManager = user?.role === 'Executive Manager'
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!user?._id) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = isExecutiveManager
        ? await apiRequest<Leave[]>(`/executive-managers/${user._id}/leaves?status=Pending`)
        : await apiRequest<Leave[]>('/leaves?status=Pending')
      setItems(Array.isArray(data) ? data : [])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load leaves'
      setLoadError(msg)
      setItems([])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [user?._id, isExecutiveManager])

  useEffect(() => {
    if (permissionsReady && user?._id) load()
  }, [permissionsReady, user?._id, load])

  const getEmployeeName = (l: Leave) => {
    if (!l.employeeId) return 'Unknown'
    return typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name || 'Unknown'
  }

  const getManagerName = (l: Leave) => {
    if (!l.employeeId || typeof l.employeeId === 'string') return '—'
    const mgr = l.employeeId.executiveManagerId
    if (!mgr) return '— Not assigned'
    if (typeof mgr === 'string') return mgr
    return mgr.name || '—'
  }

  const approve = async (id: string) => {
    setActing(true)
    try {
      const url = isExecutiveManager
        ? `/executive-managers/leaves/${id}/approve`
        : `/leaves/${id}/approve`
      await apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Approved' }),
      })
      toast.success('Leave approved. Employee marked inactive for leave period.')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve leave')
    } finally {
      setActing(false)
    }
  }

  const openReject = (id: string) => {
    setRejectingId(id)
    setRejectionReason('')
    setRejectDialogOpen(true)
  }

  const confirmReject = async () => {
    if (!rejectingId) return
    setActing(true)
    try {
      const body = { status: 'Rejected', rejectionReason: rejectionReason.trim() || undefined }
      const url = isExecutiveManager
        ? `/executive-managers/leaves/${rejectingId}/approve`
        : `/leaves/${rejectingId}/approve`
      await apiRequest(url, { method: 'PUT', body: JSON.stringify(body) })
      toast.success('Leave rejected')
      setRejectDialogOpen(false)
      setRejectingId(null)
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject leave')
    } finally {
      setActing(false)
    }
  }

  if (!permissionsReady) {
    return <div className="p-6 text-neutral-500 text-sm">Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Leaves</h1>
        <div className="text-sm text-neutral-600">Total: {items.length}</div>
      </div>
      {!isExecutiveManager && (
        <p className="text-sm text-neutral-600">
          Assign employees to managers in{' '}
          <Link href="/dashboard/employees/active" className="text-blue-600 underline">
            Active Employees
          </Link>{' '}
          (Executive Manager role) so managers can approve leaves for their team.
        </p>
      )}
      {loadError && (
        <Card className="p-4 border-red-200 bg-red-50 text-red-800 text-sm">{loadError}</Card>
      )}
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Employee</th>
                {!isExecutiveManager && <th className="py-2 px-3 text-left">Manager</th>}
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={isExecutiveManager ? 6 : 7}
                    className="py-4 px-3 text-center text-neutral-500"
                  >
                    No pending leaves
                  </td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{getEmployeeName(l)}</td>
                  {!isExecutiveManager && (
                    <td className="py-2 px-3 text-sm text-neutral-600">{getManagerName(l)}</td>
                  )}
                  <td className="py-2 px-3">{l.leaveType || '-'}</td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.startDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" disabled={acting} onClick={() => approve(l._id)}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={acting}
                        onClick={() => openReject(l._id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>Optional: provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Rejection reason</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={acting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={acting}>
              {acting ? 'Rejecting…' : 'Reject leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
