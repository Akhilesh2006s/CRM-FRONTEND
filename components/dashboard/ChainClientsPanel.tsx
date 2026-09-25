'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'

type ChainClient = {
  _id: string
  school_name?: string
  school_code?: string
  contact_mobile?: string
  status?: string
  location?: string
}

export default function ChainClientsPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<ChainClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await apiRequest<ChainClient[] | { data?: ChainClient[] }>(
          `/dc-orders?assigned_to=${encodeURIComponent(userId)}&isChain=true&limit=200`
        )
        const list = Array.isArray(res) ? res : res?.data || []
        if (!cancelled) setItems(list)
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <Card className="p-0 overflow-hidden border border-blue-200 bg-blue-50/40">
      <div className="px-4 py-3 border-b border-blue-200 bg-blue-100">
        <h2 className="text-lg font-semibold text-blue-950">Chain Clients</h2>
        <p className="text-xs text-blue-800">Schools assigned to you as chain head. They also stay in the sale cycle.</p>
      </div>
      {loading && <div className="p-4 text-sm text-blue-900">Loading chain clients…</div>}
      {!loading && items.length === 0 && (
        <div className="p-4 text-sm text-blue-900">No chain clients assigned.</div>
      )}
      {!loading && items.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-100 text-blue-950">
              <th className="py-2 px-3 text-left">School</th>
              <th className="py-2 px-3 text-left">School code</th>
              <th className="py-2 px-3 text-left">Mobile</th>
              <th className="py-2 px-3 text-left">Location</th>
              <th className="py-2 px-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row._id} className="border-t border-blue-100 bg-blue-50">
                <td className="py-2 px-3 font-medium text-blue-950">{row.school_name || '—'}</td>
                <td className="py-2 px-3">{row.school_code || '—'}</td>
                <td className="py-2 px-3">{row.contact_mobile || '—'}</td>
                <td className="py-2 px-3">{row.location || '—'}</td>
                <td className="py-2 px-3">{row.status || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
