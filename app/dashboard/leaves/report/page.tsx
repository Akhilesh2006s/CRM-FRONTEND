'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { canViewLeavesReport } from '@/lib/leaveAccess'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Leave = {
  _id: string
  employeeId: {
    name?: string
    executiveManagerId?: { name?: string } | string
  } | string
  status: 'Pending' | 'Approved' | 'Rejected'
  startDate: string
  endDate: string
  reason?: string
  leaveType?: string
  approvedBy?: { name?: string } | string
  approvedAt?: string
}

export default function LeavesReportPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (!canViewLeavesReport(currentUser.role)) {
      toast.error('You do not have permission to access this page.')
      router.push('/dashboard')
    }
  }, [currentUser, router])

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Leave[]>('/leaves')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser && canViewLeavesReport(currentUser.role)) {
      load()
    }
  }, [currentUser?.role])

  const counts = useMemo(() => {
    const total = items.length
    const pending = items.filter((i) => i.status === 'Pending').length
    const approved = items.filter((i) => i.status === 'Approved').length
    const rejected = items.filter((i) => i.status === 'Rejected').length
    let onLeave = 0
    if (date) {
      const d = new Date(date)
      onLeave = items.filter(
        (i) =>
          i.status === 'Approved' &&
          new Date(i.startDate) <= d &&
          new Date(i.endDate) >= d
      ).length
    }
    return { total, pending, approved, rejected, onLeave }
  }, [items, date])

  const filteredLeaves = useMemo(() => {
    let list = [...items]
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter)
    }
    if (date && statusFilter === 'Approved') {
      const d = new Date(date)
      list = list.filter(
        (i) =>
          i.status === 'Approved' &&
          new Date(i.startDate) <= d &&
          new Date(i.endDate) >= d
      )
    }
    return list.sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
  }, [items, date, statusFilter])

  const employeeName = (l: Leave) =>
    typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name || 'Unknown'

  const managerName = (l: Leave) => {
    if (typeof l.employeeId === 'string') return '—'
    const mgr = l.employeeId?.executiveManagerId
    if (!mgr) return '— Not assigned'
    if (typeof mgr === 'string') return mgr
    return mgr.name || '—'
  }

  const approvedByName = (l: Leave) => {
    if (!l.approvedBy) return '—'
    if (typeof l.approvedBy === 'string') return l.approvedBy
    return l.approvedBy.name || '—'
  }

  const approvalDate = (l: Leave) =>
    l.approvedAt ? new Date(l.approvedAt).toLocaleDateString() : '—'

  if (!currentUser || !canViewLeavesReport(currentUser.role)) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leaves Report</h1>
        <Link href="/dashboard/leaves/pending">
          <Button variant="outline" size="sm">
            Pending approvals
          </Button>
        </Link>
      </div>

      <Card className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3">
          <div className="text-xs text-neutral-600">Total</div>
          <div className="text-xl font-semibold">{counts.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-neutral-600">Pending</div>
          <div className="text-xl font-semibold">{counts.pending}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-neutral-600">Approved</div>
          <div className="text-xl font-semibold">{counts.approved}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-neutral-600">Rejected</div>
          <div className="text-xl font-semibold">{counts.rejected}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-neutral-600">On leave (date)</div>
          <div className="text-xl font-semibold">{counts.onLeave}</div>
        </Card>
      </Card>

      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label htmlFor="leave-report-status">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="leave-report-status" className="w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="leave-report-date">On leave date (approved only)</Label>
          <Input
            id="leave-report-date"
            type="date"
            className="bg-white w-[180px]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4 text-sm text-neutral-600">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Manager</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Approved by</th>
                <th className="py-2 px-3">Approval date</th>
                <th className="py-2 px-3 text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 px-3 text-center text-neutral-500">
                    No leaves match filters
                  </td>
                </tr>
              )}
              {filteredLeaves.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{employeeName(l)}</td>
                  <td className="py-2 px-3 text-sm text-neutral-600">{managerName(l)}</td>
                  <td className="py-2 px-3 text-center">{l.status}</td>
                  <td className="py-2 px-3">{l.leaveType || '-'}</td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.startDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3">{approvedByName(l)}</td>
                  <td className="py-2 px-3 text-center">{approvalDate(l)}</td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
