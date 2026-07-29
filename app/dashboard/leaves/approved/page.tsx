'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import {
  canViewMyLeaves,
  getLeaveAccessDeniedRedirect,
} from '@/lib/leaveAccess'
import { toast } from 'sonner'
import { PlusCircle } from 'lucide-react'

type Leave = {
  _id: string
  startDate: string
  endDate: string
  reason?: string
  status: 'Pending' | 'Approved' | 'Rejected'
  leaveType?: string
  rejectionReason?: string
}

export default function EmployeeApprovedLeavesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: permUser } = usePermissions()
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const currentUser = permUser || getCurrentUser()
  const showSubmittedBanner = searchParams.get('submitted') === '1'

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (!canViewMyLeaves(currentUser.role)) {
      toast.error('You do not have permission to access this page.')
      router.push(getLeaveAccessDeniedRedirect(currentUser.role))
    }
  }, [currentUser, router])

  const load = async () => {
    if (!currentUser?._id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await apiRequest<Leave[]>(`/leaves?employeeId=${currentUser._id}`)
      setItems(data)
    } catch (e: unknown) {
      toast.error((e as Error)?.message || 'Failed to load leaves')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentUser?._id && canViewMyLeaves(currentUser.role)) {
      load()
    }
  }, [currentUser?._id, currentUser?.role])

  useEffect(() => {
    if (showSubmittedBanner) {
      toast.success('Leave request submitted successfully!')
    }
  }, [showSubmittedBanner])

  if (!currentUser || !canViewMyLeaves(currentUser.role)) {
    return null
  }

  const pendingCount = items.filter((l) => l.status === 'Pending').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Leaves</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-amber-700 mt-1">
              {pendingCount} pending request{pendingCount > 1 ? 's' : ''} awaiting approval
            </p>
          )}
        </div>
        <Link href="/dashboard/leaves/request">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <PlusCircle className="h-4 w-4 mr-2" />
            Apply for Leave
          </Button>
        </Link>
      </div>

      {showSubmittedBanner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Your leave request was submitted and is pending approval.
        </div>
      )}

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
                <th className="py-2 px-3 text-left">Rejection reason</th>
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 px-3 text-center text-neutral-500">
                    No leave requests yet.{' '}
                    <Link href="/dashboard/leaves/request" className="text-blue-600 hover:underline">
                      Apply for leave
                    </Link>
                  </td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{l.leaveType || '-'}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.startDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.endDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 text-sm">
                    {l.status === 'Rejected' && l.rejectionReason ? (
                      <span className="text-red-700">{l.rejectionReason}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span
                      className={
                        l.status === 'Approved'
                          ? 'inline-flex px-2 py-1 rounded-full text-xs bg-green-100 text-green-700'
                          : l.status === 'Rejected'
                            ? 'inline-flex px-2 py-1 rounded-full text-xs bg-red-100 text-red-700'
                            : 'inline-flex px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700'
                      }
                    >
                      {l.status}
                    </span>
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
