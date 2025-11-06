'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'

type Trainer = { _id: string; name: string; mobile?: string; zone?: string; trainerProducts?: string[]; trainerLevels?: string; trainerType?: string }

export default function InactiveTrainersPage() {
  const [items, setItems] = useState<Trainer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ (async()=>{
    setLoading(true)
    try {
      const data = await apiRequest<Trainer[]>(`/trainers?status=inactive`)
      setItems(data)
    } finally { setLoading(false) }
  })() }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inactive Trainers</h1>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Name</th>
                <th className="py-2 px-3">Mobile</th>
                <th className="py-2 px-3">Zone</th>
                <th className="py-2 px-3 text-left">Products</th>
                <th className="py-2 px-3">Levels</th>
                <th className="py-2 px-3">Type</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="py-4 px-3 text-center text-neutral-500">No inactive trainers</td></tr>
              )}
              {items.map(t => (
                <tr key={t._id} className="border-b last:border-0">
                  <td className="py-2 px-3 text-left">{t.name}</td>
                  <td className="py-2 px-3">{t.mobile || '-'}</td>
                  <td className="py-2 px-3">{t.zone || '-'}</td>
                  <td className="py-2 px-3 text-left">{(t.trainerProducts||[]).join(', ')}</td>
                  <td className="py-2 px-3">{t.trainerLevels || '-'}</td>
                  <td className="py-2 px-3">{t.trainerType || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}







