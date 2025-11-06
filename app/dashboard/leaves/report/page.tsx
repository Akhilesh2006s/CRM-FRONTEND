'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'

type Leave = { _id: string; employeeId: any; status: 'Pending' | 'Approved' | 'Rejected'; startDate: string; endDate: string; reason?: string; leaveType?: string }

export default function LeavesReportPage() {
  const [items, setItems] = useState<Leave[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState<string>('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<Leave[]>('/leaves')
      setItems(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const counts = useMemo(() => {
    const total = items.length
    const pending = items.filter(i => i.status === 'Pending').length
    const approved = items.filter(i => i.status === 'Approved').length
    const rejected = items.filter(i => i.status === 'Rejected').length
    let today = 0
    if (date) {
      const d = new Date(date)
      today = items.filter(i => i.status === 'Approved' && new Date(i.startDate) <= d && new Date(i.endDate) >= d).length
    }
    return { total, pending, approved, rejected, today }
  }, [items, date])

  const approvedLeaves = useMemo(() => {
    if (!items) return [] as Leave[]
    if (!date) return items.filter(i => i.status === 'Approved')
    const d = new Date(date)
    return items.filter(i => i.status === 'Approved' && new Date(i.startDate) <= d && new Date(i.endDate) >= d)
  }, [items, date])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leaves Report</h1>
      <Card className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-3"><div className="text-xs text-neutral-600">Total</div><div className="text-xl font-semibold">{counts.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-neutral-600">Pending</div><div className="text-xl font-semibold">{counts.pending}</div></Card>
        <Card className="p-3"><div className="text-xs text-neutral-600">Approved</div><div className="text-xl font-semibold">{counts.approved}</div></Card>
        <Card className="p-3"><div className="text-xs text-neutral-600">Rejected</div><div className="text-xl font-semibold">{counts.rejected}</div></Card>
        <Card className="p-3"><div className="text-xs text-neutral-600">On Leave (selected date)</div><div className="text-xl font-semibold">{counts.today}</div></Card>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-700">Select date</label>
          <input type="date" className="border rounded px-2 py-1" value={date} onChange={(e)=>setDate(e.target.value)} />
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <div className="px-4 py-3 text-neutral-800 font-medium">Approved Leaves {date ? `(on ${new Date(date).toLocaleDateString()})` : ''}</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sky-50/70 border-b text-neutral-700">
              <th className="py-2 px-3 text-left">Employee</th>
              <th className="py-2 px-3 text-left">Leave Type</th>
              <th className="py-2 px-3">From</th>
              <th className="py-2 px-3">To</th>
              <th className="py-2 px-3 text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {approvedLeaves.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 px-3 text-center text-neutral-500">No approved leaves</td>
              </tr>
            )}
            {approvedLeaves.map((l) => (
              <tr key={l._id} className="border-b last:border-0">
                <td className="py-2 px-3">{typeof l.employeeId === 'string' ? l.employeeId : l.employeeId?.name || 'Unknown'}</td>
                <td className="py-2 px-3">{l.leaveType || '-'}</td>
                <td className="py-2 px-3 text-center">{new Date(l.startDate).toLocaleDateString()}</td>
                <td className="py-2 px-3 text-center">{new Date(l.endDate).toLocaleDateString()}</td>
                <td className="py-2 px-3">{l.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}


