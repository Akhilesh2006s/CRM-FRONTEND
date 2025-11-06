'use client'

import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Zap, TrendingUp, DollarSign, GraduationCap, AlertTriangle, X, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import BarGradient from '@/components/charts/BarGradient'
import AreaGradient from '@/components/charts/AreaGradient'
import DoughnutStatus from '@/components/charts/DoughnutStatus'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const sections = [
  { href: '/dashboard/leads', label: 'Leads' },
  { href: '/dashboard/sales', label: 'Sales' },
  { href: '/dashboard/employees', label: 'Employees' },
  { href: '/dashboard/expenses', label: 'Expenses' },
  { href: '/dashboard/payments', label: 'Payments' },
  { href: '/dashboard/reports', label: 'Reports' },
  { href: '/dashboard/training', label: 'Training' },
  { href: '/dashboard/warehouse', label: 'Warehouse' },
  { href: '/dashboard/dc', label: 'Delivery Challans' },
  { href: '/dashboard/inventory', label: 'Inventory' },
]

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

const MOCK_STATS = [
  { value: 128 },
  { value: 74 },
  { value: 38 },
  { value: 5 },
  { value: 12 },
  { value: 9 },
  { value: 20 },
]

const MOCK_TRENDS = [
  { name: 'Mon', leads: 22, sales: 5, revenue: 48000 },
  { name: 'Tue', leads: 28, sales: 8, revenue: 62000 },
  { name: 'Wed', leads: 31, sales: 10, revenue: 75000 },
  { name: 'Thu', leads: 24, sales: 6, revenue: 41000 },
  { name: 'Fri', leads: 35, sales: 11, revenue: 92000 },
  { name: 'Sat', leads: 29, sales: 7, revenue: 56000 },
  { name: 'Sun', leads: 18, sales: 3, revenue: 23000 },
]

const MOCK_VOLUME = [
  { hour: '01:00', value: 82 },
  { hour: '02:00', value: 68 },
  { hour: '03:00', value: 46 },
  { hour: '04:00', value: 58 },
  { hour: '05:00', value: 30 },
  { hour: '06:00', value: 44 },
  { hour: '07:00', value: 64 },
  { hour: '08:00', value: 72 },
  { hour: '09:00', value: 98 },
  { hour: '10:00', value: 106 },
  { hour: '11:00', value: 120 },
  { hour: '12:00', value: 118 },
  { hour: '13:00', value: 136 },
  { hour: '14:00', value: 128 },
  { hour: '15:00', value: 132 },
  { hour: '16:00', value: 126 },
  { hour: '17:00', value: 130 },
  { hour: '18:00', value: 116 },
  { hour: '19:00', value: 84 },
  { hour: '20:00', value: 58 },
  { hour: '21:00', value: 92 },
  { hour: '22:00', value: 76 },
  { hour: '23:00', value: 36 },
  { hour: '24:00', value: 44 },
]

const MOCK_ZONES = [
  { zone: 'Nizamabad', total: 40, hot: 12, warm: 15, cold: 13 },
  { zone: 'Karimnagar', total: 32, hot: 9, warm: 12, cold: 11 },
  { zone: 'Warangal', total: 26, hot: 6, warm: 10, cold: 10 },
]

const MOCK_ALERTS = [
  { level: 'warning', text: 'Follow-up pending for 7 hot leads today' },
  { level: 'info', text: '3 trainings scheduled this week' },
]

// PIE_DATA will be computed from stats state

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
  const [stats, setStats] = useState(MOCK_STATS)
  const [trends, setTrends] = useState(MOCK_TRENDS)
  const [zones, setZones] = useState(MOCK_ZONES)
  const [alerts, setAlerts] = useState(MOCK_ALERTS)
  const [volume, setVolume] = useState(MOCK_VOLUME)
  const [activities, setActivities] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Leads analytics state
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [zoneWiseLeads, setZoneWiseLeads] = useState<ZoneWiseLeadData[]>([])
  const [executiveWiseLeads, setExecutiveWiseLeads] = useState<ExecutiveWiseLeadData[]>([])
  const [zoneWiseClosedLeads, setZoneWiseClosedLeads] = useState<ZoneWiseClosedLeadData[]>([])
  const [executiveWiseClosedLeads, setExecutiveWiseClosedLeads] = useState<ExecutiveWiseClosedLeadData[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads'>('dashboard')

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
    const fetchDashboardData = async () => {
      setLoading(true)
      try {
        // Fetch all dashboard data in parallel
        const [statsData, trendsData, volumeData, zonesData, alertsData, activitiesData] = await Promise.all([
          apiRequest<DashboardStats>('/dashboard/stats').catch(() => null),
          apiRequest<TrendData[]>('/dashboard/revenue-trends').catch(() => null),
          apiRequest<VolumeData[]>('/dashboard/leads-volume').catch(() => null),
          apiRequest<ZoneData[]>('/dashboard/leads-by-zone').catch(() => null),
          apiRequest<AlertData[]>('/dashboard/alerts').catch(() => null),
          apiRequest<ActivityData[]>('/dashboard/recent-activities').catch(() => null),
        ])

        // Update stats
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
        }

        // Update trends
        if (trendsData && trendsData.length > 0) {
          setTrends(trendsData)
        }

        // Update volume
        if (volumeData && volumeData.length > 0) {
          setVolume(volumeData)
        }

        // Update zones
        if (zonesData && zonesData.length > 0) {
          setZones(zonesData)
        } else if (zonesData && zonesData.length === 0) {
          setZones([]) // Empty array if no zones
        }

        // Update alerts
        if (alertsData && alertsData.length > 0) {
          setAlerts(alertsData)
        } else if (alertsData && alertsData.length === 0) {
          setAlerts([]) // Empty array if no alerts
        }

        // Update activities
        if (activitiesData && activitiesData.length > 0) {
          setActivities(activitiesData)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Keep using mock data on error
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
    fetchLeadsAnalytics() // Initial load without date filter
  }, [])

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

  const handleSearch = () => {
    fetchLeadsAnalytics()
  }

  return (
    <div className="space-y-8">
      {/* Premium Stat Cards - Minimal, elegant design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CONFIG.map((stat, i) => {
          const cls = accentToClasses[stat.accent]
          const grad = gradientMap[stat.accent]
          return (
            <div
              key={stat.label}
              className="group relative overflow-hidden rounded-xl border border-neutral-200/60 bg-white/90 backdrop-blur-sm p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-neutral-300/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{stat.label}</div>
                  <div className="text-3xl md:text-4xl font-bold text-neutral-900 leading-none mb-1">{stats[i]?.value ?? '0'}</div>
                </div>
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center bg-gradient-to-br ${grad} shadow-sm group-hover:shadow-md transition-shadow`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              {/* Subtle gradient accent */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${grad} opacity-60`} />
            </div>
          )
        })}
      </div>

      {/* Premium Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-neutral-200/60">
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'dashboard' | 'leads')} className="w-full">
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
          </TabsList>
        </Tabs>
      </div>

      {/* Dashboard Content */}
      {activeTab === 'dashboard' && (
        <>
          {/* Premium Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BarChart: Premium styling */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-semibold text-neutral-900 text-base mb-1">Leads Volume</div>
              <div className="text-xs text-neutral-500">Last 24 hours activity</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium border border-blue-100">24H</span>
              <span className="px-2.5 py-1 rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 cursor-pointer transition-colors">7D</span>
              <span className="px-2.5 py-1 rounded-md text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 cursor-pointer transition-colors">30D</span>
            </div>
          </div>
          <div className="h-[300px]">
            <BarGradient labels={volume.map(v=>v.hour)} values={volume.map(v=>v.value)} />
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
              return (
                <div key={entry.label} className="flex items-center gap-3 text-sm font-medium text-neutral-700 group">
                  <span className="w-3.5 h-3.5 rounded-full block ring-2 ring-white shadow-sm" style={{background: entry.color}}></span>
                  <span className="truncate flex-1">{entry.label}</span>
                  <span className="text-neutral-400 text-xs font-normal">{pct}%</span>
                  <span className="font-bold text-neutral-900 w-8 text-right">{entry.value}</span>
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
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors">View all</button>
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="text-neutral-400 text-sm">Loading alerts...</div>
            ) : alerts.length > 0 ? (
              alerts.map((a, idx) => (
                <div
                  key={idx}
                  className={`relative flex items-start gap-3 rounded-lg p-3 text-sm transition-all duration-200 hover:shadow-sm ${
                    a.level === 'warning'
                      ? 'bg-orange-50/80 text-orange-900 border border-orange-200/50'
                      : 'bg-emerald-50/80 text-emerald-900 border border-emerald-200/50'
                  }`}
                >
                  <span className={`absolute left-0 top-0 bottom-0 w-1 ${a.level === 'warning' ? 'bg-orange-500' : 'bg-emerald-500'} rounded-l-lg`} />
                  <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${a.level === 'warning' ? 'text-orange-600' : 'text-emerald-600'}`} />
                  <span className="leading-relaxed">{a.text}</span>
                </div>
              ))
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
          <div className="font-semibold text-neutral-900 mb-4 text-base">Recent Activity</div>
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
        <div className="hidden" />
      </div>
        </>
      )}

      {/* Premium Leads Dashboard Content */}
      {activeTab === 'leads' && (
      <div className="mt-6 space-y-6">
        <Card className="p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">Leads Analytics</h2>
            <p className="text-sm text-neutral-500">Filter and analyze leads by date range</p>
            
            {/* Premium Date Range Filter */}
            <div className="flex flex-wrap items-center gap-3 mt-6 p-4 bg-neutral-50/50 rounded-lg border border-neutral-200/60">
              <div className="flex items-center gap-2">
                <label htmlFor="fromDate" className="text-sm font-medium text-neutral-700 whitespace-nowrap">
                  From:
                </label>
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[160px] bg-white"
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
                  className="w-[160px] bg-white"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm hover:shadow-md transition-all"
              >
                Search
              </Button>
            </div>
          </div>

          <div className="space-y-6">
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
      </div>
      )}
    </div>
  )
}


