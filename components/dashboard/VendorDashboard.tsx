'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Package, Boxes, AlertTriangle, RefreshCw } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import LineChart from '@/components/charts/LineChart'

/** Vendor / Partner view: their products, stock and returns. DCs are internal and not shown. */
type PartnerDashboardData = {
  summary: {
    totalAssignedProducts: number
    totalReturns: number
  }
  returnTrend: { month: string; label: string; quantity: number }[]
}

type StockItem = {
  _id: string
  productName: string
  productCode?: string
  availableQuantity: number
  minStock?: number
  isLowStock?: boolean
}

export default function PartnerDashboard() {
  const [data, setData] = useState<PartnerDashboardData | null>(null)
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const [dashboard, stockRows] = await Promise.all([
          apiRequest<PartnerDashboardData>('/partner-user/dashboard'),
          apiRequest<StockItem[]>('/partner-user/stocks').catch(() => []),
        ])
        if (!mounted) return
        setData(dashboard)
        setStocks(Array.isArray(stockRows) ? stockRows : [])
      } catch (e) {
        if (mounted) setError((e as Error)?.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-5 animate-pulse bg-neutral-100 h-24" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-red-600">{error}</p>
      </Card>
    )
  }

  const lowStock = stocks.filter((s) => s.isLowStock)
  const cards = [
    { label: 'Assigned Products', value: data?.summary?.totalAssignedProducts ?? 0, icon: Package, tone: 'indigo' },
    { label: 'Units in Stock', value: stocks.reduce((sum, s) => sum + (Number(s.availableQuantity) || 0), 0), icon: Boxes, tone: 'emerald' },
    { label: 'Low Stock Items', value: lowStock.length, icon: AlertTriangle, tone: 'amber' },
    { label: 'Total Returns', value: data?.summary?.totalReturns ?? 0, icon: RefreshCw, tone: 'rose' },
  ] as const
  const toneClass: Record<string, string> = {
    indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700',
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700',
    amber: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
    rose: 'from-rose-50 to-rose-100 border-rose-200 text-rose-700',
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className={`p-5 bg-gradient-to-br border-2 shadow-lg ${toneClass[card.tone]}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold mb-1 uppercase tracking-wide">{card.label}</div>
                  <div className="text-2xl font-bold">{card.value}</div>
                </div>
                <Icon className="w-8 h-8 opacity-70" />
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Boxes className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-neutral-900">Stock of your products</h3>
        </div>
        {stocks.length === 0 ? (
          <p className="text-sm text-neutral-500">No stock records for your products yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-600">
                  <th className="py-2 pr-3 font-semibold">Product</th>
                  <th className="py-2 pr-3 font-semibold">Code</th>
                  <th className="py-2 pr-3 font-semibold text-right">Available</th>
                  <th className="py-2 font-semibold text-right">Min Stock</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s._id} className={`border-b last:border-0 ${s.isLowStock ? 'bg-amber-50' : ''}`}>
                    <td className="py-2 pr-3 font-medium">{s.productName}</td>
                    <td className="py-2 pr-3 text-neutral-600">{s.productCode || '-'}</td>
                    <td className="py-2 pr-3 text-right">{s.availableQuantity}</td>
                    <td className="py-2 text-right text-neutral-600">{s.minStock ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data?.returnTrend?.some((d) => d.quantity > 0) && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-rose-600" />
            <h3 className="font-semibold text-neutral-900">Return Trend</h3>
          </div>
          <div className="h-[240px]">
            <LineChart
              labels={data.returnTrend.map((d) => d.label)}
              datasets={[{ label: 'Returns', data: data.returnTrend.map((d) => d.quantity), borderColor: '#e11d48', backgroundColor: '#e11d4840', fill: true }]}
              height={240}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
