'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type Lead = { _id: string; name?: string; zone?: string; status?: string }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const data = await apiRequest<Lead[]>('/leads')
        setLeads(data)
      } catch (_) {}
      setLoading(false)
    })()
  }, [])

  const totals = {
    total: leads.length,
    hot: leads.filter((l) => l.status === 'Hot').length,
    warm: leads.filter((l) => l.status === 'Warm').length,
    cold: leads.filter((l) => l.status === 'Cold').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Leads</h1>
      </div>
      <Card className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Total" value={totals.total} color="bg-blue-600" />
          <Stat label="Hot" value={totals.hot} color="bg-rose-600" />
          <Stat label="Warm" value={totals.warm} color="bg-amber-600" />
          <Stat label="Cold" value={totals.cold} color="bg-gray-600" />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="bg-[#eef3f9] px-4 py-3 font-semibold text-[#454c53]">Leads by Zone</div>
        <div className="p-4 text-sm text-neutral-700">
          {!loading && leads.length === 0 && 'No leads yet.'}
          {leads.slice(0, 20).map((l) => (
            <div key={l._id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="font-medium text-neutral-900">{l.name || 'Lead'}</div>
              <div className="text-neutral-500">{l.zone || '-'}</div>
            </div>
          ))}
        </div>
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


