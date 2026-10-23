'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api'

type Movement = {
  _id: string
  at: string
  type: 'In' | 'Out' | 'Return' | 'Adjustment'
  quantity: number
  reason: string
  product: string
  series?: string
  subject?: string
  level?: string
  stockNow?: number
  by?: string
}

const TYPE_LABEL: Record<Movement['type'], { label: string; className: string; sign: string }> = {
  Out: { label: 'DC dispatched', className: 'bg-red-100 text-red-700', sign: '−' },
  Return: { label: 'Return accepted', className: 'bg-green-100 text-green-700', sign: '+' },
  In: { label: 'Stock in', className: 'bg-blue-100 text-blue-700', sign: '+' },
  Adjustment: { label: 'Adjustment', className: 'bg-neutral-100 text-neutral-700', sign: '±' },
}

const FILTERS: Array<{ value: '' | Movement['type']; label: string }> = [
  { value: '', label: 'All' },
  { value: 'Out', label: 'DC dispatched' },
  { value: 'Return', label: 'Returns accepted' },
  { value: 'In', label: 'Stock in' },
]

/** Every automatic and manual stock change: DCs finalised by the warehouse take stock out,
 * returns accepted by the Warehouse Manager (sellable) put it back. */
export function StockMovementsCard() {
  const [type, setType] = useState<'' | Movement['type']>('')
  const [rows, setRows] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiRequest<Movement[]>(`/warehouse/stock-movements?limit=200${type ? `&type=${type}` : ''}`)
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Stock Movements</h2>
          <p className="text-xs text-neutral-500">
            Stock goes down automatically when the warehouse finalises a DC, and up when the Warehouse Manager accepts a sellable return.
          </p>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button key={f.label} size="sm" variant={type === f.value ? 'default' : 'outline'} onClick={() => setType(f.value)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-neutral-500 py-4 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500 py-4 text-center">No stock movements yet.</p>
      ) : (
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-neutral-600">
                <th className="py-2 pr-3 font-semibold">When</th>
                <th className="py-2 pr-3 font-semibold">Type</th>
                <th className="py-2 pr-3 font-semibold">Product</th>
                <th className="py-2 pr-3 font-semibold text-right">Qty</th>
                <th className="py-2 pr-3 font-semibold text-right">Stock now</th>
                <th className="py-2 pr-3 font-semibold">Reference</th>
                <th className="py-2 font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const meta = TYPE_LABEL[m.type] || TYPE_LABEL.Adjustment
                const detail = [m.series, m.subject, m.level].filter(Boolean).join(' · ')
                return (
                  <tr key={m._id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(m.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium">{m.product}</div>
                      {detail && <div className="text-xs text-neutral-500">{detail}</div>}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{meta.sign}{m.quantity}</td>
                    <td className="py-2 pr-3 text-right">{m.stockNow ?? '-'}</td>
                    <td className="py-2 pr-3 text-xs text-neutral-600 max-w-xs">{m.reason || '-'}</td>
                    <td className="py-2 text-xs text-neutral-600">{m.by || '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
