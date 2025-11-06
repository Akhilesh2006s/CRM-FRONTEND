'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { TrendingUp, ShoppingCart, CheckCircle2, Clock, XCircle } from 'lucide-react'

type SalesReportData = {
  totalSales: number
  totalRevenue: number
  averageSale: number
  salesByStatus?: Record<string, number>
  sales?: any[]
}

type ReportMetric = {
  id: string
  label: string
  value: number | string
  icon?: any
  format?: 'currency' | 'number' | 'percentage'
  color?: string
}

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<ReportMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiRequest<SalesReportData>('/reports/sales')
        
        // Transform backend data into display metrics
        const formattedMetrics: ReportMetric[] = [
          {
            id: 'total-sales',
            label: 'Total Sales',
            value: data.totalSales || 0,
            icon: ShoppingCart,
            format: 'number',
            color: 'blue'
          },
          {
            id: 'total-revenue',
            label: 'Total Revenue',
            value: data.totalRevenue || 0,
            format: 'currency',
            color: 'emerald'
          },
          {
            id: 'average-sale',
            label: 'Average Sale Value',
            value: data.averageSale || 0,
            icon: TrendingUp,
            format: 'currency',
            color: 'purple'
          },
        ]

        // Add sales by status if available
        if (data.salesByStatus) {
          Object.entries(data.salesByStatus).forEach(([status, count]) => {
            let statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/([A-Z])/g, ' $1')
            let icon = Clock
            let color = 'amber'
            
            if (status.toLowerCase().includes('completed') || status.toLowerCase().includes('closed')) {
              icon = CheckCircle2
              color = 'emerald'
            } else if (status.toLowerCase().includes('cancelled') || status.toLowerCase().includes('rejected')) {
              icon = XCircle
              color = 'red'
            }

            formattedMetrics.push({
              id: `status-${status}`,
              label: `${statusLabel} Sales`,
              value: count as number,
              icon,
              format: 'number',
              color
            })
          })
        }

        setMetrics(formattedMetrics)
      } catch (err: any) {
        console.error('Error fetching reports:', err)
        setError(err?.message || 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  const formatValue = (value: number | string, format?: string): string => {
    if (format === 'currency') {
      return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    }
    if (format === 'percentage') {
      return `${Number(value).toFixed(1)}%`
    }
    return Number(value).toLocaleString('en-IN')
  }

  const getColorClasses = (color?: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'red':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-neutral-50 text-neutral-700 border-neutral-200'
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">Sales Reports</h1>
        <p className="text-neutral-500 text-sm">Comprehensive sales analytics and metrics</p>
      </div>

      {loading ? (
        <Card className="p-6">
          <div className="text-center py-12 text-neutral-400">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-neutral-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </Card>
      ) : error ? (
        <Card className="p-6">
          <div className="text-center py-12">
            <p className="text-red-600 mb-2 font-medium">Error loading reports</p>
            <p className="text-sm text-neutral-500">{error}</p>
          </div>
        </Card>
      ) : metrics.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-12">
            <p className="text-neutral-400 mb-2">No sales data available</p>
            <p className="text-sm text-neutral-500">Sales reports will appear here once data is available</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {metrics.map((metric) => (
            <Card key={metric.id} className={`p-6 border-2 ${getColorClasses(metric.color)}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-xs font-medium text-current/70 uppercase tracking-wider mb-1">
                    {metric.label}
                  </div>
                  <div className="text-2xl font-bold text-current">
                    {formatValue(metric.value, metric.format)}
                  </div>
                </div>
                {metric.icon && (
                  <div className={`p-2 rounded-lg bg-current/10`}>
                    <metric.icon className="w-5 h-5 text-current" />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Additional details card */}
      {!loading && !error && metrics.length > 0 && (
        <Card className="p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">Sales Overview</h2>
            <p className="text-sm text-neutral-500">Detailed breakdown of sales metrics</p>
          </div>
          <div className="space-y-0">
            {metrics.map((metric, index) => (
              <div 
                key={metric.id} 
                className={`flex items-center justify-between py-4 px-4 rounded-lg transition-colors hover:bg-neutral-50/50 ${
                  index !== metrics.length - 1 ? 'border-b border-neutral-200/60' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  {metric.icon && (
                    <div className={`p-2 rounded-lg ${getColorClasses(metric.color)}`}>
                      <metric.icon className="w-4 h-4 text-current" />
                    </div>
                  )}
                  <div className="font-medium text-neutral-900 text-sm">{metric.label}</div>
                </div>
                <div className={`font-semibold text-base ${getColorClasses(metric.color).split(' ')[1]}`}>
                  {formatValue(metric.value, metric.format)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}


