'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'

type DCStats = {
  total: number
  byStatus: {
    Pending: number
    Warehouse: number
    Employee: number
    Completed: number
    Hold: number
  }
}

export default function ManagerDCPage() {
  const [stats, setStats] = useState<DCStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<DCStats>('/dc/stats/employee')
        setStats(data)
      } catch (_) {
        console.error('Failed to load DC stats')
      }
      setLoading(false)
    })()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Manager DC Dashboard</h1>
      </div>
      <Card className="p-4">
        {loading && <div className="p-4">Loading...</div>}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Link href="/dashboard/dc/manager/pending">
              <Card className="p-3 cursor-pointer hover:bg-sky-50 transition-colors">
                <div className="text-xs text-neutral-600">Pending DC</div>
                <div className="text-xl font-semibold text-sky-700">{stats.byStatus.Pending}</div>
                <div className="text-xs text-neutral-500 mt-1">Awaiting Review</div>
              </Card>
            </Link>
            <Link href="/dashboard/dc/manager/delivered">
              <Card className="p-3 cursor-pointer hover:bg-amber-50 transition-colors">
                <div className="text-xs text-neutral-600">Delivery Pending</div>
                <div className="text-xl font-semibold text-amber-700">{stats.byStatus.Employee}</div>
                <div className="text-xs text-neutral-500 mt-1">Awaiting Approval</div>
              </Card>
            </Link>
            <Link href="/dashboard/dc/manager/completed">
              <Card className="p-3 cursor-pointer hover:bg-green-50 transition-colors">
                <div className="text-xs text-neutral-600">Completed</div>
                <div className="text-xl font-semibold text-green-700">{stats.byStatus.Completed}</div>
                <div className="text-xs text-neutral-500 mt-1">Successfully Delivered</div>
              </Card>
            </Link>
            <Link href="/dashboard/dc/manager/hold">
              <Card className="p-3 cursor-pointer hover:bg-red-50 transition-colors">
                <div className="text-xs text-neutral-600">On Hold</div>
                <div className="text-xl font-semibold text-red-700">{stats.byStatus.Hold}</div>
                <div className="text-xs text-neutral-500 mt-1">Requires Attention</div>
              </Card>
            </Link>
            <Card className="p-3">
              <div className="text-xs text-neutral-600">Total DC</div>
              <div className="text-xl font-semibold text-neutral-900">{stats.total}</div>
              <div className="text-xs text-neutral-500 mt-1">All DCs</div>
            </Card>
          </div>
        )}
      </Card>
      <Card className="p-4">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/dc/closed">
            <Button variant="outline">View Closed Sales</Button>
          </Link>
          <Link href="/dashboard/dc/manager/pending">
            <Button>Review Pending DCs</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}





