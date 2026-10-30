'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { leaveTypeLabel } from '@/lib/leaveTypes'
import { LeaveDayTypeBadge } from '@/components/leaves/LeaveDayTypeBadge'
import { formatEmployeeCode } from '@/lib/employeeCode'
import {
  LeaveApprovalStatus,
  slotLabel,
  type LeaveApprovalFields,
} from '@/components/leaves/LeaveApprovalStatus'

type Leave = LeaveApprovalFields & {
  _id: string
  employeeId: {
    _id?: string
    name?: string
    empCode?: string
    role?: string
    executiveManagerId?: { _id?: string; name?: string } | string
    verticalManagerId?: { _id?: string; name?: string } | string
  } | string | null
  reason?: string
  startDate: string
  endDate: string
  status: string
  leaveType?: string
  dayType?: string
  halfDaySession?: string | null
  days?: number
}

export default function AdminPendingLeavesPage() {
  const { user, permissionsReady } = usePermissions()
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
      const data = await apiRequest<Leave[]>('/leaves?status=Pending')
      const rows = Array.isArray(data) ? data : []
      // Leaves waiting on this viewer's decision come first.
      rows.sort((a, b) => Number(!!b.canDecide) - Number(!!a.canDecide))
      setItems(rows)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load leaves'
      setLoadError(msg)
      setItems([])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => {
    if (permissionsReady && user?._id) load()
  }, [permissionsReady, user?._id, load])

  const getEmployeeName = (l: Leave) => {
    if (!l.employeeId) return 'Unknown'
    return typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name || 'Unknown'
  }

  const isOwnLeave = (l: Leave) =>
    !!l.employeeId && typeof l.employeeId === 'object' && l.employeeId._id === user?._id

  /** Admin can approve every pending slot at once when their own decision would not finish it. */
  const showOverride = (l: Leave) => {
    if (!l.canOverride) return false
    const pending = (l.approvals || []).filter((a) => a.status === 'Pending').map((a) => a.slot)
    const mine = l.decidableSlots || []
    return pending.some((slot) => !mine.includes(slot))
  }

  const waitingText = (l: Leave) => {
    if (isOwnLeave(l)) return 'Your own leave'
    const pending = (l.approvals || []).filter((a) => a.status === 'Pending')
    if (pending.length === 0) return '—'
    return `Waiting for ${pending.map((a) => a.label || slotLabel(a.slot)).join(' & ')}`
  }

  const approve = async (id: string, override = false) => {
    setActing(true)
    try {
      const updated = await apiRequest<Leave>(`/leaves/${id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Approved', override }),
      })
      toast.success(
        updated?.status === 'Approved'
          ? 'Leave approved by all approvers.'
          : `Your approval is recorded. ${updated?.approvalSummary || ''}`.trim()
      )
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
    const reason = rejectionReason.trim()
    if (!reason) {
      toast.error('Rejection reason is required')
      return
    }
    setActing(true)
    try {
      const body = { status: 'Rejected', rejectionReason: reason }
      await apiRequest(`/leaves/${rejectingId}/approve`, { method: 'PUT', body: JSON.stringify(body) })
      toast.success('Leave rejected — employee will see the reason in My Leaves')
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
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Leaves</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Each leave needs two approvals: BDE — Zonal Manager + HR Manager; Trainer — Product Head + HR Manager;
            other roles — Admin + HR Manager. Any rejection rejects the leave.
          </p>
        </div>
        <div className="text-sm text-neutral-600">Total: {items.length}</div>
      </div>
      {loadError && (
        <Card className="p-4 border-red-200 bg-red-50 text-red-800 text-sm">{loadError}</Card>
      )}
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Employee code</th>
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3 text-left">Approval status</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-4 px-3 text-center text-neutral-500"
                  >
                    No pending leaves
                  </td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{formatEmployeeCode(typeof l.employeeId === 'object' && l.employeeId ? l.employeeId.empCode : undefined)}</td>
                  <td className="py-2 px-3">{getEmployeeName(l)}</td>
                  <td className="py-2 px-3">
                    <div>{leaveTypeLabel(l.leaveType)}</div>
                    <LeaveDayTypeBadge leave={l} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 align-top">
                    <LeaveApprovalStatus leave={l} />
                  </td>
                  <td className="py-2 px-3 text-right align-top">
                    {l.canDecide ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-xs text-neutral-500">
                          {l.decisionIsOverride ? 'Admin override: ' : 'As '}
                          {(l.decidableSlots || []).map(slotLabel).join(' & ')}
                        </div>
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
                        {showOverride(l) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={acting}
                            onClick={() => approve(l._id, true)}
                          >
                            Approve all (override)
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-500">{waitingText(l)}</span>
                    )}
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
            <DialogDescription>
              A rejection reason is required. The employee will see it in My Leaves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">Rejection reason *</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection"
              rows={3}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={acting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={acting || !rejectionReason.trim()}
            >
              {acting ? 'Rejecting…' : 'Reject leave'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
