'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Leave = { _id: string; employeeId: any; reason?: string; startDate: string; endDate: string; status: string; leaveType?: string }

export default function AdminPendingLeavesPage() {
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Leave[]>('/leaves?status=Pending')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const act = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await apiRequest(`/leaves/${id}/approve`, { method: 'PUT', body: JSON.stringify({ status }) })
      toast.success(`Leave ${status.toLowerCase()} successfully!`)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update leave')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Leaves</h1>
        <div className="text-sm text-neutral-600">Total: {items.length}</div>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Employee</th>
                <th className="py-2 px-3 text-left">Leave Type</th>
                <th className="py-2 px-3">From</th>
                <th className="py-2 px-3">To</th>
                <th className="py-2 px-3 text-left">Reason</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-4 px-3 text-center text-neutral-500">No pending leaves</td>
                </tr>
              )}
              {items.map((l) => (
                <tr key={l._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name || 'Unknown'}</td>
                  <td className="py-2 px-3">{l.leaveType || '-'}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.startDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3 text-center">{new Date(l.endDate).toLocaleDateString()}</td>
                  <td className="py-2 px-3">{l.reason || '-'}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => act(l._id, 'Approved')}>Approve</Button>
                      <Button size="sm" variant="secondary" onClick={() => act(l._id, 'Rejected')}>Reject</Button>
                    </div>
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


