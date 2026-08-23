'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { usePermissions } from '@/components/permissions/PermissionsProvider'
import { canAccessHref } from '@/lib/access'
import {
  TrendingUp,
  FileText,
  MapPin,
  Users,
  MessageSquare,
  History,
  Package,
  Truck,
  RefreshCw,
  Receipt,
  GraduationCap,
  CheckCircle2,
  Clock,
} from 'lucide-react'

type SalesReportData = {
  totalSales: number
  totalRevenue: number
  averageSale: number
  salesByStatus?: Record<string, number>
}

const REPORT_LINKS = [
  { href: '/dashboard/reports/leads', label: 'Leads', description: 'Open, closed, and follow-up leads', icon: FileText },
  { href: '/dashboard/reports/sales-visit', label: 'Sales Visit', description: 'School visits from DC records', icon: MapPin },
  { href: '/dashboard/reports/employee-track', label: 'Employee Track', description: 'Login and location activity', icon: Users },
  { href: '/dashboard/reports/contact-queries', label: 'Contact Enquiries', description: 'School contact enquiry log', icon: MessageSquare },
  { href: '/dashboard/reports/change-logs', label: 'Change Logs', description: 'Creates, updates, and deletes', icon: History },
  { href: '/dashboard/reports/stock', label: 'Stock', description: 'Warehouse inventory snapshot', icon: Package },
  { href: '/dashboard/reports/dc', label: 'DC', description: 'Delivery challan pipeline', icon: Truck },
  { href: '/dashboard/reports/returns', label: 'Returns', description: 'Executive and warehouse returns', icon: RefreshCw },
  { href: '/dashboard/reports/expenses', label: 'All Expenses', description: 'Approved and pending expenses', icon: Receipt },
  { href: '/dashboard/reports/training-service', label: 'Training & Service', description: 'Assigned trainings and services', icon: GraduationCap },
]

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function ReportsPage() {
  const { user, permissionsReady } = usePermissions()
  const [metrics, setMetrics] = useState<SalesReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const links = useMemo(
    () => REPORT_LINKS.filter((item) => canAccessHref(user, item.href)),
    [user]
  )

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const data = await apiRequest<SalesReportData>('/reports/sales')
        setMetrics(data)
      } catch {
        setMetrics(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statusEntries = Object.entries(metrics?.salesByStatus || {})

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Reports</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Pipeline totals from DCs. Open a report below for filters and export.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-neutral-200">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Total DCs</div>
          <div className="text-2xl font-semibold text-neutral-900 mt-1">
            {loading ? '—' : Number(metrics?.totalSales || 0).toLocaleString('en-IN')}
          </div>
        </Card>
        <Card className="p-5 border border-neutral-200">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Pipeline value</div>
          <div className="text-2xl font-semibold text-neutral-900 mt-1">
            {loading ? '—' : formatInr(metrics?.totalRevenue || 0)}
          </div>
        </Card>
        <Card className="p-5 border border-neutral-200">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Average DC value</div>
          <div className="flex items-center gap-2 mt-1">
            <TrendingUp className="w-4 h-4 text-neutral-400" />
            <span className="text-2xl font-semibold text-neutral-900">
              {loading ? '—' : formatInr(metrics?.averageSale || 0)}
            </span>
          </div>
        </Card>
      </div>

      {statusEntries.length > 0 && (
        <Card className="p-5 border border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">DCs by status</h2>
          <div className="flex flex-wrap gap-2">
            {statusEntries.map(([status, count]) => {
              const closed = /completed|closed/i.test(status)
              const hold = /hold|cancel/i.test(status)
              return (
                <span
                  key={status}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border ${
                    closed
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : hold
                        ? 'bg-red-50 text-red-800 border-red-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {closed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {status.replace(/_/g, ' ')}: {count}
                </span>
              )
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(permissionsReady ? links : REPORT_LINKS).map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-5 h-full border border-neutral-200 hover:border-neutral-400 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded bg-neutral-100">
                    <Icon className="w-5 h-5 text-neutral-700" />
                  </div>
                  <div>
                    <div className="font-semibold text-neutral-900">{item.label}</div>
                    <p className="text-sm text-neutral-500 mt-1">{item.description}</p>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
