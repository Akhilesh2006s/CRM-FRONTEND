'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Calendar, CheckCircle, XCircle, Clock, ArrowLeft } from 'lucide-react'
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

type Leave = {
  _id: string
  employeeId: {
    _id: string
    name: string
    email: string
    phone?: string
    mobile?: string
    assignedCity?: string
    assignedArea?: string
  }
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
}

export default function ExecutiveManagerLeavesPage() {
  const router = useRouter()
  const params = useParams()
  const managerId = params.managerId as string
  const currentUser = getCurrentUser()
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
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
      router.push('/auth/login')
      return
    }
    loadLeaves()
  }, [statusFilter, employeeFilter, fromDate, toDate])

  const loadLeaves = async () => {
    setLoading(true)
    try {
      let url = `/executive-managers/${managerId}/leaves`
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (employeeFilter !== 'all') params.append('employeeId', employeeFilter)
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (params.toString()) url += `?${params.toString()}`
      
      const data = await apiRequest<Leave[]>(url)
      setLeaves(data || [])
    } catch (err: any) {
      toast.error('Failed to load leaves')
      console.error(err)
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
      await apiRequest(`/executive-managers/leaves/${selectedLeave._id}/approve`, {
        method: 'PUT',
        body: JSON.stringify({
          status: action === 'approve' ? 'Approved' : 'Rejected',
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
        }),
      })
      toast.success(`Leave ${action === 'approve' ? 'approved' : 'rejected'} successfully`)
      setApproveDialogOpen(false)
      loadLeaves()
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} leave`)
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">Approved</span>
      case 'Rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">Rejected</span>
      default:
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-semibold">Pending</span>
    }
  }

  const uniqueEmployees = Array.from(
    new Map(leaves.map(leave => [leave.employeeId._id, leave.employeeId])).values()
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
      </div>

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
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white"
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
                        <p className="font-medium">{leave.employeeId.name}</p>
                        <p className="text-xs text-neutral-500">{leave.employeeId.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{leave.leaveType}</TableCell>
                    <TableCell>{new Date(leave.startDate).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(leave.endDate).toLocaleDateString()}</TableCell>
                    <TableCell>{leave.days}</TableCell>
                    <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                    <TableCell>{leave.employeeId.assignedCity || '-'}</TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell>
                      {leave.status === 'Pending' ? (
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
                      ) : (
                        <div className="text-xs text-neutral-500">
                          {leave.approvedBy && (
                            <p>By: {leave.approvedBy.name}</p>
                          )}
                          {leave.approvedAt && (
                            <p>{new Date(leave.approvedAt).toLocaleDateString()}</p>
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

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? `Are you sure you want to approve this leave request from ${selectedLeave?.employeeId.name}?`
                : `Please provide a reason for rejecting this leave request from ${selectedLeave?.employeeId.name}`}
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



