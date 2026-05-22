'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Zap, TrendingUp, DollarSign, GraduationCap, AlertTriangle, X, Minimize2, Calculator, MapPin, Package, ShoppingCart, Sparkles, Users, Shield, CalendarCheck2, PlusCircle, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import BarGradient from '@/components/charts/BarGradient'
import AreaGradient from '@/components/charts/AreaGradient'
import DoughnutStatus from '@/components/charts/DoughnutStatus'
import PieChart from '@/components/charts/PieChart'
import LineChart from '@/components/charts/LineChart'
import MultiBarChart from '@/components/charts/MultiBarChart'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { getCurrentUser } from '@/lib/auth'
import VendorDashboard from '@/components/dashboard/VendorDashboard'
import {
  AI_TEASER_TOOLS,
  canViewChangeLogs,
  DASHBOARD_ALERTS_VIEW_ALL,
  getAlertHref,
  getStatHref,
} from '@/lib/dashboardLinks'
import {
  canManageTeamLeaves,
  getDashboardLeaveCards,
  showDashboardLeaveSection,
} from '@/lib/leaveAccess'

const STAT_CONFIG = [
  { label: 'Active Leads', icon: Zap, accent: 'sky' },
  { label: 'Total Sales', icon: DollarSign, accent: 'rose' },
  { label: 'Existing Schools', icon: GraduationCap, accent: 'orange' },
  { label: 'Pending Trainings', icon: TrendingUp, accent: 'amber' },
  { label: 'Completed Trainings', icon: TrendingUp, accent: 'emerald' },
  { label: 'Pending Services', icon: TrendingUp, accent: 'yellow' },
  { label: 'Completed Services', icon: TrendingUp, accent: 'teal' },
]

const accentToClasses: Record<string, { chip: string; icon: string }> = {
  sky: { chip: 'bg-sky-100', icon: 'text-sky-50' },
  rose: { chip: 'bg-rose-100', icon: 'text-rose-50' },
  orange: { chip: 'bg-orange-100', icon: 'text-orange-50' },
  amber: { chip: 'bg-amber-100', icon: 'text-amber-50' },
  emerald: { chip: 'bg-emerald-100', icon: 'text-emerald-50' },
  yellow: { chip: 'bg-yellow-100', icon: 'text-yellow-50' },
  teal: { chip: 'bg-teal-100', icon: 'text-teal-50' },
}
const gradientMap: Record<string, string> = {
  sky: 'from-sky-500 to-blue-600',
  rose: 'from-rose-500 to-pink-600',
  orange: 'from-orange-500 to-amber-600',
  amber: 'from-amber-500 to-yellow-600',
  emerald: 'from-emerald-500 to-green-600',
  yellow: 'from-yellow-500 to-orange-500',
  teal: 'from-teal-500 to-cyan-600',
}
const accentHex: Record<string, string> = {
  sky: '#0284c7',
  rose: '#e11d48',
  orange: '#f97316',
  amber: '#f59e0b',
  emerald: '#059669',
  yellow: '#ca8a04',
  teal: '#0d9488',
}
const cardColorMap: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  sky: { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-700', icon: 'text-blue-500' },
  rose: { bg: 'from-rose-50 to-rose-100', border: 'border-rose-200', text: 'text-rose-700', icon: 'text-rose-500' },
  orange: { bg: 'from-orange-50 to-orange-100', border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  amber: { bg: 'from-amber-50 to-amber-100', border: 'border-amber-200', text: 'text-amber-700', icon: 'text-amber-500' },
  emerald: { bg: 'from-emerald-50 to-emerald-100', border: 'border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-500' },
  yellow: { bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', text: 'text-yellow-700', icon: 'text-yellow-500' },
  teal: { bg: 'from-teal-50 to-teal-100', border: 'border-teal-200', text: 'text-teal-700', icon: 'text-teal-500' },
}

const EMPTY_STATS = STAT_CONFIG.map(() => ({ value: 0 }))

type VolumeRange = '24h' | '7d' | '30d'

const VOLUME_SUBTITLES: Record<VolumeRange, string> = {
  '24h': 'Last 24 hours activity',
  '7d': 'Last 7 days activity',
  '30d': 'Last 30 days activity',
}

type DashboardStats = {
  activeLeads: number
  totalSales: number
  existingSchools: number
  pendingTrainings: number
  completedTrainings: number
  pendingServices: number
  completedServices: number
}

type TrendData = {
  name: string
  leads: number
  sales: number
  revenue: number
}

type VolumeData = {
  hour: string
  value: number
}

type ZoneData = {
  zone: string
  total: number
  hot: number
  warm: number
  cold: number
}

type AlertData = {
  level: 'warning' | 'info'
  text: string
}

type ActivityData = {
  id: string
  type: string
  message: string
  timestamp: string | Date
  user: string
}

type ZoneWiseLeadData = {
  zone: string
  total: number
  hot: number
  warm: number
  cold: number
}

type ExecutiveWiseLeadData = {
  zone: string
  executiveName: string
  total: number
  hot: number
  warm: number
  cold: number
}

type ZoneWiseClosedLeadData = {
  zone: string
  totalClosed: number
}

type ExecutiveWiseClosedLeadData = {
  zone: string
  executiveName: string
  totalClosed: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [trends, setTrends] = useState<TrendData[]>([])
  const [zones, setZones] = useState<ZoneData[]>([])
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [volume, setVolume] = useState<VolumeData[]>([])
  const [activities, setActivities] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [volumeRange, setVolumeRange] = useState<VolumeRange>('24h')
  const [volumeLoading, setVolumeLoading] = useState(false)
  
  // Leads analytics state
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [zoneWiseLeads, setZoneWiseLeads] = useState<ZoneWiseLeadData[]>([])
  const [executiveWiseLeads, setExecutiveWiseLeads] = useState<ExecutiveWiseLeadData[]>([])
  const [zoneWiseClosedLeads, setZoneWiseClosedLeads] = useState<ZoneWiseClosedLeadData[]>([])
  const [executiveWiseClosedLeads, setExecutiveWiseClosedLeads] = useState<ExecutiveWiseClosedLeadData[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'analytics' | 'ai'>('dashboard')
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [executiveAnalytics, setExecutiveAnalytics] = useState<any>(null)
  const [executiveLoading, setExecutiveLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)
  const [teamPendingLeaveCount, setTeamPendingLeaveCount] = useState(0)

  // compute KPIs for the teal chart
  const salesArr = trends && trends.length ? trends.map(t => t.revenue) : [0]
  const peak = Math.max(...salesArr)
  const min = Math.min(...salesArr)
  const avg = Math.round(salesArr.reduce((s,v)=>s+v,0) / (salesArr.length || 1))
  const fmtINR = (n:number) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  // Compute pie chart data from stats
  const PIE_DATA = [
    { label: 'Pending Trainings', value: stats[3]?.value || 0, color: '#fbbf24' },    // Amber
    { label: 'Completed Trainings', value: stats[4]?.value || 0, color: '#34d399' }, // Green
    { label: 'Pending Services', value: stats[5]?.value || 0, color: '#f59e42' },     // Orange
    { label: 'Completed Services', value: stats[6]?.value || 0, color: '#60a5fa' },   // Blue
  ]

  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  useEffect(() => {
    if (!currentUser?._id || !showDashboardLeaveSection(currentUser.role)) return

    const role = currentUser.role
    if (canManageTeamLeaves(role)) {
      apiRequest<{ status: string }[]>(`/leaves?status=Pending`)
        .then((data) => setTeamPendingLeaveCount(Array.isArray(data) ? data.length : 0))
        .catch(() => setTeamPendingLeaveCount(0))
    } else {
      setTeamPendingLeaveCount(0)
    }

    apiRequest<{ status: string }[]>(`/leaves?employeeId=${currentUser._id}&status=Pending`)
      .then((data) => setPendingLeaveCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setPendingLeaveCount(0))
  }, [currentUser?._id, currentUser?.role])

  const fetchExecutiveAnalytics = async () => {
    setExecutiveLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      const queryString = params.toString()
      const suffix = queryString ? `?${queryString}` : ''
      
      const data = await apiRequest<any>(`/dashboard/executive-analytics${suffix}`)
      setExecutiveAnalytics(data)
    } catch (error) {
      console.error('Error fetching executive analytics:', error)
    } finally {
      setExecutiveLoading(false)
    }
  }

  const fetchComprehensiveAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      const data = await apiRequest<any>('/dashboard/comprehensive-analytics')
      setAnalyticsData(data)
    } catch (error) {
      console.error('Error fetching comprehensive analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchLeadsAnalytics = async () => {
    setLeadsLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      
      const queryString = params.toString()
      const suffix = queryString ? `?${queryString}` : ''

      const [zoneWise, executiveWise, zoneClosed, executiveClosed] = await Promise.all([
        apiRequest<ZoneWiseLeadData[]>(`/dashboard/leads-analytics/zone-wise${suffix}`).catch(() => []),
        apiRequest<ExecutiveWiseLeadData[]>(`/dashboard/leads-analytics/executive-wise${suffix}`).catch(() => []),
        apiRequest<ZoneWiseClosedLeadData[]>(`/dashboard/leads-analytics/zone-wise-closed${suffix}`).catch(() => []),
        apiRequest<ExecutiveWiseClosedLeadData[]>(`/dashboard/leads-analytics/executive-wise-closed${suffix}`).catch(() => []),
      ])

      setZoneWiseLeads(zoneWise || [])
      setExecutiveWiseLeads(executiveWise || [])
      setZoneWiseClosedLeads(zoneClosed || [])
      setExecutiveWiseClosedLeads(executiveClosed || [])
    } catch (error) {
      console.error('Error fetching leads analytics:', error)
    } finally {
      setLeadsLoading(false)
    }
  }

  const fetchLeadsVolume = async (range: VolumeRange) => {
    setVolumeLoading(true)
    try {
      const volumeData = await apiRequest<VolumeData[]>(
        `/dashboard/leads-volume?range=${range}`
      )
      setVolume(volumeData || [])
    } catch (error) {
      console.error('Error fetching leads volume:', error)
      setVolume([])
      setLoadError('Could not load live dashboard data')
    } finally {
      setVolumeLoading(false)
    }
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true)
      setLoadError(null)
      let hadError = false

      try {
        const [statsData, trendsData, zonesData, alertsData, activitiesData] = await Promise.all([
          apiRequest<DashboardStats>('/dashboard/stats').catch(() => {
            hadError = true
            return null
          }),
          apiRequest<TrendData[]>('/dashboard/revenue-trends').catch(() => {
            hadError = true
            return null
          }),
          apiRequest<ZoneData[]>('/dashboard/leads-by-zone').catch(() => {
            hadError = true
            return null
          }),
          apiRequest<AlertData[]>('/dashboard/alerts').catch(() => {
            hadError = true
            return null
          }),
          apiRequest<ActivityData[]>('/dashboard/recent-activities').catch(() => {
            hadError = true
            return null
          }),
        ])

        if (statsData) {
          setStats([
            { value: statsData.activeLeads },
            { value: statsData.totalSales },
            { value: statsData.existingSchools },
            { value: statsData.pendingTrainings },
            { value: statsData.completedTrainings },
            { value: statsData.pendingServices },
            { value: statsData.completedServices },
          ])
        } else {
          setStats(EMPTY_STATS)
        }

        if (trendsData && trendsData.length > 0) {
          setTrends(trendsData)
        } else {
          setTrends([])
        }

        if (zonesData) {
          setZones(zonesData)
        } else {
          setZones([])
        }

        if (alertsData) {
          setAlerts(alertsData)
        } else {
          setAlerts([])
        }

        if (activitiesData && activitiesData.length > 0) {
          setActivities(activitiesData)
        } else {
          setActivities([])
        }

        if (hadError) {
          setLoadError('Could not load live dashboard data')
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setLoadError('Could not load live dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
    fetchLeadsAnalytics()
    if (currentUser?.role === 'Executive') {
      fetchExecutiveAnalytics()
    } else if (currentUser) {
      fetchComprehensiveAnalytics()
    }
  }, [currentUser])

  useEffect(() => {
    if (!currentUser) return
    if (currentUser.role === 'Vendor' || currentUser.role === 'Partner') return
    if (currentUser.role === 'Franchise') return
    fetchLeadsVolume(volumeRange)
  }, [volumeRange, currentUser])

  const handleSearch = () => {
    fetchLeadsAnalytics()
    if (currentUser?.role === 'Executive') {
      fetchExecutiveAnalytics()
    }
  }

  // Vendor gets dedicated dashboard with product/DC/stock insights
  if (currentUser?.role === 'Vendor' || currentUser?.role === 'Partner') {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Partner Dashboard</h1>
          <p className="text-sm text-neutral-600 mt-1">Insights for your assigned products</p>
        </div>
        <VendorDashboard />
      </div>
    )
  }

  // Franchise gets redirected to their franchise dashboard
  if (currentUser?.role === 'Franchise') {
    const franchiseEmail = currentUser?.email || ''
    if (franchiseEmail) {
      // Redirect to franchise dashboard page
      if (typeof window !== 'undefined') {
        window.location.href = `/dashboard/franchises/${encodeURIComponent(franchiseEmail)}`
        return (
          <div className="space-y-6 p-8">
            <div className="text-center text-neutral-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p>Redirecting to franchise dashboard...</p>
            </div>
          </div>
        )
      }
    }
  }

  const role = currentUser?.role as string | undefined

  return (
    <div className="space-y-8">
      {loadError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      )}

      {/* Premium Stat Cards - Minimal, elegant design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat, i) => {
          const colors = cardColorMap[stat.accent]
          const href = getStatHref(role, i)
          const cardInner = (
            <Card
              className={`p-5 bg-gradient-to-br ${colors.bg} border-2 ${colors.border} shadow-lg ${
                href ? 'hover:shadow-xl cursor-pointer transition-all' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-xs font-semibold ${colors.text} mb-1 uppercase`}>{stat.label}</div>
                  <div className={`text-2xl font-bold ${colors.text.replace('700', '900')}`}>{stats[i]?.value ?? '0'}</div>
                </div>
                <stat.icon className={`w-8 h-8 ${colors.icon}`} />
              </div>
            </Card>
          )
          return href ? (
            <Link key={stat.label} href={href} className="block">
              {cardInner}
            </Link>
          ) : (
            <div key={stat.label}>{cardInner}</div>
          )
        })}
      </div>

      {showDashboardLeaveSection(role) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-neutral-900">Leave Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {getDashboardLeaveCards(role).map((card) => {
              const styles =
                card.variant === 'pending'
                  ? {
                      card: 'from-amber-50 to-orange-100 border-amber-200',
                      iconBg: 'bg-amber-500',
                      title: 'text-amber-900',
                      subtitle: 'text-amber-700',
                      Icon: Clock,
                    }
                  : card.variant === 'apply'
                    ? {
                        card: 'from-blue-50 to-blue-100 border-blue-200',
                        iconBg: 'bg-blue-500',
                        title: 'text-blue-900',
                        subtitle: 'text-blue-700',
                        Icon: PlusCircle,
                      }
                    : {
                        card: 'from-teal-50 to-cyan-100 border-teal-200',
                        iconBg: 'bg-teal-500',
                        title: 'text-teal-900',
                        subtitle: 'text-teal-700',
                        Icon: CalendarCheck2,
                      }

              const subtitle =
                card.variant === 'pending'
                  ? teamPendingLeaveCount > 0
                    ? `${teamPendingLeaveCount} awaiting approval`
                    : card.subtitle
                  : card.variant === 'myLeaves' && pendingLeaveCount > 0
                    ? `${pendingLeaveCount} pending approval`
                    : card.subtitle

              const { Icon } = styles

              return (
                <Link key={card.href} href={card.href} className="block">
                  <Card
                    className={`p-5 bg-gradient-to-br ${styles.card} border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-12 w-12 rounded-full ${styles.iconBg} flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className={`font-semibold ${styles.title}`}>{card.title}</div>
                        <div className={`text-sm mt-0.5 ${styles.subtitle}`}>{subtitle}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Premium Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-neutral-200/60">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'dashboard' | 'leads' | 'analytics' | 'ai')} className="w-full">
          <TabsList className="bg-transparent p-0 h-auto gap-0">
            <TabsTrigger
              value="dashboard"
              className={`px-5 py-3 rounded-t-lg font-medium text-sm transition-all duration-200 relative ${
                activeTab === 'dashboard'
                  ? 'text-neutral-900 bg-white'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Dashboard
              {activeTab === 'dashboard' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className={`px-5 py-3 rounded-t-lg font-medium text-sm transition-all duration-200 relative ${
                activeTab === 'leads'
                  ? 'text-neutral-900 bg-white'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Leads Dashboard
              {activeTab === 'leads' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className={`px-5 py-3 rounded-t-lg font-medium text-sm transition-all duration-200 relative ${
                activeTab === 'analytics'
                  ? 'text-neutral-900 bg-white'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Comprehensive Analytics
              {activeTab === 'analytics' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className={`px-5 py-3 rounded-t-lg font-medium text-sm transition-all duration-200 relative ${
                activeTab === 'ai'
                  ? 'text-neutral-900 bg-white'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Mode
              </span>
              {activeTab === 'ai' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Dashboard Content */}
      {activeTab === 'dashboard' && (
        <>
          {/* Executive Summary Stats - Only for Executives */}
          {currentUser?.role === 'Executive' && executiveAnalytics && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <Link href="/dashboard/leads/followup" className="block">
                <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Total Leads</div>
                      <div className="text-2xl font-bold text-blue-900">{executiveAnalytics.leads?.total || 0}</div>
                      <div className="text-xs text-blue-600 mt-1">
                        {executiveAnalytics.leads?.closed || 0} closed ({executiveAnalytics.leads?.total > 0 
                          ? Math.round((executiveAnalytics.leads?.closed || 0) / executiveAnalytics.leads.total * 100)
                          : 0}%)
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/dashboard/payments" className="block">
                <Card className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-emerald-700 mb-1 uppercase tracking-wide">Revenue</div>
                      <div className="text-2xl font-bold text-emerald-900">{fmtINR(executiveAnalytics.payments?.totalAmount || 0)}</div>
                      <div className="text-xs text-emerald-600 mt-1">{executiveAnalytics.payments?.total || 0} payments</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              </Link>
              <Link href="/dashboard/expenses" className="block">
                <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-red-700 mb-1 uppercase tracking-wide">Expenses</div>
                      <div className="text-2xl font-bold text-red-900">{fmtINR(executiveAnalytics.expenses?.totalAmount || 0)}</div>
                      <div className="text-xs text-red-600 mt-1">{executiveAnalytics.expenses?.total || 0} expenses</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-500 flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              </Link>
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className="block text-left w-full"
              >
                <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">Net Profit</div>
                      <div className="text-2xl font-bold text-green-900">
                        {fmtINR((executiveAnalytics.payments?.totalAmount || 0) - (executiveAnalytics.expenses?.totalAmount || 0))}
                      </div>
                      <div className="text-xs text-green-600 mt-1">Revenue - Expenses</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              </button>
              <Link href="/dashboard/dc/client-dc" className="block">
                <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 shadow-lg hover:shadow-xl transition-all cursor-pointer h-full">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wide">Total Sales</div>
                      <div className="text-2xl font-bold text-purple-900">{executiveAnalytics.sales?.total || 0}</div>
                      <div className="text-xs text-purple-600 mt-1">{executiveAnalytics.sales?.completed || 0} completed</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-500 flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          )}

          {/* Executive Leads Breakdown - Only for Executives */}
          {currentUser?.role === 'Executive' && executiveAnalytics?.leads && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {executiveAnalytics.leads.byPriority && executiveAnalytics.leads.byPriority.length > 0 && (
                <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-lg text-neutral-900">My Leads by Priority</h3>
                      <p className="text-xs text-neutral-500 mt-1">Distribution of leads by priority level</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <PieChart
                    data={executiveAnalytics.leads.byPriority.map((item: any) => ({
                      label: item._id || 'Unknown',
                      value: item.count || 0,
                      color: item._id === 'Hot' ? '#ef4444' : item._id === 'Warm' ? '#f59e0b' : '#6b7280'
                    }))}
                    height={280}
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {executiveAnalytics.leads.byPriority.map((item: any) => (
                      <div key={item._id} className="text-center p-2 bg-neutral-50 rounded">
                        <div className="text-lg font-bold text-neutral-900">{item.count || 0}</div>
                        <div className="text-xs text-neutral-600">{item._id || 'Unknown'}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {executiveAnalytics.leads.byStatus && executiveAnalytics.leads.byStatus.length > 0 && (
                <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-semibold text-lg text-neutral-900">My Leads by Status</h3>
                      <p className="text-xs text-neutral-500 mt-1">Current status of all your leads</p>
                    </div>
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <PieChart
                    data={executiveAnalytics.leads.byStatus.map((item: any, idx: number) => ({
                      label: item._id || 'Unknown',
                      value: item.count || 0,
                      color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6]
                    }))}
                    height={280}
                  />
                </Card>
              )}
            </div>
          )}

          {/* Premium Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Premium styling */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-semibold text-neutral-900 text-base mb-1">Leads Volume</div>
              <div className="text-xs text-neutral-500">{VOLUME_SUBTITLES[volumeRange]}</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              {(['24h', '7d', '30d'] as VolumeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setVolumeRange(r)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    volumeRange === r
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : 'text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600'
                  }`}
                >
                  {r === '24h' ? '24H' : r === '7d' ? '7D' : '30D'}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px]">
            {volumeLoading ? (
              <div className="h-full flex items-center justify-center text-neutral-400 text-sm">Loading chart…</div>
            ) : volume.length > 0 ? (
              <BarGradient labels={volume.map((v) => v.hour)} values={volume.map((v) => v.value)} />
            ) : (
              <div className="h-full flex items-center justify-center text-neutral-400 text-sm">No volume data</div>
            )}
          </div>
        </Card>
        {/* AreaChart with KPIs - Premium styling */}
        <Card className="min-h-[360px] p-6 flex flex-col gap-6">
          <div>
            <div className="text-base font-semibold text-neutral-900 mb-1">Revenue Trend</div>
            <div className="text-xs text-neutral-500">Week-over-week revenue progression</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg px-4 py-3 border border-orange-100/50">
              <div className="text-orange-600 text-xl font-bold mb-0.5">{fmtINR(peak)}</div>
              <div className="text-xs text-orange-600/70 font-medium">Peak</div>
            </div>
            <div className="flex-1 bg-gradient-to-br from-neutral-50 to-neutral-100/50 rounded-lg px-4 py-3 border border-neutral-200/50">
              <div className="text-neutral-900 text-xl font-bold mb-0.5">{fmtINR(avg)}</div>
              <div className="text-xs text-neutral-600/70 font-medium">Average</div>
            </div>
            <div className="flex-1 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg px-4 py-3 border border-emerald-100/50">
              <div className="text-emerald-700 text-xl font-bold mb-0.5">{fmtINR(min)}</div>
              <div className="text-xs text-emerald-700/70 font-medium">Minimum</div>
            </div>
          </div>
          <div className="flex-1 min-h-[240px]">
            <AreaGradient labels={trends.map(t=>t.name)} values={trends.map(t=>t.revenue)} />
          </div>
        </Card>
      </div>
      {/* Premium Donut chart row (Training & Service Status) */}
      <div className="flex flex-col lg:flex-row w-full gap-6">
        <Card className="flex flex-col lg:flex-row items-center justify-between w-full p-8 md:p-10">
          <div className="w-full lg:w-[350px] xl:w-[430px] h-[260px] flex items-center justify-center relative">
            <DoughnutStatus slices={PIE_DATA as any} />
            <div className="absolute text-center">
              <div className="text-xs text-neutral-500 font-medium">Total</div>
              <div className="text-2xl font-bold text-neutral-900 mt-1">{PIE_DATA.reduce((s,d)=>s + (d.value as number),0)}</div>
            </div>
          </div>
          {/* Premium legend */}
          <div className="flex flex-col mt-6 lg:mt-0 lg:ml-12 gap-3 min-w-[220px]">
            <div className="font-semibold text-base mb-1 text-neutral-900">Training & Service Status</div>
            {PIE_DATA.map((entry) => {
              const total = PIE_DATA.reduce((s,d)=>s + (d.value as number),0) || 1
              const pct = Math.round(((entry.value as number) / total) * 100)
              const legendHref =
                entry.label.includes('Service')
                  ? getStatHref(role, 5)
                  : getStatHref(role, 3)
              const rowClass =
                'flex items-center gap-3 text-sm font-medium text-neutral-700 rounded-lg px-1 py-1 -mx-1'
              const rowContent = (
                <>
                  <span className="w-3.5 h-3.5 rounded-full block ring-2 ring-white shadow-sm" style={{ background: entry.color }} />
                  <span className="truncate flex-1">{entry.label}</span>
                  <span className="text-neutral-400 text-xs font-normal">{pct}%</span>
                  <span className="font-bold text-neutral-900 w-8 text-right">{entry.value}</span>
                </>
              )
              return legendHref ? (
                <Link
                  key={entry.label}
                  href={legendHref}
                  className={`${rowClass} hover:bg-neutral-50 transition-colors cursor-pointer`}
                >
                  {rowContent}
                </Link>
              ) : (
                <div key={entry.label} className={rowClass}>
                  {rowContent}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Premium Active Alerts */}
        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-neutral-900 text-base">Active Alerts</div>
            <Link
              href={DASHBOARD_ALERTS_VIEW_ALL}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="text-neutral-400 text-sm">Loading alerts...</div>
            ) : alerts.length > 0 ? (
              alerts.map((a, idx) => {
                const alertHref = getAlertHref(a.level)
                const row = (
                  <>
                    <span className={`absolute left-0 top-0 bottom-0 w-1 ${a.level === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'} rounded-l-lg`} />
                    <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${a.level === 'warning' ? 'text-orange-600' : 'text-emerald-600'}`} />
                    <span className="leading-relaxed">{a.text}</span>
                  </>
                )
                return (
                  <Link
                    key={idx}
                    href={alertHref}
                    className={`relative flex items-start gap-3 rounded-lg p-3 text-sm transition-all duration-200 hover:shadow-sm cursor-pointer ${
                      a.level === 'warning'
                        ? 'bg-orange-50/80 text-orange-900 border border-orange-200/50'
                        : 'bg-emerald-50/80 text-emerald-900 border border-emerald-200/50'
                    }`}
                  >
                    {row}
                  </Link>
                )
              })
            ) : (
              <div className="text-neutral-400 text-sm py-4 text-center">No active alerts</div>
            )}
          </div>
        </Card>
        {/* Premium Leads by Zone table */}
        <Card className="p-6 lg:col-span-2">
          <div className="font-semibold text-neutral-900 mb-4 text-base">Leads by Zone</div>
          <div className="overflow-hidden rounded-lg border border-neutral-200/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-neutral-600 border-b border-neutral-200/60 bg-neutral-50/50">
                  <th className="py-3 font-semibold px-4 text-xs uppercase tracking-wider">Zone</th>
                  <th className="py-3 font-semibold text-right px-4 text-xs uppercase tracking-wider">Total</th>
                  <th className="py-3 font-semibold text-right px-4 text-xs uppercase tracking-wider">Hot</th>
                  <th className="py-3 font-semibold text-right px-4 text-xs uppercase tracking-wider">Warm</th>
                  <th className="py-3 font-semibold text-right px-4 text-xs uppercase tracking-wider">Cold</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-neutral-400">Loading zones...</td>
                  </tr>
                ) : zones.length > 0 ? (
                  zones.map((z, i) => (
                    <tr key={z.zone} className={`border-b border-neutral-200/40 last:border-0 transition-colors hover:bg-neutral-50/50 ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                      <td className="py-3 px-4 text-neutral-900 font-medium">{z.zone}</td>
                      <td className="py-3 px-4 text-right"><span className="inline-flex items-center justify-center min-w-8 px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 font-semibold text-xs">{z.total}</span></td>
                      <td className="py-3 px-4 text-right"><span className="inline-flex min-w-8 px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 font-medium text-xs">{z.hot}</span></td>
                      <td className="py-3 px-4 text-right"><span className="inline-flex min-w-8 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium text-xs">{z.warm}</span></td>
                      <td className="py-3 px-4 text-right"><span className="inline-flex min-w-8 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 font-medium text-xs">{z.cold}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 px-4 text-center text-neutral-400">No zone data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Premium Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-neutral-900 text-base">Recent Activity</div>
            {canViewChangeLogs(role) && (
              <Link
                href="/dashboard/reports/change-logs"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                View all
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-3 text-sm">
            {loading ? (
              <div className="text-neutral-400 py-4">Loading activities...</div>
            ) : activities.length > 0 ? (
              activities.slice(0, 5).map((activity) => {
                const getColorClasses = () => {
                  if (activity.type === 'lead_created') return { text: 'text-orange-700', bg: 'bg-orange-500', ring: 'ring-orange-200' }
                  if (activity.type === 'sale_made') return { text: 'text-emerald-700', bg: 'bg-emerald-500', ring: 'ring-emerald-200' }
                  if (activity.type === 'training_completed') return { text: 'text-blue-700', bg: 'bg-blue-500', ring: 'ring-blue-200' }
                  return { text: 'text-neutral-700', bg: 'bg-neutral-500', ring: 'ring-neutral-200' }
                }
                const colors = getColorClasses()
                return (
                  <div key={activity.id} className={`flex items-start gap-3 p-2.5 rounded-lg hover:bg-neutral-50/50 transition-colors ${colors.text}`}>
                    <span className={`h-2 w-2 rounded-full ${colors.bg} mt-1.5 ring-2 ${colors.ring} flex-shrink-0`} />
                    <span className="leading-relaxed">{activity.message}</span>
                  </div>
                )
              })
            ) : (
              <div className="text-neutral-400 py-4">No recent activities</div>
            )}
          </div>
        </Card>

        {/* Executive Sales & Payments Summary - Only for Executives */}
        {currentUser?.role === 'Executive' && executiveAnalytics && (
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold text-neutral-900 text-base">Sales & Payments Summary</div>
                <p className="text-xs text-neutral-500 mt-1">Quick overview of your sales and payments</p>
      </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <div className="text-sm font-medium text-blue-900">Total Sales</div>
                  <div className="text-xs text-blue-600">{executiveAnalytics.sales?.completed || 0} completed</div>
                </div>
                <div className="text-2xl font-bold text-blue-700">{executiveAnalytics.sales?.total || 0}</div>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                  <div className="text-sm font-medium text-emerald-900">Total Revenue</div>
                  <div className="text-xs text-emerald-600">{executiveAnalytics.payments?.total || 0} payments</div>
                </div>
                <div className="text-xl font-bold text-emerald-700">{fmtINR(executiveAnalytics.payments?.totalAmount || 0)}</div>
              </div>
              {executiveAnalytics.sales?.byStatus && executiveAnalytics.sales.byStatus.length > 0 && (
                <div className="pt-3 border-t border-neutral-200">
                  <div className="text-xs font-semibold text-neutral-700 mb-2 uppercase">Sales Status Breakdown</div>
                  <div className="space-y-2">
                    {executiveAnalytics.sales.byStatus.map((item: any, idx: number) => (
                      <div key={item._id} className="flex items-center justify-between">
                        <span className="text-sm text-neutral-600">{item._id || 'Unknown'}</span>
                        <span className="text-sm font-bold text-neutral-900">{item.count || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Executive Performance Metrics - Only for Executives */}
      {currentUser?.role === 'Executive' && executiveAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Conversion Metrics */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-neutral-900">Conversion Metrics</h3>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-600">Lead Conversion</span>
                  <span className="font-bold text-neutral-900">
                    {executiveAnalytics.leads?.total > 0 
                      ? Math.round((executiveAnalytics.leads?.closed || 0) / executiveAnalytics.leads.total * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full" 
                    style={{ width: `${executiveAnalytics.leads?.total > 0 
                      ? Math.round((executiveAnalytics.leads?.closed || 0) / executiveAnalytics.leads.total * 100)
                      : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-600">Sales Completion</span>
                  <span className="font-bold text-neutral-900">
                    {executiveAnalytics.sales?.total > 0 
                      ? Math.round((executiveAnalytics.sales?.completed || 0) / executiveAnalytics.sales.total * 100)
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${executiveAnalytics.sales?.total > 0 
                      ? Math.round((executiveAnalytics.sales?.completed || 0) / executiveAnalytics.sales.total * 100)
                      : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Financial Overview */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-neutral-900">Financial Overview</h3>
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <span className="text-sm font-medium text-emerald-900">Revenue</span>
                <span className="text-lg font-bold text-emerald-700">{fmtINR(executiveAnalytics.payments?.totalAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <span className="text-sm font-medium text-red-900">Expenses</span>
                <span className="text-lg font-bold text-red-700">{fmtINR(executiveAnalytics.expenses?.totalAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-2 border-green-200">
                <span className="text-sm font-semibold text-green-900">Net Profit</span>
                <span className="text-xl font-bold text-green-700">
                  {fmtINR((executiveAnalytics.payments?.totalAmount || 0) - (executiveAnalytics.expenses?.totalAmount || 0))}
                </span>
              </div>
            </div>
          </Card>

          {/* Training & Services Summary */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-base text-neutral-900">Training & Services</h3>
              <GraduationCap className="w-5 h-5 text-purple-500" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium text-blue-900">Total Trainings</span>
                <span className="text-lg font-bold text-blue-700">{executiveAnalytics.training?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <span className="text-sm font-medium text-purple-900">Completed</span>
                <span className="text-lg font-bold text-purple-700">{executiveAnalytics.training?.completed || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                <span className="text-sm font-medium text-teal-900">Total Services</span>
                <span className="text-lg font-bold text-teal-700">{executiveAnalytics.services?.total || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
                <span className="text-sm font-medium text-indigo-900">Services Completed</span>
                <span className="text-lg font-bold text-indigo-700">{executiveAnalytics.services?.completed || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Executive Expenses Breakdown - Only for Executives */}
      {currentUser?.role === 'Executive' && executiveAnalytics?.expenses?.byCategory && executiveAnalytics.expenses.byCategory.length > 0 && (
        <Card className="p-6 bg-white shadow-lg border border-neutral-200/60 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg text-neutral-900">My Expenses by Category</h3>
              <p className="text-xs text-neutral-500 mt-1">Breakdown of expenses by category</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <MultiBarChart
            labels={executiveAnalytics.expenses.byCategory.slice(0, 10).map((item: any) => item._id || 'Unknown')}
            datasets={[{
              label: 'Total Amount (₹)',
              data: executiveAnalytics.expenses.byCategory.slice(0, 10).map((item: any) => item.totalAmount || 0),
              color: '#ef4444'
            }]}
            height={300}
          />
        </Card>
      )}
        </>
      )}

      {/* Premium Leads Dashboard Content */}
      {activeTab === 'leads' && (
      <div className="mt-6 space-y-6">
        {currentUser?.role === 'Executive' ? (
          /* Executive Leads Dashboard */
        <Card className="p-6">
          <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">My Leads Analytics Dashboard</h2>
              <p className="text-sm text-neutral-500">Comprehensive analytics for all leads entered by you</p>
            
            {/* Premium Date Range Filter */}
              <div className="flex flex-wrap items-center gap-3 mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200/60">
                <div className="flex items-center gap-2">
                  <label htmlFor="execFromDate" className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                    From:
                  </label>
                  <Input
                    id="execFromDate"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[160px] bg-white border-blue-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="execToDate" className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                    To:
                  </label>
                  <Input
                    id="execToDate"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[160px] bg-white border-blue-200"
                  />
                </div>
                <Button 
                  onClick={handleSearch} 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition-all"
                >
                  Apply Filters
                </Button>
              </div>
            </div>

            {executiveLoading ? (
              <div className="text-center py-12 text-neutral-500">Loading your leads analytics...</div>
            ) : executiveAnalytics?.leads ? (
              <div className="space-y-8">
                {/* Executive Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-blue-700 mb-2 uppercase tracking-wide">Total Leads</div>
                        <div className="text-3xl font-bold text-blue-900">{executiveAnalytics.leads?.total || 0}</div>
                        <div className="text-xs text-blue-600 mt-1">Active: {(executiveAnalytics.leads?.total || 0) - (executiveAnalytics.leads?.closed || 0)}</div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-50 border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Closed Leads</div>
                        <div className="text-3xl font-bold text-emerald-900">{executiveAnalytics.leads?.closed || 0}</div>
                        <div className="text-xs text-emerald-600 mt-1">
                          {executiveAnalytics.leads?.total > 0 
                            ? Math.round((executiveAnalytics.leads?.closed || 0) / executiveAnalytics.leads.total * 100)
                            : 0}% Conversion
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
                        <DollarSign className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-red-50 via-red-100 to-red-50 border-2 border-red-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">Hot Leads</div>
                        <div className="text-3xl font-bold text-red-900">
                          {executiveAnalytics.leads?.byPriority?.find((p: any) => p._id === 'Hot')?.count || 0}
                        </div>
                        <div className="text-xs text-red-600 mt-1">High Priority</div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 border-2 border-amber-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-amber-700 mb-2 uppercase tracking-wide">Warm Leads</div>
                        <div className="text-3xl font-bold text-amber-900">
                          {executiveAnalytics.leads?.byPriority?.find((p: any) => p._id === 'Warm')?.count || 0}
                        </div>
                        <div className="text-xs text-amber-600 mt-1">Medium Priority</div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-indigo-50 via-indigo-100 to-indigo-50 border-2 border-indigo-200 shadow-lg hover:shadow-xl transition-all">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-indigo-700 mb-2 uppercase tracking-wide">Cold Leads</div>
                        <div className="text-3xl font-bold text-indigo-900">
                          {executiveAnalytics.leads?.byPriority?.find((p: any) => p._id === 'Cold')?.count || 0}
                        </div>
                        <div className="text-xs text-indigo-600 mt-1">Low Priority</div>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Leads by Status and Priority Charts */}
                {executiveAnalytics.leads?.byStatus?.length > 0 || executiveAnalytics.leads?.byPriority?.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {executiveAnalytics.leads?.byStatus?.length > 0 && (
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">My Leads by Status</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <PieChart
                          data={executiveAnalytics.leads.byStatus.map((item: any, idx: number) => ({
                            label: item._id || 'Unknown',
                            value: item.count || 0,
                            color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6]
                          }))}
                          height={320}
                        />
                      </Card>
                    )}
                    {executiveAnalytics.leads?.byPriority?.length > 0 && (
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">My Leads by Priority</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <PieChart
                          data={executiveAnalytics.leads.byPriority.map((item: any) => ({
                            label: item._id || 'Unknown',
                            value: item.count || 0,
                            color: item._id === 'Hot' ? '#ef4444' : item._id === 'Warm' ? '#f59e0b' : '#6b7280'
                          }))}
                          height={320}
                        />
                      </Card>
                    )}
                  </div>
                ) : null}

                {/* Leads by Zone Chart */}
                {executiveAnalytics.leads?.byZone?.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Leads by Zone</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <MultiBarChart
                      labels={executiveAnalytics.leads.byZone.map((item: any) => item._id || 'Unassigned')}
                      datasets={[{
                        label: 'Leads',
                        data: executiveAnalytics.leads.byZone.map((item: any) => item.count || 0),
                        color: '#3b82f6'
                      }]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Priority Distribution Bar Chart */}
                {executiveAnalytics.leads?.byPriority?.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">Priority Distribution</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <MultiBarChart
                      labels={executiveAnalytics.leads.byPriority.map((item: any) => item._id || 'Unknown')}
                      datasets={[{
                        label: 'Number of Leads',
                        data: executiveAnalytics.leads.byPriority.map((item: any) => item.count || 0),
                        color: '#8b5cf6'
                      }]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Status Distribution Bar Chart */}
                {executiveAnalytics.leads?.byStatus?.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">Status Distribution</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <MultiBarChart
                      labels={executiveAnalytics.leads.byStatus.map((item: any) => item._id || 'Unknown')}
                      datasets={[{
                        label: 'Number of Leads',
                        data: executiveAnalytics.leads.byStatus.map((item: any) => item.count || 0),
                        color: '#10b981'
                      }]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Combined Priority and Status View */}
                {executiveAnalytics.leads?.byStatus?.length > 0 && executiveAnalytics.leads?.byPriority?.length > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">Leads Overview</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <span className="text-sm font-medium text-blue-900">Total Leads</span>
                          <span className="text-2xl font-bold text-blue-700">{executiveAnalytics.leads?.total || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                          <span className="text-sm font-medium text-emerald-900">Closed Leads</span>
                          <span className="text-2xl font-bold text-emerald-700">{executiveAnalytics.leads?.closed || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <span className="text-sm font-medium text-purple-900">Conversion Rate</span>
                          <span className="text-2xl font-bold text-purple-700">
                            {executiveAnalytics.leads?.total > 0 
                              ? Math.round((executiveAnalytics.leads?.closed || 0) / executiveAnalytics.leads.total * 100)
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">Priority Breakdown</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="space-y-4">
                        {executiveAnalytics.leads.byPriority.map((item: any) => {
                          const total = executiveAnalytics.leads?.total || 1
                          const percentage = Math.round((item.count || 0) / total * 100)
                          const bgColor = item._id === 'Hot' ? 'bg-red-500' : item._id === 'Warm' ? 'bg-amber-500' : 'bg-gray-500'
                          return (
                            <div key={item._id} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-700">{item._id || 'Unknown'}</span>
                                <span className="text-sm font-bold text-neutral-900">{item.count || 0} ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-neutral-200 rounded-full h-2.5">
                                <div
                                  className={`h-2.5 rounded-full ${bgColor}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-500">No leads data available</div>
            )}
          </Card>
        ) : (
          /* Regular Leads Dashboard for non-executives */
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">Leads Analytics Dashboard</h2>
              <p className="text-sm text-neutral-500">Comprehensive analytics and insights for leads management</p>
              
              {/* Premium Date Range Filter */}
              <div className="flex flex-wrap items-center gap-3 mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200/60">
              <div className="flex items-center gap-2">
                <label htmlFor="fromDate" className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                  From:
                </label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                    className="w-[160px] bg-white border-blue-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="toDate" className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                  To:
                </label>
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                    className="w-[160px] bg-white border-blue-200"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition-all"
              >
                  Apply Filters
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {/* Summary Statistics Cards */}
            {!leadsLoading && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-5 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 border-2 border-blue-200 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-blue-700 mb-2 uppercase tracking-wide">Total Active Leads</div>
                      <div className="text-3xl font-bold text-blue-900">
                        {zoneWiseLeads.reduce((sum, item) => sum + (item.total || 0), 0)}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-gradient-to-br from-red-50 via-red-100 to-red-50 border-2 border-red-200 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">Hot Leads</div>
                      <div className="text-3xl font-bold text-red-900">
                        {zoneWiseLeads.reduce((sum, item) => sum + (item.hot || 0), 0)}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-gradient-to-br from-amber-50 via-amber-100 to-amber-50 border-2 border-amber-200 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-amber-700 mb-2 uppercase tracking-wide">Warm Leads</div>
                      <div className="text-3xl font-bold text-amber-900">
                        {zoneWiseLeads.reduce((sum, item) => sum + (item.warm || 0), 0)}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-500 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-50 border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Closed Leads</div>
                      <div className="text-3xl font-bold text-emerald-900">
                        {zoneWiseClosedLeads.reduce((sum, item) => sum + (item.totalClosed || 0), 0)}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Charts Section */}
            {!leadsLoading && (
              <>
                {/* Zone-wise Leads Charts */}
                {zoneWiseLeads.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Zone-wise Leads Distribution</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <PieChart
                          data={zoneWiseLeads.map((item, idx) => ({
                            label: item.zone || 'Unassigned',
                            value: item.total || 0,
                            color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316'][idx % 8]
                          }))}
                          height={320}
                        />
                      </Card>
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Priority Distribution by Zone</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <MultiBarChart
                          labels={zoneWiseLeads.map(item => item.zone || 'Unassigned')}
                          datasets={[
                            {
                              label: 'Hot',
                              data: zoneWiseLeads.map(item => item.hot || 0),
                              color: '#ef4444'
                            },
                            {
                              label: 'Warm',
                              data: zoneWiseLeads.map(item => item.warm || 0),
                              color: '#f59e0b'
                            },
                            {
                              label: 'Cold',
                              data: zoneWiseLeads.map(item => item.cold || 0),
                              color: '#6b7280'
                            }
                          ]}
                          height={320}
                        />
                      </Card>
                    </div>

                    {/* Zone-wise Total Leads Bar Chart */}
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">Total Leads by Zone</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <MultiBarChart
                        labels={zoneWiseLeads.map(item => item.zone || 'Unassigned')}
                        datasets={[{
                          label: 'Total Leads',
                          data: zoneWiseLeads.map(item => item.total || 0),
                          color: '#3b82f6'
                        }]}
                        height={350}
                      />
                    </Card>
                  </>
                )}

                {/* Executive-wise Performance Charts */}
                {executiveWiseLeads.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Top 10 Executives by Total Leads</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <MultiBarChart
                          labels={executiveWiseLeads
                            .sort((a, b) => (b.total || 0) - (a.total || 0))
                            .slice(0, 10)
                            .map(item => item.executiveName || 'Unassigned')}
                          datasets={[{
                            label: 'Total Leads',
                            data: executiveWiseLeads
                              .sort((a, b) => (b.total || 0) - (a.total || 0))
                              .slice(0, 10)
                              .map(item => item.total || 0),
                            color: '#10b981'
                          }]}
                          height={380}
                        />
                      </Card>
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Executive Performance by Priority</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <MultiBarChart
                          labels={executiveWiseLeads
                            .sort((a, b) => (b.total || 0) - (a.total || 0))
                            .slice(0, 8)
                            .map(item => item.executiveName || 'Unassigned')}
                          datasets={[
                            {
                              label: 'Hot',
                              data: executiveWiseLeads
                                .sort((a, b) => (b.total || 0) - (a.total || 0))
                                .slice(0, 8)
                                .map(item => item.hot || 0),
                              color: '#ef4444'
                            },
                            {
                              label: 'Warm',
                              data: executiveWiseLeads
                                .sort((a, b) => (b.total || 0) - (a.total || 0))
                                .slice(0, 8)
                                .map(item => item.warm || 0),
                              color: '#f59e0b'
                            },
                            {
                              label: 'Cold',
                              data: executiveWiseLeads
                                .sort((a, b) => (b.total || 0) - (a.total || 0))
                                .slice(0, 8)
                                .map(item => item.cold || 0),
                              color: '#6b7280'
                            }
                          ]}
                          height={380}
                        />
                      </Card>
                    </div>
                  </>
                )}

                {/* Closed Leads Analytics */}
                {(zoneWiseClosedLeads.length > 0 || executiveWiseClosedLeads.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {zoneWiseClosedLeads.length > 0 && (
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Closed Leads by Zone</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <PieChart
                          data={zoneWiseClosedLeads.map((item, idx) => ({
                            label: item.zone || 'Unassigned',
                            value: item.totalClosed || 0,
                            color: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#86efac'][idx % 6]
                          }))}
                          height={320}
                        />
                      </Card>
                    )}
                    {executiveWiseClosedLeads.length > 0 && (
                      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="font-semibold text-lg text-neutral-900">Top 10 Executives - Closed Leads</h3>
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <MultiBarChart
                          labels={executiveWiseClosedLeads
                            .sort((a, b) => (b.totalClosed || 0) - (a.totalClosed || 0))
                            .slice(0, 10)
                            .map(item => item.executiveName || 'Unassigned')}
                          datasets={[{
                            label: 'Closed Leads',
                            data: executiveWiseClosedLeads
                              .sort((a, b) => (b.totalClosed || 0) - (a.totalClosed || 0))
                              .slice(0, 10)
                              .map(item => item.totalClosed || 0),
                            color: '#10b981'
                          }]}
                          height={320}
                        />
                      </Card>
                    )}
                  </div>
                )}

                {/* Priority Distribution Pie Chart */}
                {zoneWiseLeads.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">Overall Priority Distribution</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="max-w-md mx-auto">
                      <PieChart
                        data={[
                          {
                            label: 'Hot',
                            value: zoneWiseLeads.reduce((sum, item) => sum + (item.hot || 0), 0),
                            color: '#ef4444'
                          },
                          {
                            label: 'Warm',
                            value: zoneWiseLeads.reduce((sum, item) => sum + (item.warm || 0), 0),
                            color: '#f59e0b'
                          },
                          {
                            label: 'Cold',
                            value: zoneWiseLeads.reduce((sum, item) => sum + (item.cold || 0), 0),
                            color: '#6b7280'
                          }
                        ]}
                        height={300}
                      />
                    </div>
                  </Card>
                )}
              </>
            )}
            {/* Premium Zone wise Leads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">Zone wise Leads</h3>
                  <p className="text-xs text-neutral-500 mt-1">Lead distribution across zones</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-neutral-200/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200/60 bg-neutral-50/50">
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Zone</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Total</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Hot</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Warm</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Cold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsLoading ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-neutral-400">Loading...</td>
                        </tr>
                      ) : zoneWiseLeads.length > 0 ? (
                        zoneWiseLeads.map((item, idx) => (
                          <tr key={idx} className={`border-b border-neutral-200/40 last:border-0 transition-colors hover:bg-neutral-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.zone || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 font-semibold text-xs">{item.total}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 font-medium text-xs">{item.hot}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium text-xs">{item.warm}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 font-medium text-xs">{item.cold}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-neutral-400">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Premium Executive wise Leads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">Executive wise Leads</h3>
                  <p className="text-xs text-neutral-500 mt-1">Lead performance by executive</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-neutral-200/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200/60 bg-neutral-50/50">
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Zone</th>
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Executive</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Total</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Hot</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Warm</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Cold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-neutral-400">Loading...</td>
                        </tr>
                      ) : executiveWiseLeads.length > 0 ? (
                        executiveWiseLeads.map((item, idx) => (
                          <tr key={idx} className={`border-b border-neutral-200/40 last:border-0 transition-colors hover:bg-neutral-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.zone || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.executiveName || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-orange-100 text-orange-700 font-semibold text-xs">{item.total}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 font-medium text-xs">{item.hot}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-medium text-xs">{item.warm}</span></td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-700 font-medium text-xs">{item.cold}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-neutral-400">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Premium Zone wise Closed Leads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">Zone wise Closed Leads</h3>
                  <p className="text-xs text-neutral-500 mt-1">Closed leads by zone</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-neutral-200/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200/60 bg-neutral-50/50">
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Zone</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Closed Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsLoading ? (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-neutral-400">Loading...</td>
                        </tr>
                      ) : zoneWiseClosedLeads.length > 0 ? (
                        zoneWiseClosedLeads.map((item, idx) => (
                          <tr key={idx} className={`border-b border-neutral-200/40 last:border-0 transition-colors hover:bg-neutral-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.zone || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-xs">{item.totalClosed}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="py-8 text-center text-neutral-400">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            {/* Premium Executive wise Closed Leads */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-neutral-900 text-base">Executive wise Closed Leads</h3>
                  <p className="text-xs text-neutral-500 mt-1">Closed leads by executive</p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-neutral-200/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200/60 bg-neutral-50/50">
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Zone</th>
                        <th className="py-3 px-4 text-left font-semibold text-neutral-900 text-xs uppercase tracking-wider">Executive</th>
                        <th className="py-3 px-4 text-right font-semibold text-neutral-900 text-xs uppercase tracking-wider">Closed Leads</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsLoading ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-neutral-400">Loading...</td>
                        </tr>
                      ) : executiveWiseClosedLeads.length > 0 ? (
                        executiveWiseClosedLeads.map((item, idx) => (
                          <tr key={idx} className={`border-b border-neutral-200/40 last:border-0 transition-colors hover:bg-neutral-50/50 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.zone || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-neutral-900 font-medium">{item.executiveName || 'Unassigned'}</td>
                            <td className="py-3 px-4 text-right"><span className="inline-flex px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-xs">{item.totalClosed}</span></td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-neutral-400">No data available</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        </Card>
        )}
      </div>
      )}

      {/* Comprehensive Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {currentUser?.role === 'Executive' ? (
            /* Executive Analytics */
            executiveLoading ? (
              <div className="text-center py-12">
                <div className="text-neutral-400">Loading your analytics...</div>
              </div>
            ) : executiveAnalytics ? (
              <>
                {/* Executive Leads Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Leads by Status</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <PieChart
                      data={executiveAnalytics.leads?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Leads by Priority</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <PieChart
                      data={executiveAnalytics.leads?.byPriority?.map((item: any) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: item._id === 'Hot' ? '#ef4444' : item._id === 'Warm' ? '#f59e0b' : '#6b7280'
                      })) || []}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Executive Payments Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Payments by Status</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <PieChart
                      data={executiveAnalytics.payments?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#f59e0b', '#10b981', '#ef4444', '#6b7280', '#3b82f6'][idx % 5]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Payments by Method</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <MultiBarChart
                      labels={executiveAnalytics.payments?.byMethod?.map((item: any) => item._id || 'Unknown') || []}
                      datasets={[{
                        label: 'Total Amount (₹)',
                        data: executiveAnalytics.payments?.byMethod?.map((item: any) => item.totalAmount || 0) || [],
                        color: '#10b981'
                      }]}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Executive Monthly Payments Trend */}
                {executiveAnalytics.payments?.monthly && executiveAnalytics.payments.monthly.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Monthly Payments Trend</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <LineChart
                      labels={executiveAnalytics.payments.monthly.map((item: any) => item._id || '')}
                      datasets={[{
                        label: 'Total Amount (₹)',
                        data: executiveAnalytics.payments.monthly.map((item: any) => item.totalAmount || 0),
                        color: '#10b981'
                      }]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Sales/DCs Analytics */}
                {executiveAnalytics.sales?.byStatus && executiveAnalytics.sales.byStatus.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Sales (DCs) by Status</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <PieChart
                      data={executiveAnalytics.sales.byStatus.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#6b7280'][idx % 5]
                      }))}
                      height={300}
                    />
                  </Card>
                )}

                {/* Expenses Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {executiveAnalytics.expenses?.byStatus && executiveAnalytics.expenses.byStatus.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Expenses by Status</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                          <Calculator className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <PieChart
                        data={executiveAnalytics.expenses.byStatus.map((item: any, idx: number) => ({
                          label: item._id || 'Unknown',
                          value: item.count || 0,
                          color: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#6b7280'][idx % 5]
                        }))}
                        height={300}
                      />
                    </Card>
                  )}
                  {executiveAnalytics.expenses?.byCategory && executiveAnalytics.expenses.byCategory.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Expenses by Category</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <MultiBarChart
                        labels={executiveAnalytics.expenses.byCategory.map((item: any) => item._id || 'Unknown')}
                        datasets={[{
                          label: 'Total Amount (₹)',
                          data: executiveAnalytics.expenses.byCategory.map((item: any) => item.totalAmount || 0),
                          color: '#ef4444'
                        }]}
                        height={300}
                      />
                    </Card>
                  )}
                </div>

                {/* Monthly Expenses Trend */}
                {executiveAnalytics.expenses?.monthly && executiveAnalytics.expenses.monthly.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Monthly Expenses Trend</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <LineChart
                      labels={executiveAnalytics.expenses.monthly.map((item: any) => item._id || '')}
                      datasets={[{
                        label: 'Total Amount (₹)',
                        data: executiveAnalytics.expenses.monthly.map((item: any) => item.totalAmount || 0),
                        color: '#ef4444'
                      }]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Revenue vs Expenses Comparison */}
                {executiveAnalytics.payments?.monthly && executiveAnalytics.expenses?.monthly && 
                 executiveAnalytics.payments.monthly.length > 0 && executiveAnalytics.expenses.monthly.length > 0 && (
                  <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-lg text-neutral-900">My Revenue vs Expenses</h3>
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <LineChart
                      labels={executiveAnalytics.payments.monthly.map((item: any) => item._id || '')}
                      datasets={[
                        {
                          label: 'Revenue (₹)',
                          data: executiveAnalytics.payments.monthly.map((item: any) => item.totalAmount || 0),
                          color: '#10b981'
                        },
                        {
                          label: 'Expenses (₹)',
                          data: executiveAnalytics.expenses.monthly.map((item: any) => item.totalAmount || 0),
                          color: '#ef4444'
                        }
                      ]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Training Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {executiveAnalytics.training?.byStatus && executiveAnalytics.training.byStatus.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Training by Status</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <PieChart
                        data={executiveAnalytics.training.byStatus.map((item: any, idx: number) => ({
                          label: item._id || 'Unknown',
                          value: item.count || 0,
                          color: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'][idx % 4]
                        }))}
                        height={300}
                      />
                    </Card>
                  )}
                  {executiveAnalytics.training?.bySubject && executiveAnalytics.training.bySubject.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Training by Subject</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <MultiBarChart
                        labels={executiveAnalytics.training.bySubject.slice(0, 8).map((item: any) => item._id || 'Unknown')}
                        datasets={[{
                          label: 'Count',
                          data: executiveAnalytics.training.bySubject.slice(0, 8).map((item: any) => item.count || 0),
                          color: '#8b5cf6'
                        }]}
                        height={300}
                      />
                    </Card>
                  )}
                </div>

                {/* Services Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {executiveAnalytics.services?.byStatus && executiveAnalytics.services.byStatus.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Services by Status</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <PieChart
                        data={executiveAnalytics.services.byStatus.map((item: any, idx: number) => ({
                          label: item._id || 'Unknown',
                          value: item.count || 0,
                          color: ['#3b82f6', '#10b981', '#ef4444', '#f59e0b'][idx % 4]
                        }))}
                        height={300}
                      />
                    </Card>
                  )}
                  {executiveAnalytics.services?.bySubject && executiveAnalytics.services.bySubject.length > 0 && (
                    <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-neutral-900">My Services by Subject</h3>
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                          <Package className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <MultiBarChart
                        labels={executiveAnalytics.services.bySubject.slice(0, 8).map((item: any) => item._id || 'Unknown')}
                        datasets={[{
                          label: 'Count',
                          data: executiveAnalytics.services.bySubject.slice(0, 8).map((item: any) => item.count || 0),
                          color: '#06b6d4'
                        }]}
                        height={300}
                      />
                    </Card>
                  )}
                </div>

                {/* Performance Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                    <div className="text-sm font-semibold text-blue-700 mb-2">Total Revenue</div>
                    <div className="text-2xl font-bold text-blue-900">{fmtINR(executiveAnalytics.payments?.totalAmount || 0)}</div>
                    <div className="text-xs text-blue-600 mt-1">{executiveAnalytics.payments?.total || 0} payments</div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200">
                    <div className="text-sm font-semibold text-red-700 mb-2">Total Expenses</div>
                    <div className="text-2xl font-bold text-red-900">{fmtINR(executiveAnalytics.expenses?.totalAmount || 0)}</div>
                    <div className="text-xs text-red-600 mt-1">{executiveAnalytics.expenses?.total || 0} expenses</div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
                    <div className="text-sm font-semibold text-green-700 mb-2">Net Profit</div>
                    <div className="text-2xl font-bold text-green-900">
                      {fmtINR((executiveAnalytics.payments?.totalAmount || 0) - (executiveAnalytics.expenses?.totalAmount || 0))}
                    </div>
                    <div className="text-xs text-green-600 mt-1">Revenue - Expenses</div>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
                    <div className="text-sm font-semibold text-purple-700 mb-2">Total Sales</div>
                    <div className="text-2xl font-bold text-purple-900">{executiveAnalytics.sales?.total || 0}</div>
                    <div className="text-xs text-purple-600 mt-1">{executiveAnalytics.sales?.completed || 0} completed</div>
                  </Card>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <div className="text-neutral-400">No analytics data available</div>
    </div>
  )
          ) : (
            /* Regular Analytics for non-executives */
            analyticsLoading ? (
              <div className="text-center py-12">
                <div className="text-neutral-400">Loading comprehensive analytics...</div>
              </div>
            ) : analyticsData ? (
              <>
                {/* Leads Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Leads by Status</h3>
                    <PieChart
                      data={analyticsData.leads?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][idx % 4]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Leads by Priority</h3>
                    <PieChart
                      data={analyticsData.leads?.byPriority?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#ef4444', '#f59e0b', '#6b7280'][idx % 3]
                      })) || []}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Payments Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Payments by Status</h3>
                    <PieChart
                      data={analyticsData.payments?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#10b981', '#f59e0b', '#ef4444', '#6b7280'][idx % 4]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Payments by Method</h3>
                    <MultiBarChart
                      labels={analyticsData.payments?.byMethod?.map((item: any) => item._id || 'Unknown') || []}
                      datasets={[{
                        label: 'Count',
                        data: analyticsData.payments?.byMethod?.map((item: any) => item.count || 0) || [],
                        color: '#3b82f6'
                      }]}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Monthly Payments Trend */}
                {analyticsData.payments?.monthly && analyticsData.payments.monthly.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Monthly Payments Trend</h3>
                    <LineChart
                      labels={analyticsData.payments.monthly.map((item: any) => item._id || '')}
                      datasets={[
                        {
                          label: 'Total Amount (₹)',
                          data: analyticsData.payments.monthly.map((item: any) => item.totalAmount || 0),
                          color: '#10b981'
                        },
                        {
                          label: 'Count',
                          data: analyticsData.payments.monthly.map((item: any) => item.count || 0),
                          color: '#3b82f6'
                        }
                      ]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Expenses Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Expenses by Status</h3>
                    <PieChart
                      data={analyticsData.expenses?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#6b7280'][idx % 5]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Expenses by Category</h3>
                    <MultiBarChart
                      labels={analyticsData.expenses?.byCategory?.map((item: any) => item._id || 'Unknown') || []}
                      datasets={[{
                        label: 'Total Amount (₹)',
                        data: analyticsData.expenses?.byCategory?.map((item: any) => item.totalAmount || 0) || [],
                        color: '#ef4444'
                      }]}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Monthly Expenses Trend */}
                {analyticsData.expenses?.monthly && analyticsData.expenses.monthly.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Monthly Expenses Trend</h3>
                    <LineChart
                      labels={analyticsData.expenses.monthly.map((item: any) => item._id || '')}
                      datasets={[
                        {
                          label: 'Total Amount (₹)',
                          data: analyticsData.expenses.monthly.map((item: any) => item.totalAmount || 0),
                          color: '#ef4444'
                        }
                      ]}
                      height={350}
                    />
                  </Card>
                )}

                {/* Training & Services Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold text-lg text-neutral-900 mb-6">Training by Status</h3>
                  <PieChart
                    data={analyticsData.training?.byStatus?.map((item: any, idx: number) => ({
                      label: item._id || 'Unknown',
                      value: item.count || 0,
                      color: ['#3b82f6', '#10b981', '#ef4444'][idx % 3]
                    })) || []}
                    height={280}
                  />
                </Card>
                <Card className="p-6">
                  <h3 className="font-semibold text-lg text-neutral-900 mb-6">Training by Subject</h3>
                  <MultiBarChart
                    labels={analyticsData.training?.bySubject?.map((item: any) => item._id || 'Unknown').slice(0, 8) || []}
                    datasets={[{
                      label: 'Count',
                      data: analyticsData.training?.bySubject?.map((item: any) => item.count || 0).slice(0, 8) || [],
                      color: '#8b5cf6'
                    }]}
                    height={280}
                  />
                </Card>
                <Card className="p-6">
                  <h3 className="font-semibold text-lg text-neutral-900 mb-6">Services by Status</h3>
                  <PieChart
                    data={analyticsData.services?.byStatus?.map((item: any, idx: number) => ({
                      label: item._id || 'Unknown',
                      value: item.count || 0,
                      color: ['#3b82f6', '#10b981', '#ef4444'][idx % 3]
                    })) || []}
                    height={280}
                  />
                </Card>
                </div>

                {/* Sales & Employees Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Sales (DCs) by Status</h3>
                    <PieChart
                      data={analyticsData.sales?.byStatus?.map((item: any, idx: number) => ({
                        label: item._id || 'Unknown',
                        value: item.count || 0,
                        color: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#6b7280'][idx % 5]
                      })) || []}
                      height={300}
                    />
                  </Card>
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Employees by Role</h3>
                    <MultiBarChart
                      labels={analyticsData.employees?.byRole?.map((item: any) => item._id || 'Unknown') || []}
                      datasets={[{
                        label: 'Count',
                        data: analyticsData.employees?.byRole?.map((item: any) => item.count || 0) || [],
                        color: '#06b6d4'
                      }]}
                      height={300}
                    />
                  </Card>
                </div>

                {/* Products Analytics */}
                {analyticsData.products?.byStatus && analyticsData.products.byStatus.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-neutral-900 mb-6">Products by Status</h3>
                    <PieChart
                      data={analyticsData.products.byStatus.map((item: any, idx: number) => ({
                        label: item._id === 1 ? 'Active' : item._id === 0 ? 'Inactive' : `Status ${item._id}`,
                        value: item.count || 0,
                        color: ['#10b981', '#ef4444', '#6b7280'][idx % 3]
                      }))}
                      height={300}
                    />
                  </Card>
                )}
            </>
          ) : (
            <div className="text-center py-12">
              <div className="text-neutral-400">No analytics data available</div>
            </div>
          )
        )}
      </div>
      )}

      {activeTab === 'ai' && (
        <div className="mt-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="h-8 w-8 text-blue-600" />
              <div>
                <h2 className="text-2xl font-bold">AI Intelligence Mode</h2>
                <p className="text-gray-600">Revenue & Risk Intelligence Platform</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg mb-6">
              <p className="text-gray-700 mb-4">
                Access advanced AI-powered insights to protect revenue, reduce risk, and improve decision-making.
              </p>
              <Link href="/dashboard/ai">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Open AI Dashboard
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(
                [
                  { tool: AI_TEASER_TOOLS[0], icon: DollarSign, iconClass: 'text-rose-500', desc: 'Identify revenue likely to get stuck or lost' },
                  { tool: AI_TEASER_TOOLS[1], icon: TrendingUp, iconClass: 'text-blue-500', desc: 'High-level view of revenue trends and issues' },
                  { tool: AI_TEASER_TOOLS[2], icon: Sparkles, iconClass: 'text-amber-500', desc: 'Automatically rank actions by business impact' },
                  { tool: AI_TEASER_TOOLS[3], icon: AlertTriangle, iconClass: 'text-red-500', desc: 'Identify deals at high risk of failing' },
                  { tool: AI_TEASER_TOOLS[4], icon: Users, iconClass: 'text-purple-500', desc: 'Highlight managers showing performance drops' },
                  { tool: AI_TEASER_TOOLS[5], icon: Shield, iconClass: 'text-orange-500', desc: 'Detect unusual patterns in transactions' },
                ] as const
              ).map(({ tool, icon: Icon, iconClass, desc }) => (
                <Link key={tool.id} href={`/dashboard/ai?tool=${tool.id}`} className="block">
                  <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors cursor-pointer h-full">
                    <Icon className={`h-6 w-6 ${iconClass} mb-2`} />
                    <h3 className="font-semibold mb-1">{tool.title}</h3>
                    <p className="text-sm text-gray-600">{desc}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </Card>
      </div>
      )}
    </div>
  )
}


