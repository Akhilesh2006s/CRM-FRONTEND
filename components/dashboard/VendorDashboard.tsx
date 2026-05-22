'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Package, Truck, Clock, RefreshCw, TrendingUp, PieChart as PieChartIcon, BarChart3 } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import BarGradient from '@/components/charts/BarGradient'
import LineChart from '@/components/charts/LineChart'
import PieChart from '@/components/charts/PieChart'
import DoughnutStatus from '@/components/charts/DoughnutStatus'

type PartnerDashboardData = {
  summary: {
    totalAssignedProducts: number
    totalDcQuantityLast30Days: number
    pendingDcQuantity: number
    totalReturns: number
  }
  productWiseDcCount: { product: string; count: number }[]
  monthlyProductMovement: { month: string; label: string; quantity: number }[]
  productContribution: { product: string; count: number; percentage: number }[]
  dispatchVsPending: { dispatched: number; pending: number }
  returnTrend: { month: string; label: string; quantity: number }[]
}

const SUMMARY_CARDS = [
  { key: 'totalAssignedProducts', label: 'Total Assigned Products', icon: Package, color: 'from-indigo-50 to-indigo-100', border: 'border-indigo-200', text: 'text-indigo-700', href: '/dashboard/stocks' },
  { key: 'totalDcQuantityLast30Days', label: 'Total DC Quantity (Last 30 Days)', icon: Truck, color: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', text: 'text-emerald-700', href: '/dashboard/dcs' },
  { key: 'pendingDcQuantity', label: 'Pending DC Quantity', icon: Clock, color: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-700', href: '/dashboard/dcs' },
  { key: 'totalReturns', label: 'Total Returns', icon: RefreshCw, color: 'from-rose-50 to-rose-100', border: 'border-rose-200', text: 'text-rose-700', href: '/dashboard/dcs' },
]

export default function PartnerDashboard() {
  const [data, setData] = useState<PartnerDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const res = await apiRequest<PartnerDashboardData>('/partner-user/dashboard')
        if (mounted) setData(res)
      } catch (e) {
        if (mounted) setError((e as Error)?.message || 'Failed to load dashboard')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-5 animate-pulse bg-neutral-100 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 h-80 animate-pulse bg-neutral-100" />
          <Card className="p-6 h-80 animate-pulse bg-neutral-100" />
        </div>
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

  const summary = data?.summary ?? {
    totalAssignedProducts: 0,
    totalDcQuantityLast30Days: 0,
    pendingDcQuantity: 0,
    totalReturns: 0,
  }

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map((config) => {
          const Icon = config.icon
          const value = summary[config.key as keyof typeof summary] ?? 0
          const card = (
            <Card
              className={`p-5 bg-gradient-to-br ${config.color} border-2 ${config.border} shadow-lg hover:shadow-xl transition-all cursor-pointer h-full`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-semibold ${config.text} mb-1 uppercase tracking-wide`}>{config.label}</div>
                  <div className={`text-2xl font-bold ${config.text.replace('700', '900')}`}>{value}</div>
                </div>
                <Icon className={`w-8 h-8 ${config.text.replace('700', '500')}`} />
              </div>
            </Card>
          )
          return config.href ? (
            <Link key={config.key} href={config.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={config.key}>{card}</div>
          )
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product-wise DC/Order Count - Bar Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-neutral-900">Product-wise DC / Order Count</h3>
          </div>
          <div className="h-[280px]">
            {data?.productWiseDcCount?.length ? (
              <BarGradient
                labels={data.productWiseDcCount.map((d) => d.product.length > 15 ? d.product.slice(0, 15) + '…' : d.product)}
                values={data.productWiseDcCount.map((d) => d.count)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">No data yet</div>
            )}
          </div>
        </Card>

        {/* Monthly Product Movement - Line Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <h3 className="font-semibold text-neutral-900">Monthly Product Movement</h3>
          </div>
          <div className="h-[280px]">
            {data?.monthlyProductMovement?.length ? (
              <LineChart
                labels={data.monthlyProductMovement.map((d) => d.label)}
                datasets={[{ label: 'Quantity', data: data.monthlyProductMovement.map((d) => d.quantity), borderColor: '#059669', backgroundColor: '#05966940', fill: true }]}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">No data yet</div>
            )}
          </div>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Contribution - Pie Chart */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-neutral-900">Product Contribution Distribution</h3>
          </div>
          <div className="h-[280px]">
            {data?.productContribution?.filter((d) => d.count > 0).length ? (
              <PieChart
                data={data.productContribution
                  .filter((d) => d.count > 0)
                  .map((d, i) => ({
                    label: d.product.length > 12 ? d.product.slice(0, 12) + '…' : d.product,
                    value: d.count,
                    color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'][i % 6],
                  }))}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500 text-sm">No data yet</div>
            )}
          </div>
        </Card>

        {/* Dispatch vs Pending - Donut */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-neutral-900">Dispatch vs Pending Quantity</h3>
          </div>
          <div className="h-[280px] flex items-center justify-center">
            {data?.dispatchVsPending && (data.dispatchVsPending.dispatched > 0 || data.dispatchVsPending.pending > 0) ? (
              <div className="w-full max-w-[260px] h-[260px]">
                <DoughnutStatus
                slices={[
                  { label: 'Dispatched', value: data.dispatchVsPending.dispatched, color: '#10b981' },
                  { label: 'Pending', value: data.dispatchVsPending.pending, color: '#f59e0b' },
                ]}
              />
              </div>
            ) : (
              <div className="text-neutral-500 text-sm">No data yet</div>
            )}
          </div>
        </Card>
      </div>

      {/* Return Trend - optional */}
      {data?.returnTrend?.some((d) => d.quantity > 0) && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 text-rose-600" />
            <h3 className="font-semibold text-neutral-900">Return / Damage Trend</h3>
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
