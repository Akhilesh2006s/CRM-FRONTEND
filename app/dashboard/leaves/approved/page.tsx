'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'

type Leave = { _id: string; startDate: string; endDate: string; reason?: string; status: 'Pending' | 'Approved' | 'Rejected'; leaveType?: string }

export default function EmployeeApprovedLeavesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const currentUser = getCurrentUser()

  useEffect(() => {
    // Only authenticated employees can access this page
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (currentUser.role !== 'Employee') {
      toast.error('Access denied. This page is only for employees.')
      router.push('/dashboard')
    }
  }, [currentUser, router])

  const load = async () => {
    if (!currentUser?._id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Load all leaves for this employee with any status
      const data = await apiRequest<Leave[]>(`/leaves?employeeId=${currentUser._id}`)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [currentUser?._id])

  // Redirect if not authenticated or not employee
  if (!currentUser || currentUser.role !== 'Employee') {
    return null
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leaves</h1>
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
                <th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-4 px-3 text-center text-neutral-500">No leaves found</td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{l.leaveType || '-'}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.startDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.endDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
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


