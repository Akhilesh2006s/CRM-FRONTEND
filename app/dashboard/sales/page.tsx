'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type Sale = { _id: string; status?: string; totalAmount?: number }

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Sale[]>('/sales')
        setSales(data)
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  const totalRevenue = sales.reduce((s, a) => s + (a.totalAmount || 0), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Sales</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total Sales" value={sales.length} color="bg-pink-600" />
        <Stat label="Pending" value={sales.filter(s => s.status === 'Pending').length} color="bg-amber-600" />
        <Stat label="Revenue" value={`₹${totalRevenue.toFixed(0)}`} color="bg-green-700" />
      </div>
      <Card className="p-4 text-sm text-neutral-700">
        {!loading && sales.length === 0 && 'No sales yet.'}
        {sales.slice(0, 20).map((s) => (
          <div key={s._id} className="flex justify-between border-b last:border-0 py-2">
            <div className="text-neutral-900">{s.status || 'Sale'}</div>
            <div>{s.totalAmount ?? 0}</div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`${color} text-white rounded-md p-4`}>
      <div className="text-xs opacity-90">{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  )
}


