'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { leaveTypeLabel } from '@/lib/leaveTypes'
import { LeaveApprovalStatus, type LeaveApprovalFields } from '@/components/leaves/LeaveApprovalStatus'

type Leave = LeaveApprovalFields & {
  _id: string
  startDate: string
  endDate: string
  reason?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  leaveType?: string
}

export default function EmployeeApprovedLeavesPage() {
  const { user } = usePermissions()
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!user?._id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await apiRequest<Leave[]>(`/leaves?employeeId=${user._id}`)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?._id) load()
  }, [user?._id])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Leaves</h1>
        <p className="text-sm text-neutral-600 mt-1">
          A leave is approved only after both of your approvers approve it. Each approver&apos;s decision is shown below.
        </p>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3 text-left">Approval status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-center text-neutral-500">
                    No leaves found
                  </td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{leaveTypeLabel(l.leaveType)}</td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.startDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3 text-center">
                    {new Date(l.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 align-top">
                    <LeaveApprovalStatus leave={l} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
