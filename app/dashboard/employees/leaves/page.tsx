'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

type Leave = {
  _id: string
  employeeId: { _id: string; name: string } | string
  reason?: string
  status: string
  startDate: string
  endDate: string
  days: number
}

export default function PendingLeavesPage() {
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

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

  const filtered = items.filter(l => {
    const name = typeof l.employeeId === 'string' ? l.employeeId : (l.employeeId?.name || '')
    return name.toLowerCase().includes(q.toLowerCase()) || (l.reason || '').toLowerCase().includes(q.toLowerCase())
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Pending Leaves List</h1>
      <div className="flex gap-2">
        <Input placeholder="Search by name/reason" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={load}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-neutral-600 border-b bg-neutral-50">
              <th className="py-2 px-3 text-left">Employee</th>
              <th className="py-2 px-3 text-left">Reason</th>
              <th className="py-2 px-3">From</th>
              <th className="py-2 px-3">To</th>
              <th className="py-2 px-3">Days</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.map((l) => (
              <tr key={l._id} className="border-b last:border-0">
                <td className="py-2 px-3">{typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name}</td>
                <td className="py-2 px-3">{l.reason || '-'}</td>
                <td className="py-2 px-3 text-center">{new Date(l.startDate).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-center">{new Date(l.endDate).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-center">{l.days}</td>
                <td className="py-2 px-3 text-center">{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <div className="p-4 text-neutral-500">No pending leaves</div>}
      </Card>
    </div>
  )
}








