'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { LeaveApprovalStatus, type LeaveApprovalFields } from '@/components/leaves/LeaveApprovalStatus'
import { leaveTypeLabel } from '@/lib/leaveTypes'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Calendar, CheckCircle, XCircle, ArrowLeft, PlusCircle, RefreshCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'

type LeaveEmployee = {
  _id: string
  name: string
  email: string
  phone?: string
  mobile?: string
  assignedCity?: string
  assignedArea?: string
}

/** A request that never answers must not leave the page on "Loading..." forever. */
const LOAD_TIMEOUT_MS = 20000

async function requestWithTimeout<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS)
  try {
    return await apiRequest<T>(path, { signal: controller.signal })
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      throw new Error('The server took too long to respond. Please retry.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

type Leave = {
  _id: string
  employeeId: LeaveEmployee | null
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'Pending' | 'Approved' | 'Rejected'
  approvedBy?: {
    name: string
    email: string
  }
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
  approvals?: LeaveApprovalFields['approvals']
  approvalSummary?: string
  canDecide?: boolean
}

export default function ExecutiveManagerLeavesPage() {
  const router = useRouter()
  const params = useParams()
  const managerId = params.managerId as string
  const currentUser = getCurrentUser()
  const isOwnPage = !!currentUser?._id && currentUser._id === managerId
  const [tab, setTab] = useState<'team' | 'mine'>('team')
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [myLeaves, setMyLeaves] = useState<Leave[]>([])
  const [myLoading, setMyLoading] = useState(false)
  const [myError, setMyError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [employeeFilter, setEmployeeFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null)
  const [action, setAction] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!currentUser) {
      setLoading(false)
      router.push('/auth/login')
      return
    }
    if (!managerId) {
      setLoading(false)
      setLoadError('Zonal Manager not found in the page address.')
      return
    }
    loadLeaves()
  }, [managerId, statusFilter, employeeFilter, fromDate, toDate])

  useEffect(() => {
    if (tab === 'mine') loadMyLeaves()
  }, [tab])

  const loadMyLeaves = async () => {
    if (!currentUser?._id) return
    setMyLoading(true)
    setMyError(null)
    try {
      const data = await requestWithTimeout<Leave[]>(`/leaves?employeeId=${currentUser._id}`)
      setMyLeaves(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      setMyError(err instanceof Error ? err.message : 'Failed to load your leaves')
      setMyLeaves([])
    } finally {
      setMyLoading(false)
    }
  }

  const loadLeaves = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      let url = `/executive-managers/${managerId}/leaves`
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (employeeFilter !== 'all') params.append('employeeId', employeeFilter)
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (params.toString()) url += `?${params.toString()}`
      
      const data = await requestWithTimeout<Leave[]>(url)
      setLeaves(Array.isArray(data) ? data : [])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load leaves'
      setLoadError(message)
      setLeaves([])
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const openApproveDialog = (leave: Leave, actionType: 'approve' | 'reject') => {
    setSelectedLeave(leave)
    setAction(actionType)
    setRejectionReason('')
    setApproveDialogOpen(true)
  }

  const handleApproveReject = async () => {
    if (!selectedLeave) return

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    setProcessing(true)
    try {
      await apiRequest(`/leaves/${selectedLeave._id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: action === 'approve' ? 'Approved' : 'Rejected',
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
        }),
      })
      toast.success(
        action === 'approve'
          ? 'Your approval is recorded. The leave is approved once HR Manager also approves.'
          : 'Leave rejected'
      )
      setApproveDialogOpen(false)
      loadLeaves()
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} leave`)
    } finally {
      setProcessing(false)
    }
  }

  const uniqueEmployees = Array.from(
    new Map(
      leaves
        .filter((leave) => leave.employeeId)
        .map((leave) => [leave.employeeId!._id, leave.employeeId!])
    ).values()
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/executive-managers/${managerId}/dashboard`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leave Management</h1>
        </div>
        <Link href="/dashboard/leaves/request">
          <Button size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Apply for Leave
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={() => setTab('team')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === 'team' ? 'border-sky-600 text-sky-700 font-medium' : 'border-transparent text-neutral-600'}`}
        >
          {isOwnPage ? 'My BDEs\u2019 Leaves' : 'Team Leaves'}
        </button>
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`px-4 py-2 text-sm -mb-px border-b-2 ${tab === 'mine' ? 'border-sky-600 text-sky-700 font-medium' : 'border-transparent text-neutral-600'}`}
        >
          My Leaves
        </button>
      </div>

      {tab === 'mine' && (
        <Card className="p-4 bg-white border border-neutral-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              My Leaves
            </h3>
            <Button variant="outline" size="sm" onClick={loadMyLeaves} disabled={myLoading}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            Your leave is approved after both Admin and HR Manager approve it.
          </p>
          {myLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : myError ? (
            <div className="text-center py-8 text-red-600 text-sm">{myError}</div>
          ) : myLeaves.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              You have not applied for any leave yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Approval status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaves.map((leave) => (
                    <TableRow key={leave._id}>
                      <TableCell>{leaveTypeLabel(leave.leaveType)}</TableCell>
                      <TableCell>{new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                      <TableCell>{new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                      <TableCell>{leave.days}</TableCell>
                      <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                      <TableCell className="align-top">
                        <LeaveApprovalStatus leave={leave} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      {tab === 'team' && (
      <>

      {/* Filters */}
      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Employee</Label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {uniqueEmployees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white"
              allowPastDates
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white"
              allowPastDates
            />
          </div>
        </div>
      </Card>

      {/* Leaves Table */}
      <Card className="p-4 bg-white border border-neutral-200">
        <h3 className="font-semibold mb-4 flex items-center">
          <Calendar className="w-4 h-4 mr-2" />
          Employee Leaves
        </h3>
        {loading ? (
          <div className="text-center py-8">Loading...</div>
        ) : loadError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button variant="outline" size="sm" onClick={loadLeaves}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          </div>
        ) : leaves.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No leaves found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{leave.employeeId?.name || 'Unknown employee'}</p>
                        <p className="text-xs text-neutral-500">{leave.employeeId?.email || ''}</p>
                      </div>
                    </TableCell>
                    <TableCell>{leaveTypeLabel(leave.leaveType)}</TableCell>
                    <TableCell>{new Date(leave.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                    <TableCell>{new Date(leave.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                    <TableCell>{leave.days}</TableCell>
                    <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                    <TableCell>{leave.employeeId?.assignedCity || '-'}</TableCell>
                    <TableCell className="align-top">
                      <LeaveApprovalStatus leave={leave} />
                    </TableCell>
                    <TableCell>
                      {leave.status === 'Pending' && leave.canDecide ? (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openApproveDialog(leave, 'approve')}
                            className="text-green-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openApproveDialog(leave, 'reject')}
                            className="text-red-600"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : leave.status === 'Pending' ? (
                        <span className="text-xs text-neutral-500">Your decision is recorded or not required</span>
                      ) : (
                        <div className="text-xs text-neutral-500">
                          {leave.approvedBy && (
                            <p>By: {leave.approvedBy.name}</p>
                          )}
                          {leave.approvedAt && (
                            <p>{new Date(leave.approvedAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                          )}
                          {leave.rejectionReason && (
                            <p className="text-red-600 mt-1">Reason: {leave.rejectionReason}</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      </>
      )}

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? `Are you sure you want to approve this leave request from ${selectedLeave?.employeeId?.name || 'this employee'}?`
                : `Please provide a reason for rejecting this leave request from ${selectedLeave?.employeeId?.name || 'this employee'}`}
            </DialogDescription>
          </DialogHeader>
          {action === 'reject' && (
            <div className="space-y-4">
              <div>
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection"
                  className="bg-white"
                  rows={4}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleApproveReject}
              disabled={processing || (action === 'reject' && !rejectionReason.trim())}
              className={action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {processing ? 'Processing...' : action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



