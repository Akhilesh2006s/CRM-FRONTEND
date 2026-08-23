'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { Users, TrendingUp, Package, ShoppingCart, Calendar, MapPin, Building2, UserPlus, ArrowLeft, Zap, DollarSign, Calculator, AlertTriangle, Award, BarChart3, Sparkles } from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { INDIAN_STATES, STATE_CITIES, getCitiesForState } from '@/lib/indianStatesCities'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import PieChart from '@/components/charts/PieChart'
import LineChart from '@/components/charts/LineChart'
import MultiBarChart from '@/components/charts/MultiBarChart'

type DashboardData = {
  totalEmployees: number
  managerState?: string | null
  employeesByZone: Record<string, number>
  employeesByArea: Record<string, number>
  totalLeads: number
  leadsByStatus: Record<string, number>
  totalDCs: number
  dcsByStatus: Record<string, number>
  totalSales: number
  totalLeaves: number
  leavesByStatus: Record<string, number>
  employeeDetails: EmployeeDetail[]
}

type EmployeeDetail = {
  _id: string
  name: string
  email: string
  phone?: string
  assignedCity?: string
  assignedArea?: string
  role: string
  department?: string
  totalLeads: number
  totalDCs: number
  totalSales: number
  totalLeaves: number
  pendingLeaves: number
}

export default function ExecutiveManagerDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const managerId = params.managerId as string
  const currentUser = getCurrentUser()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [assignZoneDialogOpen, setAssignZoneDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDetail | null>(null)
  const [zone, setZone] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignEmployeesDialogOpen, setAssignEmployeesDialogOpen] = useState(false)
  const [availableEmployees, setAvailableEmployees] = useState<EmployeeDetail[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [updateManagerStateDialogOpen, setUpdateManagerStateDialogOpen] = useState(false)
  const [managerStateInput, setManagerStateInput] = useState('')
  const [availableZones, setAvailableZones] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'analytics' | 'ai'>('dashboard')

  useEffect(() => {
    if (!currentUser) {
      router.push('/auth/login')
      return
    }
    if (managerId) {
      loadDashboard()
    }
  }, [managerId, fromDate, toDate])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      let url = `/executive-managers/${managerId}/dashboard`
      const params = new URLSearchParams()
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (params.toString()) url += `?${params.toString()}`
      
      const data = await apiRequest<DashboardData>(url)
      setDashboardData(data)
    } catch (err: any) {
      toast.error('Failed to load dashboard data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fmtINR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  // Computed values for charts
  const leadsByStatusArray = useMemo(() => {
    if (!dashboardData?.leadsByStatus) return []
    return Object.entries(dashboardData.leadsByStatus).map(([status, count]) => ({
      _id: status,
      count: count as number
    }))
  }, [dashboardData])

  const dcsByStatusArray = useMemo(() => {
    if (!dashboardData?.dcsByStatus) return []
    return Object.entries(dashboardData.dcsByStatus).map(([status, count]) => ({
      _id: status,
      count: count as number
    }))
  }, [dashboardData])

  const leavesByStatusArray = useMemo(() => {
    if (!dashboardData?.leavesByStatus) return []
    return Object.entries(dashboardData.leavesByStatus).map(([status, count]) => ({
      _id: status,
      count: count as number
    }))
  }, [dashboardData])

  const employeesByZoneArray = useMemo(() => {
    if (!dashboardData?.employeesByZone) return []
    return Object.entries(dashboardData.employeesByZone).map(([zone, count]) => ({
      zone,
      count: count as number
    }))
  }, [dashboardData])

  const employeesByAreaArray = useMemo(() => {
    if (!dashboardData?.employeesByArea) return []
    return Object.entries(dashboardData.employeesByArea).map(([area, count]) => ({
      area,
      count: count as number
    }))
  }, [dashboardData])

  // Top performing employees
  const topEmployeesByLeads = useMemo(() => {
    if (!dashboardData?.employeeDetails) return []
    return [...dashboardData.employeeDetails]
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 10)
  }, [dashboardData])

  const topEmployeesBySales = useMemo(() => {
    if (!dashboardData?.employeeDetails) return []
    return [...dashboardData.employeeDetails]
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 10)
  }, [dashboardData])

  const topEmployeesByDCs = useMemo(() => {
    if (!dashboardData?.employeeDetails) return []
    return [...dashboardData.employeeDetails]
      .sort((a, b) => b.totalDCs - a.totalDCs)
      .slice(0, 10)
  }, [dashboardData])

  // Calculate averages
  const avgLeadsPerEmployee = useMemo(() => {
    if (!dashboardData?.employeeDetails || dashboardData.employeeDetails.length === 0) return 0
    const total = dashboardData.employeeDetails.reduce((sum, emp) => sum + emp.totalLeads, 0)
    return Math.round(total / dashboardData.employeeDetails.length)
  }, [dashboardData])

  const avgSalesPerEmployee = useMemo(() => {
    if (!dashboardData?.employeeDetails || dashboardData.employeeDetails.length === 0) return 0
    const total = dashboardData.employeeDetails.reduce((sum, emp) => sum + emp.totalSales, 0)
    return Math.round(total / dashboardData.employeeDetails.length)
  }, [dashboardData])

  const avgDCsPerEmployee = useMemo(() => {
    if (!dashboardData?.employeeDetails || dashboardData.employeeDetails.length === 0) return 0
    const total = dashboardData.employeeDetails.reduce((sum, emp) => sum + emp.totalDCs, 0)
    return Math.round(total / dashboardData.employeeDetails.length)
  }, [dashboardData])

  // Lead conversion rate = (Closed + Saved) / total leads
  const leadConversionRate = useMemo(() => {
    if (!dashboardData?.totalLeads || dashboardData.totalLeads === 0) return 0
    const closedLeads =
      (dashboardData.leadsByStatus?.['Closed'] || 0) +
      (dashboardData.leadsByStatus?.['Saved'] || 0)
    return Math.round((closedLeads / dashboardData.totalLeads) * 100)
  }, [dashboardData])

  const openAssignZoneDialog = (employee: EmployeeDetail) => {
    setSelectedEmployee(employee)
    
    const managerState = dashboardData?.managerState || ''
    
    if (managerState) {
      const zones = getCitiesForState(managerState)
      setAvailableZones(zones)
      setZone(employee.assignedCity || '')
    } else {
      setAvailableZones([])
      setZone('')
    }
    
    setAssignZoneDialogOpen(true)
  }

  const openAssignEmployeesDialog = async () => {
    setSelectedEmployeeIds([])
    setAssignEmployeesDialogOpen(true)
    setLoadingEmployees(true)
    try {
      const allEmployees = await apiRequest<any[]>('/employees?isActive=true')
      
      const unassignedEmployees = allEmployees.filter(
        (emp: any) => {
          const isExecutive = emp.role === 'Executive' || emp.role === 'Employee'
          const notAssigned = !emp.executiveManagerId
          const notManager = emp.role !== 'Executive Manager' && emp.role !== 'Admin' && emp.role !== 'Super Admin'
          return isExecutive && notAssigned && notManager
        }
      )
      
      setAvailableEmployees(unassignedEmployees.map((emp: any) => ({
        _id: emp._id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        assignedCity: emp.assignedCity,
        assignedArea: emp.assignedArea,
        role: emp.role === 'Employee' ? 'Executive' : emp.role,
        department: emp.department,
        totalLeads: 0,
        totalDCs: 0,
        totalSales: 0,
        totalLeaves: 0,
        pendingLeaves: 0,
      })))
    } catch (err: any) {
      toast.error('Failed to load employees')
      console.error('Error loading employees:', err)
    } finally {
      setLoadingEmployees(false)
    }
  }

  const handleAssignEmployees = async () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee')
      return
    }

    setAssigning(true)
    try {
      await apiRequest(`/executive-managers/${managerId}/assign-employees`, {
        method: 'PUT',
        body: JSON.stringify({ employeeIds: selectedEmployeeIds }),
      })
      toast.success(`Successfully assigned ${selectedEmployeeIds.length} employee(s)`)
      setAssignEmployeesDialogOpen(false)
      loadDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign employees')
    } finally {
      setAssigning(false)
    }
  }

  const handleAssignZone = async () => {
    if (!selectedEmployee) {
      toast.error('No employee selected')
      return
    }

    if (!zone || !zone.trim()) {
      toast.error('Please select a zone (city)')
      return
    }

    setAssigning(true)
    try {
      await apiRequest('/executive-managers/assign-zone', {
        method: 'PUT',
        body: JSON.stringify({ 
          employeeId: selectedEmployee._id, 
          zone: zone.trim(),
        }),
      })
      toast.success(`Zone assigned successfully to ${selectedEmployee.name}`)
      setAssignZoneDialogOpen(false)
      setZone('')
      loadDashboard()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign zone')
    } finally {
      setAssigning(false)
    }
  }

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>
  }

  if (!dashboardData) {
    return <div className="text-center py-8">No data available</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/executive-managers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Managers
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Executive Manager Dashboard</h1>
          {dashboardData.managerState && (
            <span className="text-sm text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
              {dashboardData.managerState}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button onClick={openAssignEmployeesDialog}>
                <UserPlus className="w-4 h-4 mr-2" />
                Assign Employees
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setManagerStateInput(dashboardData?.managerState || '')
                  setUpdateManagerStateDialogOpen(true)
                }}
              >
                <MapPin className="w-4 h-4 mr-2" />
                {dashboardData?.managerState ? 'Update State' : 'Set State'}
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => router.push(`/dashboard/executive-managers/${managerId}/leaves`)}>
            <Calendar className="w-4 h-4 mr-2" />
            Manage Leaves
          </Button>
        </div>
      </div>

      {/* Date Filter */}
      <Card className="p-4 bg-neutral-50 border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-white"
              allowPastDates
            />
          </div>
          <div>
            <Label>To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-white"
              allowPastDates
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFromDate('')
                setToDate('')
                // If dates were already empty, still force a full reload
                if (!fromDate && !toDate) {
                  loadDashboard()
                }
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </Card>

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

      {/* Dashboard Tab Content */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
                  <div className="text-xs font-semibold text-blue-700 mb-1 uppercase">Total Employees</div>
                  <div className="text-2xl font-bold text-blue-900">{dashboardData.totalEmployees}</div>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
            <Card className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
                  <div className="text-xs font-semibold text-emerald-700 mb-1 uppercase">Total Leads</div>
                  <div className="text-2xl font-bold text-emerald-900">{dashboardData.totalLeads}</div>
                  <div className="text-xs text-emerald-600 mt-1">{leadConversionRate}% converted</div>
            </div>
                <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
        </Card>
            <Card className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
                  <div className="text-xs font-semibold text-orange-700 mb-1 uppercase">Total DCs</div>
                  <div className="text-2xl font-bold text-orange-900">{dashboardData.totalDCs}</div>
            </div>
            <Package className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
                  <div className="text-xs font-semibold text-purple-700 mb-1 uppercase">Total Sales</div>
                  <div className="text-2xl font-bold text-purple-900">{dashboardData.totalSales}</div>
            </div>
            <ShoppingCart className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
            <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-red-700 mb-1 uppercase">Total Leaves</div>
                  <div className="text-2xl font-bold text-red-900">{dashboardData.totalLeaves}</div>
                  <div className="text-xs text-red-600 mt-1">
                    {Object.values(dashboardData.leavesByStatus || {}).reduce((sum: number, count: any) => sum + (count || 0), 0) > 0 
                      ? `${dashboardData.leavesByStatus?.['Pending'] || 0} pending`
                      : 'All cleared'}
                  </div>
                </div>
                <Calendar className="w-8 h-8 text-red-500" />
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-cyan-700 mb-1 uppercase">Avg/Employee</div>
                  <div className="text-xl font-bold text-cyan-900">{avgLeadsPerEmployee} Leads</div>
                  <div className="text-xs text-cyan-600 mt-1">{avgSalesPerEmployee} Sales</div>
                </div>
                <BarChart3 className="w-8 h-8 text-cyan-500" />
          </div>
        </Card>
      </div>

          {/* Executive Activity Overview - Real-time Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-blue-700 uppercase">Active Executives</div>
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-900 mb-1">
                {dashboardData.employeeDetails.filter(emp => emp.totalLeads > 0 || emp.totalDCs > 0 || emp.totalSales > 0).length}
              </div>
              <div className="text-xs text-blue-600">
                out of {dashboardData.totalEmployees} executives
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-emerald-700 uppercase">Most Active Today</div>
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-lg font-bold text-emerald-900 mb-1 truncate">
                {topEmployeesByLeads[0]?.name.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-xs text-emerald-600">
                {topEmployeesByLeads[0]?.totalLeads || 0} leads generated
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-purple-700 uppercase">Top Sales Executive</div>
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-purple-900 mb-1 truncate">
                {topEmployeesBySales[0]?.name.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-xs text-purple-600">
                {topEmployeesBySales[0]?.totalSales || 0} sales closed
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-orange-700 uppercase">Team Efficiency</div>
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-3xl font-bold text-orange-900 mb-1">{leadConversionRate}%</div>
              <div className="text-xs text-orange-600">
                Lead conversion rate
              </div>
            </Card>
          </div>

          {/* Executive Performance Comparison - Detailed View */}
          {dashboardData.employeeDetails && dashboardData.employeeDetails.length > 0 && (
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">Executive Performance Comparison</h3>
                  <p className="text-xs text-neutral-500 mt-1">Detailed comparison of all executives' activities and performance</p>
                </div>
                <BarChart3 className="w-5 h-5 text-indigo-500" />
              </div>
              <MultiBarChart
                labels={dashboardData.employeeDetails
                  .sort((a, b) => (b.totalLeads + b.totalDCs + b.totalSales) - (a.totalLeads + a.totalDCs + a.totalSales))
                  .map(emp => emp.name.split(' ')[0] + (emp.name.split(' ')[1] ? ' ' + emp.name.split(' ')[1].charAt(0) + '.' : ''))}
                datasets={[
                  {
                    label: 'Leads',
                    data: dashboardData.employeeDetails
                      .sort((a, b) => (b.totalLeads + b.totalDCs + b.totalSales) - (a.totalLeads + a.totalDCs + a.totalSales))
                      .map(emp => emp.totalLeads),
                    color: '#3b82f6'
                  },
                  {
                    label: 'DCs',
                    data: dashboardData.employeeDetails
                      .sort((a, b) => (b.totalLeads + b.totalDCs + b.totalSales) - (a.totalLeads + a.totalDCs + a.totalSales))
                      .map(emp => emp.totalDCs),
                    color: '#f59e0b'
                  },
                  {
                    label: 'Sales',
                    data: dashboardData.employeeDetails
                      .sort((a, b) => (b.totalLeads + b.totalDCs + b.totalSales) - (a.totalLeads + a.totalDCs + a.totalSales))
                      .map(emp => emp.totalSales),
                    color: '#a855f7'
                  }
                ]}
                height={450}
              />
            </Card>
          )}

          {/* Executive Activity Breakdown by Zone */}
          {employeesByZoneArray.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Executive Distribution by Zone</h3>
                    <p className="text-xs text-neutral-500 mt-1">How executives are distributed across zones</p>
                  </div>
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <PieChart
                  data={employeesByZoneArray.map((item, idx) => ({
                    label: item.zone || 'Unassigned',
                    value: item.count,
                    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'][idx % 8]
                  }))}
                  height={300}
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {employeesByZoneArray.slice(0, 6).map((item) => {
                    const employeesInZone = dashboardData.employeeDetails.filter(emp => emp.assignedCity === item.zone)
                    const totalActivity = employeesInZone.reduce((sum, emp) => sum + emp.totalLeads + emp.totalDCs + emp.totalSales, 0)
                    return (
                      <div key={item.zone} className="text-center p-2 bg-neutral-50 rounded border">
                        <div className="text-lg font-bold text-neutral-900">{item.count}</div>
                        <div className="text-xs text-neutral-600 truncate mb-1">{item.zone || 'Unassigned'}</div>
                        <div className="text-xs text-neutral-500">{totalActivity} activities</div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Executive Activity by Zone</h3>
                    <p className="text-xs text-neutral-500 mt-1">Total activities (Leads + DCs + Sales) per zone</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                </div>
                <MultiBarChart
                  labels={employeesByZoneArray.map(item => item.zone || 'Unassigned')}
                  datasets={[{
                    label: 'Total Activities',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalLeads + emp.totalDCs + emp.totalSales, 0)
                    }),
                    color: '#10b981'
                  }]}
                  height={380}
                />
              </Card>
            </div>
          )}

          {/* Employee Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Employees by Zone */}
            {employeesByZoneArray.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Employees by Zone (City)</h3>
                    <p className="text-xs text-neutral-500 mt-1">Distribution of employees across zones</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                </div>
                <PieChart
                  data={employeesByZoneArray.map((item, idx) => ({
                    label: item.zone || 'Unassigned',
                    value: item.count,
                    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'][idx % 8]
                  }))}
                  height={300}
                />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {employeesByZoneArray.slice(0, 6).map((item) => (
                    <div key={item.zone} className="text-center p-2 bg-neutral-50 rounded">
                      <div className="text-lg font-bold text-neutral-900">{item.count}</div>
                      <div className="text-xs text-neutral-600 truncate">{item.zone || 'Unassigned'}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Employees by Area */}
            {employeesByAreaArray.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Employees by Area</h3>
                    <p className="text-xs text-neutral-500 mt-1">Distribution of employees across areas</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                </div>
                <MultiBarChart
                  labels={employeesByAreaArray.map(item => item.area || 'Unassigned')}
                  datasets={[{
                    label: 'Employees',
                    data: employeesByAreaArray.map(item => item.count),
                    color: '#8b5cf6'
                  }]}
                  height={300}
                />
              </Card>
            )}
          </div>

          {/* Zone Performance Breakdown */}
          {employeesByZoneArray.length > 0 && dashboardData.employeeDetails.length > 0 && (
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">Zone Performance Overview</h3>
                  <p className="text-xs text-neutral-500 mt-1">Comprehensive performance metrics by zone</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
              </div>
              <MultiBarChart
                labels={employeesByZoneArray.map(item => item.zone || 'Unassigned')}
                datasets={[
                  {
                    label: 'Employees',
                    data: employeesByZoneArray.map(item => item.count),
                    color: '#3b82f6'
                  },
                  {
                    label: 'Total Leads',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalLeads, 0)
                    }),
                    color: '#10b981'
                  },
                  {
                    label: 'Total Sales',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalSales, 0)
                    }),
                    color: '#a855f7'
                  },
                  {
                    label: 'Total DCs',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalDCs, 0)
                    }),
                    color: '#f59e0b'
                  }
                ]}
                height={400}
              />
            </Card>
          )}

          {/* Employee Activity Distribution */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">Employee Activity Distribution</h3>
                <p className="text-xs text-neutral-500 mt-1">Workload and activity levels across team</p>
              </div>
              <Users className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-medium text-blue-900 mb-2">Highly Active</div>
                <div className="text-2xl font-bold text-blue-700 mb-1">
                  {dashboardData.employeeDetails.filter(emp => emp.totalLeads > avgLeadsPerEmployee * 1.5).length}
                </div>
                <div className="text-xs text-blue-600">Above {Math.round(avgLeadsPerEmployee * 1.5)} leads</div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="text-sm font-medium text-emerald-900 mb-2">Moderately Active</div>
                <div className="text-2xl font-bold text-emerald-700 mb-1">
                  {dashboardData.employeeDetails.filter(emp => 
                    emp.totalLeads >= avgLeadsPerEmployee * 0.5 && emp.totalLeads <= avgLeadsPerEmployee * 1.5
                  ).length}
                </div>
                <div className="text-xs text-emerald-600">Between {Math.round(avgLeadsPerEmployee * 0.5)}-{Math.round(avgLeadsPerEmployee * 1.5)} leads</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-sm font-medium text-orange-900 mb-2">Needs Attention</div>
                <div className="text-2xl font-bold text-orange-700 mb-1">
                  {dashboardData.employeeDetails.filter(emp => emp.totalLeads < avgLeadsPerEmployee * 0.5 && emp.totalLeads >= 0).length}
                </div>
                <div className="text-xs text-orange-600">Below {Math.round(avgLeadsPerEmployee * 0.5)} leads</div>
              </div>
            </div>
          </Card>

          {/* Leads Status Breakdown */}
          {leadsByStatusArray.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Team Leads by Status</h3>
                    <p className="text-xs text-neutral-500 mt-1">Current status distribution of all leads</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <PieChart
                  data={leadsByStatusArray.map((item, idx) => ({
                    label: item._id || 'Unknown',
                    value: item.count,
                    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6]
                  }))}
                  height={280}
                />
              </Card>

              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Sales & DCs Status</h3>
                    <p className="text-xs text-neutral-500 mt-1">Distribution of DCs by status</p>
                  </div>
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                {dcsByStatusArray.length > 0 ? (
                  <PieChart
                    data={dcsByStatusArray.map((item, idx) => ({
                      label: item._id || 'Unknown',
                      value: item.count,
                      color: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#6b7280'][idx % 5]
                    }))}
                    height={280}
                  />
                ) : (
                  <div className="text-center py-12 text-neutral-400">No DC data available</div>
                )}
              </Card>
                </div>
          )}

          {/* Top Performing Employees */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top Employees by Leads */}
            {topEmployeesByLeads.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-900">Top Employees by Leads</h3>
                    <p className="text-xs text-neutral-500 mt-1">Leading lead generators</p>
          </div>
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                </div>
                <MultiBarChart
                  labels={topEmployeesByLeads.slice(0, 5).map(emp => emp.name.split(' ')[0])}
                  datasets={[{
                    label: 'Leads',
                    data: topEmployeesByLeads.slice(0, 5).map(emp => emp.totalLeads),
                    color: '#3b82f6'
                  }]}
                  height={250}
                />
        </Card>
            )}

            {/* Top Employees by Sales */}
            {topEmployeesBySales.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-900">Top Employees by Sales</h3>
                    <p className="text-xs text-neutral-500 mt-1">Best sales performers</p>
      </div>
                  <ShoppingCart className="w-5 h-5 text-purple-500" />
                </div>
                <MultiBarChart
                  labels={topEmployeesBySales.slice(0, 5).map(emp => emp.name.split(' ')[0])}
                  datasets={[{
                    label: 'Sales',
                    data: topEmployeesBySales.slice(0, 5).map(emp => emp.totalSales),
                    color: '#a855f7'
                  }]}
                  height={250}
                />
              </Card>
            )}

            {/* Top Employees by DCs */}
            {topEmployeesByDCs.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-base text-neutral-900">Top Employees by DCs</h3>
                    <p className="text-xs text-neutral-500 mt-1">DC generation leaders</p>
                  </div>
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <MultiBarChart
                  labels={topEmployeesByDCs.slice(0, 5).map(emp => emp.name.split(' ')[0])}
                  datasets={[{
                    label: 'DCs',
                    data: topEmployeesByDCs.slice(0, 5).map(emp => emp.totalDCs),
                    color: '#f59e0b'
                  }]}
                  height={250}
                />
              </Card>
            )}
          </div>

          {/* Performance Metrics & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900">Team Performance Metrics</h3>
                <Award className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Avg Leads/Employee</span>
                    <span className="font-bold text-neutral-900">{avgLeadsPerEmployee}</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-500 h-2.5 rounded-full transition-all" 
                      style={{ width: `${Math.min((avgLeadsPerEmployee / Math.max(...dashboardData.employeeDetails.map(e => e.totalLeads).concat([1]), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Max: {Math.max(...dashboardData.employeeDetails.map(e => e.totalLeads), 0)}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Avg Sales/Employee</span>
                    <span className="font-bold text-neutral-900">{avgSalesPerEmployee}</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div 
                      className="bg-purple-500 h-2.5 rounded-full transition-all" 
                      style={{ width: `${Math.min((avgSalesPerEmployee / Math.max(...dashboardData.employeeDetails.map(e => e.totalSales).concat([1]), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Max: {Math.max(...dashboardData.employeeDetails.map(e => e.totalSales), 0)}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Avg DCs/Employee</span>
                    <span className="font-bold text-neutral-900">{avgDCsPerEmployee}</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div 
                      className="bg-orange-500 h-2.5 rounded-full transition-all" 
                      style={{ width: `${Math.min((avgDCsPerEmployee / Math.max(...dashboardData.employeeDetails.map(e => e.totalDCs).concat([1]), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Max: {Math.max(...dashboardData.employeeDetails.map(e => e.totalDCs), 0)}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-neutral-600">Lead Conversion Rate</span>
                    <span className="font-bold text-neutral-900">{leadConversionRate}%</span>
                  </div>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div 
                      className="bg-emerald-500 h-2.5 rounded-full transition-all" 
                      style={{ width: `${leadConversionRate}%` }}
                    />
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {(dashboardData.leadsByStatus?.['Closed'] || 0) + (dashboardData.leadsByStatus?.['Saved'] || 0)} closed out of {dashboardData.totalLeads}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900">Team Summary</h3>
                <Users className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <span className="text-sm font-medium text-blue-900">Total Employees</span>
                    <div className="text-xs text-blue-600 mt-0.5">
                      {employeesByZoneArray.length} zones • {employeesByAreaArray.length} areas
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-blue-700">{dashboardData.totalEmployees}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div>
                    <span className="text-sm font-medium text-emerald-900">Total Leads</span>
                    <div className="text-xs text-emerald-600 mt-0.5">
                      {leadConversionRate}% converted
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-emerald-700">{dashboardData.totalLeads}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div>
                    <span className="text-sm font-medium text-purple-900">Total Sales</span>
                    <div className="text-xs text-purple-600 mt-0.5">
                      Avg {avgSalesPerEmployee}/employee
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-purple-700">{dashboardData.totalSales}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <span className="text-sm font-medium text-orange-900">Total DCs</span>
                    <div className="text-xs text-orange-600 mt-0.5">
                      Avg {avgDCsPerEmployee}/employee
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-orange-700">{dashboardData.totalDCs}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900">Leave Status</h3>
                <Calendar className="w-5 h-5 text-red-500" />
              </div>
              {leavesByStatusArray.length > 0 ? (
                <>
                  <PieChart
                    data={leavesByStatusArray.map((item, idx) => ({
                      label: item._id || 'Unknown',
                      value: item.count,
                      color: ['#ef4444', '#10b981', '#f59e0b', '#6b7280'][idx % 4]
                    }))}
                    height={180}
                  />
                  <div className="mt-4 space-y-2">
                    {leavesByStatusArray.map((item) => (
                      <div key={item._id} className="flex justify-between items-center text-sm">
                        <span className="text-neutral-600">{item._id || 'Unknown'}</span>
                        <span className="font-bold text-neutral-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-neutral-400">No leave data</div>
              )}
            </Card>
          </div>

          {/* Executive Activity Rankings */}
          {dashboardData.employeeDetails && dashboardData.employeeDetails.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-base text-neutral-900">Top 10 Executives by Activity</h3>
                  <p className="text-xs text-neutral-500 mt-1">Ranked by total activities (Leads + DCs + Sales)</p>
                </div>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {dashboardData.employeeDetails
                  .map(emp => ({
                    ...emp,
                    totalActivity: emp.totalLeads + emp.totalDCs + emp.totalSales
                  }))
                  .sort((a, b) => b.totalActivity - a.totalActivity)
                  .slice(0, 10)
                  .map((emp, idx) => (
                    <div key={emp._id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          idx === 0 ? 'bg-amber-500 text-white' :
                          idx === 1 ? 'bg-neutral-400 text-white' :
                          idx === 2 ? 'bg-orange-500 text-white' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-neutral-900">{emp.name}</div>
                          <div className="text-xs text-neutral-500">{emp.assignedCity || 'Zone: Unassigned'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-neutral-900">{emp.totalActivity}</div>
                        <div className="text-xs text-neutral-500">
                          {emp.totalLeads}L • {emp.totalDCs}D • {emp.totalSales}S
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-base text-neutral-900">Executive Activity Distribution</h3>
                  <p className="text-xs text-neutral-500 mt-1">How activities are distributed across executives</p>
                </div>
                <Users className="w-5 h-5 text-cyan-500" />
              </div>
              <MultiBarChart
                labels={dashboardData.employeeDetails
                  .map(emp => ({
                    name: emp.name,
                    total: emp.totalLeads + emp.totalDCs + emp.totalSales
                  }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8)
                  .map(emp => emp.name.split(' ')[0])}
                datasets={[
                  {
                    label: 'Leads',
                    data: dashboardData.employeeDetails
                      .map(emp => ({
                        name: emp.name,
                        total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                        leads: emp.totalLeads
                      }))
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 8)
                      .map(emp => emp.leads),
                    color: '#3b82f6'
                  },
                  {
                    label: 'DCs',
                    data: dashboardData.employeeDetails
                      .map(emp => ({
                        name: emp.name,
                        total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                        dcs: emp.totalDCs
                      }))
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 8)
                      .map(emp => emp.dcs),
                    color: '#f59e0b'
                  },
                  {
                    label: 'Sales',
                    data: dashboardData.employeeDetails
                      .map(emp => ({
                        name: emp.name,
                        total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                        sales: emp.totalSales
                      }))
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 8)
                      .map(emp => emp.sales),
                    color: '#a855f7'
                  }
                ]}
                height={380}
              />
            </Card>

            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900">Executive Activity Insights</h3>
                <Zap className="w-5 h-5 text-purple-500" />
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm font-semibold text-blue-900 mb-2">High Performers</div>
                  <div className="text-2xl font-bold text-blue-700 mb-1">
                    {dashboardData.employeeDetails.filter(emp => 
                      (emp.totalLeads + emp.totalDCs + emp.totalSales) > avgLeadsPerEmployee * 2
                    ).length}
                  </div>
                  <div className="text-xs text-blue-600">Above 2x average activity</div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-sm font-semibold text-emerald-900 mb-2">Active Executives</div>
                  <div className="text-2xl font-bold text-emerald-700 mb-1">
                    {dashboardData.employeeDetails.filter(emp => 
                      emp.totalLeads > 0 || emp.totalDCs > 0 || emp.totalSales > 0
                    ).length}
                  </div>
                  <div className="text-xs text-emerald-600">With at least one activity</div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-sm font-semibold text-orange-900 mb-2">Needs Support</div>
                  <div className="text-2xl font-bold text-orange-700 mb-1">
                    {dashboardData.employeeDetails.filter(emp => 
                      emp.totalLeads === 0 && emp.totalDCs === 0 && emp.totalSales === 0
                    ).length}
                  </div>
                  <div className="text-xs text-orange-600">No activities recorded</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-sm font-semibold text-purple-900 mb-2">Avg Activity/Executive</div>
                  <div className="text-2xl font-bold text-purple-700 mb-1">
                    {dashboardData.employeeDetails.length > 0
                      ? Math.round(dashboardData.employeeDetails.reduce((sum, emp) => 
                          sum + emp.totalLeads + emp.totalDCs + emp.totalSales, 0) / dashboardData.employeeDetails.length)
                      : 0}
                  </div>
                  <div className="text-xs text-purple-600">Total activities per executive</div>
                </div>
              </div>
            </Card>
          </div>
          )}

          {/* Employee Workload Analysis */}
          {dashboardData.employeeDetails && dashboardData.employeeDetails.length > 0 && (
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">Employee Workload Analysis</h3>
                <p className="text-xs text-neutral-500 mt-1">Combined performance view (Leads + DCs + Sales)</p>
              </div>
              <BarChart3 className="w-5 h-5 text-indigo-500" />
            </div>
            <MultiBarChart
              labels={dashboardData.employeeDetails
                .map(emp => ({
                  name: emp.name,
                  total: emp.totalLeads + emp.totalDCs + emp.totalSales
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 12)
                .map(emp => emp.name.split(' ')[0])}
              datasets={[
                {
                  label: 'Leads',
                  data: dashboardData.employeeDetails
                    .map(emp => ({
                      name: emp.name,
                      total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                      leads: emp.totalLeads
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 12)
                    .map(emp => emp.leads),
                  color: '#3b82f6'
                },
                {
                  label: 'DCs',
                  data: dashboardData.employeeDetails
                    .map(emp => ({
                      name: emp.name,
                      total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                      dcs: emp.totalDCs
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 12)
                    .map(emp => emp.dcs),
                  color: '#f59e0b'
                },
                {
                  label: 'Sales',
                  data: dashboardData.employeeDetails
                    .map(emp => ({
                      name: emp.name,
                      total: emp.totalLeads + emp.totalDCs + emp.totalSales,
                      sales: emp.totalSales
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 12)
                    .map(emp => emp.sales),
                  color: '#a855f7'
                }
              ]}
              height={400}
            />
          </Card>
          )}

          {/* Performance Insights */}
          {dashboardData.employeeDetails && dashboardData.employeeDetails.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-2 uppercase">Best Lead Generator</div>
              <div className="text-xl font-bold text-blue-900 mb-1">
                {topEmployeesByLeads[0]?.name.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-sm text-blue-700">{topEmployeesByLeads[0]?.totalLeads || 0} leads</div>
              <div className="text-xs text-blue-600 mt-1">
                {topEmployeesByLeads[0]?.assignedCity || 'Zone: Unassigned'}
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
              <div className="text-xs font-semibold text-purple-700 mb-2 uppercase">Best Sales Person</div>
              <div className="text-xl font-bold text-purple-900 mb-1">
                {topEmployeesBySales[0]?.name.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-sm text-purple-700">{topEmployeesBySales[0]?.totalSales || 0} sales</div>
              <div className="text-xs text-purple-600 mt-1">
                {topEmployeesBySales[0]?.assignedCity || 'Zone: Unassigned'}
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
              <div className="text-xs font-semibold text-orange-700 mb-2 uppercase">Best DC Generator</div>
              <div className="text-xl font-bold text-orange-900 mb-1">
                {topEmployeesByDCs[0]?.name.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-sm text-orange-700">{topEmployeesByDCs[0]?.totalDCs || 0} DCs</div>
              <div className="text-xs text-orange-600 mt-1">
                {topEmployeesByDCs[0]?.assignedCity || 'Zone: Unassigned'}
              </div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200">
              <div className="text-xs font-semibold text-cyan-700 mb-2 uppercase">Most Active Zone</div>
              <div className="text-xl font-bold text-cyan-900 mb-1">
                {employeesByZoneArray.length > 0 
                  ? employeesByZoneArray.sort((a, b) => b.count - a.count)[0]?.zone?.split(' ')[0] || 'N/A'
                  : 'N/A'}
              </div>
              <div className="text-sm text-cyan-700">
                {employeesByZoneArray.length > 0 
                  ? employeesByZoneArray.sort((a, b) => b.count - a.count)[0]?.count || 0
                  : 0} employees
              </div>
              <div className="text-xs text-cyan-600 mt-1">
                {employeesByZoneArray.length > 0 
                  ? employeesByZoneArray
                      .map(zoneItem => {
                        const employeesInZone = dashboardData.employeeDetails.filter(
                          emp => emp.assignedCity === zoneItem.zone
                        )
                        return {
                          zone: zoneItem.zone,
                          leads: employeesInZone.reduce((sum, emp) => sum + emp.totalLeads, 0)
                        }
                      })
                      .sort((a, b) => b.leads - a.leads)[0]?.leads || 0
                  : 0} leads
              </div>
            </Card>
          </div>
          )}

          {/* Employee Performance Table */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <h3 className="font-semibold text-lg text-neutral-900 mb-4">Employee Performance Details</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Zone</TableHead>
                    <TableHead>Area</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>DCs</TableHead>
                <TableHead>Sales</TableHead>
                <TableHead>Leaves</TableHead>
                    <TableHead>Total Activity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboardData.employeeDetails.length === 0 ? (
                <TableRow>
                      <TableCell colSpan={11} className="text-center text-neutral-500">
                        No executives assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                    dashboardData.employeeDetails
                      .map(emp => ({
                        ...emp,
                        totalActivity: emp.totalLeads + emp.totalDCs + emp.totalSales
                      }))
                      .sort((a, b) => b.totalActivity - a.totalActivity)
                      .map((employee, index) => (
                      <TableRow key={employee._id} className={index < 3 ? 'bg-amber-50/50' : ''}>
                    <TableCell>
                          <div className="flex items-center gap-2">
                            {index < 3 && (
                              <Award className={`w-4 h-4 ${
                                index === 0 ? 'text-amber-500' :
                                index === 1 ? 'text-neutral-400' :
                                'text-orange-500'
                              }`} />
                            )}
                            <span className="font-medium">{employee.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{employee.email}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-400" />
                            {employee.assignedCity || '-'}
                          </span>
                        </TableCell>
                        <TableCell>{employee.assignedArea || '-'}</TableCell>
                        <TableCell>
                          <span className="font-semibold text-blue-600">{employee.totalLeads}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-orange-600">{employee.totalDCs}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-purple-600">{employee.totalSales}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{employee.totalLeaves}</span>
                            {employee.pendingLeaves > 0 && (
                              <span className="text-xs text-orange-600">({employee.pendingLeaves} pending)</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-neutral-900">{employee.totalActivity}</span>
                            <span className="text-xs text-neutral-500">Total Activity</span>
                          </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssignZoneDialog(employee)}
                      >
                        Assign Zone
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
        </div>
      )}

      {/* Leads Dashboard Tab Content */}
      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-700 mb-1 uppercase">Total Leads</div>
              <div className="text-3xl font-bold text-emerald-900">{dashboardData.totalLeads}</div>
              <div className="text-xs text-emerald-600 mt-1">{leadConversionRate}% conversion</div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
              <div className="text-xs font-semibold text-blue-700 mb-1 uppercase">Avg Leads/Employee</div>
              <div className="text-3xl font-bold text-blue-900">{avgLeadsPerEmployee}</div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
              <div className="text-xs font-semibold text-purple-700 mb-1 uppercase">Top Performer</div>
              <div className="text-xl font-bold text-purple-900">
                {topEmployeesByLeads[0]?.name.split(' ')[0] || '-'}
              </div>
              <div className="text-xs text-purple-600 mt-1">{topEmployeesByLeads[0]?.totalLeads || 0} leads</div>
            </Card>
            <Card className="p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200">
              <div className="text-xs font-semibold text-cyan-700 mb-1 uppercase">Employees Active</div>
              <div className="text-3xl font-bold text-cyan-900">
                {dashboardData.employeeDetails.filter(e => e.totalLeads > 0).length}
              </div>
              <div className="text-xs text-cyan-600 mt-1">out of {dashboardData.totalEmployees}</div>
            </Card>
          </div>

          {/* Leads by Status */}
          {leadsByStatusArray.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Team Leads by Status</h3>
                    <p className="text-xs text-neutral-500 mt-1">Distribution of all team leads by status</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                </div>
                <PieChart
                  data={leadsByStatusArray.map((item, idx) => ({
                    label: item._id || 'Unknown',
                    value: item.count,
                    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][idx % 6]
                  }))}
                  height={320}
                />
              </Card>

              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Leads by Status (Bar)</h3>
                    <p className="text-xs text-neutral-500 mt-1">Visual breakdown of lead statuses</p>
                  </div>
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                </div>
                <MultiBarChart
                  labels={leadsByStatusArray.map(item => item._id || 'Unknown')}
                  datasets={[{
                    label: 'Leads',
                    data: leadsByStatusArray.map(item => item.count),
                    color: '#3b82f6'
                  }]}
                  height={320}
                />
              </Card>
            </div>
          )}

          {/* Employee Leads Performance */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">Employee Leads Performance</h3>
                <p className="text-xs text-neutral-500 mt-1">Lead generation by each employee in your team</p>
              </div>
              <Users className="w-5 h-5 text-emerald-500" />
            </div>
            <MultiBarChart
              labels={dashboardData.employeeDetails.slice(0, 15).map(emp => emp.name.split(' ')[0])}
              datasets={[{
                label: 'Leads Generated',
                data: dashboardData.employeeDetails.slice(0, 15).map(emp => emp.totalLeads),
                color: '#10b981'
              }]}
              height={400}
            />
          </Card>

          {/* Zone-Wise Leads Distribution */}
          {employeesByZoneArray.length > 0 && dashboardData.employeeDetails.length > 0 && (
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">Leads Distribution by Zone</h3>
                  <p className="text-xs text-neutral-500 mt-1">Lead generation across different zones</p>
                </div>
                <MapPin className="w-5 h-5 text-blue-500" />
              </div>
              <MultiBarChart
                labels={employeesByZoneArray.map(item => item.zone || 'Unassigned')}
                datasets={[{
                  label: 'Leads',
                  data: employeesByZoneArray.map(zoneItem => {
                    const employeesInZone = dashboardData.employeeDetails.filter(
                      emp => emp.assignedCity === zoneItem.zone
                    )
                    return employeesInZone.reduce((sum, emp) => sum + emp.totalLeads, 0)
                  }),
                  color: '#3b82f6'
                }]}
                height={350}
              />
            </Card>
          )}

          {/* Top 10 Employees by Leads */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">Top 10 Employees by Leads</h3>
                <p className="text-xs text-neutral-500 mt-1">Your top performing team members</p>
              </div>
              <Award className="w-5 h-5 text-amber-500" />
            </div>
            <MultiBarChart
              labels={topEmployeesByLeads.slice(0, 10).map(emp => emp.name.split(' ')[0])}
              datasets={[{
                label: 'Total Leads',
                data: topEmployeesByLeads.slice(0, 10).map(emp => emp.totalLeads),
                color: '#f59e0b'
              }]}
              height={350}
            />
          </Card>
        </div>
      )}

      {/* Comprehensive Analytics Tab Content */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Sales Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dcsByStatusArray.length > 0 && (
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">DCs by Status</h3>
                    <p className="text-xs text-neutral-500 mt-1">Distribution of DCs by status</p>
                  </div>
                  <Package className="w-5 h-5 text-orange-500" />
                </div>
                <PieChart
                  data={dcsByStatusArray.map((item, idx) => ({
                    label: item._id || 'Unknown',
                    value: item.count,
                    color: ['#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#6b7280'][idx % 5]
                  }))}
                  height={300}
                />
              </Card>
            )}

            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">Employee Sales Performance</h3>
                  <p className="text-xs text-neutral-500 mt-1">Sales performance comparison</p>
                </div>
                <ShoppingCart className="w-5 h-5 text-purple-500" />
              </div>
              <MultiBarChart
                labels={dashboardData.employeeDetails.slice(0, 12).map(emp => emp.name.split(' ')[0])}
                datasets={[{
                  label: 'Sales',
                  data: dashboardData.employeeDetails.slice(0, 12).map(emp => emp.totalSales),
                  color: '#a855f7'
                }]}
                height={300}
              />
            </Card>
          </div>

          {/* Employee Performance Comparison */}
          <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-neutral-900">Employee Performance Comparison</h3>
                <p className="text-xs text-neutral-500 mt-1">Comparative view of leads, DCs, and sales</p>
              </div>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <MultiBarChart
              labels={dashboardData.employeeDetails.slice(0, 10).map(emp => emp.name.split(' ')[0])}
              datasets={[
                {
                  label: 'Leads',
                  data: dashboardData.employeeDetails.slice(0, 10).map(emp => emp.totalLeads),
                  color: '#3b82f6'
                },
                {
                  label: 'DCs',
                  data: dashboardData.employeeDetails.slice(0, 10).map(emp => emp.totalDCs),
                  color: '#f59e0b'
                },
                {
                  label: 'Sales',
                  data: dashboardData.employeeDetails.slice(0, 10).map(emp => emp.totalSales),
                  color: '#a855f7'
                }
              ]}
              height={400}
            />
          </Card>

          {/* Zone Performance Analysis */}
          {employeesByZoneArray.length > 0 && (
            <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900">Zone Performance Analysis</h3>
                  <p className="text-xs text-neutral-500 mt-1">Performance metrics across zones</p>
                </div>
                <MapPin className="w-5 h-5 text-indigo-500" />
              </div>
              <MultiBarChart
                labels={employeesByZoneArray.map(item => item.zone || 'Unassigned')}
                datasets={[
                  {
                    label: 'Employees',
                    data: employeesByZoneArray.map(item => item.count),
                    color: '#3b82f6'
                  },
                  {
                    label: 'Leads',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalLeads, 0)
                    }),
                    color: '#10b981'
                  },
                  {
                    label: 'Sales',
                    data: employeesByZoneArray.map(zoneItem => {
                      const employeesInZone = dashboardData.employeeDetails.filter(
                        emp => emp.assignedCity === zoneItem.zone
                      )
                      return employeesInZone.reduce((sum, emp) => sum + emp.totalSales, 0)
                    }),
                    color: '#a855f7'
                  }
                ]}
                height={400}
              />
            </Card>
          )}

          {/* Leave Analytics */}
          {leavesByStatusArray.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Leaves by Status</h3>
                    <p className="text-xs text-neutral-500 mt-1">Team leave distribution</p>
                  </div>
                  <Calendar className="w-5 h-5 text-red-500" />
                </div>
                <PieChart
                  data={leavesByStatusArray.map((item, idx) => ({
                    label: item._id || 'Unknown',
                    value: item.count,
                    color: ['#ef4444', '#10b981', '#f59e0b', '#6b7280'][idx % 4]
                  }))}
                  height={300}
                />
              </Card>

              <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-semibold text-lg text-neutral-900">Employee Leaves Distribution</h3>
                    <p className="text-xs text-neutral-500 mt-1">Leave count by employee</p>
                  </div>
                  <Users className="w-5 h-5 text-red-500" />
                </div>
                <MultiBarChart
                  labels={dashboardData.employeeDetails
                    .filter(emp => emp.totalLeaves > 0)
                    .slice(0, 10)
                    .map(emp => emp.name.split(' ')[0])}
                  datasets={[{
                    label: 'Total Leaves',
                    data: dashboardData.employeeDetails
                      .filter(emp => emp.totalLeaves > 0)
                      .slice(0, 10)
                      .map(emp => emp.totalLeaves),
                    color: '#ef4444'
                  }]}
                  height={300}
                />
              </Card>
            </div>
          )}

          {/* Top Performers Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-blue-900">Top Lead Generator</h3>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              {topEmployeesByLeads[0] ? (
                <>
                  <div className="text-2xl font-bold text-blue-900 mb-2">{topEmployeesByLeads[0].name}</div>
                  <div className="text-lg text-blue-700 mb-1">{topEmployeesByLeads[0].totalLeads} Leads</div>
                  <div className="text-sm text-blue-600">{topEmployeesByLeads[0].assignedCity || 'Zone: Unassigned'}</div>
                </>
              ) : (
                <div className="text-blue-600">No data</div>
              )}
            </Card>

            <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-purple-900">Top Sales Performer</h3>
                <ShoppingCart className="w-5 h-5 text-purple-600" />
              </div>
              {topEmployeesBySales[0] ? (
                <>
                  <div className="text-2xl font-bold text-purple-900 mb-2">{topEmployeesBySales[0].name}</div>
                  <div className="text-lg text-purple-700 mb-1">{topEmployeesBySales[0].totalSales} Sales</div>
                  <div className="text-sm text-purple-600">{topEmployeesBySales[0].assignedCity || 'Zone: Unassigned'}</div>
                </>
              ) : (
                <div className="text-purple-600">No data</div>
              )}
            </Card>

            <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-orange-900">Top DC Generator</h3>
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              {topEmployeesByDCs[0] ? (
                <>
                  <div className="text-2xl font-bold text-orange-900 mb-2">{topEmployeesByDCs[0].name}</div>
                  <div className="text-lg text-orange-700 mb-1">{topEmployeesByDCs[0].totalDCs} DCs</div>
                  <div className="text-sm text-orange-600">{topEmployeesByDCs[0].assignedCity || 'Zone: Unassigned'}</div>
                </>
              ) : (
                <div className="text-orange-600">No data</div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Dialogs remain the same */}
      <Dialog open={assignZoneDialogOpen} onOpenChange={setAssignZoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Zone to {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Assign or update the zone (city) for this employee. Zones are cities from the Executive Manager's assigned state.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Zone (City) *</Label>
              {!dashboardData?.managerState ? (
                <>
                  <Input
                    value={zone}
                    disabled
                    className="bg-neutral-100 cursor-not-allowed"
                    placeholder="Executive Manager's state must be set first"
                  />
                  <p className="text-xs text-orange-600 mt-1">
                    Executive Manager's state is not set. Please update the manager's state first.
                  </p>
                </>
              ) : availableZones.length === 0 ? (
                <Input
                  value={zone}
                  disabled
                  className="bg-neutral-100 cursor-not-allowed"
                  placeholder="No zones available for this state"
                />
              ) : (
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select zone (city)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableZones.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {dashboardData?.managerState && availableZones.length > 0 && (
                <p className="text-xs text-neutral-500 mt-1">
                  {availableZones.length} zone(s) available from {dashboardData.managerState}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setAssignZoneDialogOpen(false)
                setZone('')
              }}>Cancel</Button>
              <Button onClick={handleAssignZone} disabled={assigning || !zone}>
                {assigning ? 'Assigning...' : 'Assign Zone'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignEmployeesDialogOpen} onOpenChange={setAssignEmployeesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Employees to Executive Manager</DialogTitle>
            <DialogDescription>
              Select employees (Executives) to assign to this Executive Manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {loadingEmployees ? (
              <div className="text-center py-4">Loading employees...</div>
            ) : availableEmployees.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-neutral-500 mb-2">No unassigned employees available</p>
                <p className="text-xs text-neutral-400 mb-3">
                  All employees with Executive role are already assigned to other managers, or you need to create more employees.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link href="/dashboard/employees/active">
                    <Button variant="outline" size="sm">
                      View All Employees
                    </Button>
                  </Link>
                  <Link href="/dashboard/employees/new">
                    <Button variant="outline" size="sm">
                      Create New Employee
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs text-neutral-500">
                    Showing {availableEmployees.length} unassigned employee(s) with Executive role
                  </p>
                  <Link href="/dashboard/employees/active">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View All Employees
                    </Button>
                  </Link>
                </div>
                {availableEmployees.map((employee) => (
                  <div key={employee._id} className="flex items-center space-x-2 p-2 border rounded hover:bg-neutral-50">
                    <Checkbox
                      checked={selectedEmployeeIds.includes(employee._id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEmployeeIds([...selectedEmployeeIds, employee._id])
                        } else {
                          setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== employee._id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{employee.name}</p>
                      <p className="text-sm text-neutral-600">{employee.email} • {employee.role}</p>
                      {employee.assignedCity && (
                        <p className="text-xs text-neutral-500">City: {employee.assignedCity}</p>
                      )}
                      {employee.department && (
                        <p className="text-xs text-neutral-500">Dept: {employee.department}</p>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAssignEmployeesDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignEmployees} disabled={assigning || selectedEmployeeIds.length === 0}>
              {assigning ? 'Assigning...' : `Assign ${selectedEmployeeIds.length} Employee(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={updateManagerStateDialogOpen} onOpenChange={setUpdateManagerStateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Executive Manager's State</DialogTitle>
            <DialogDescription>
              Set or update the state for this Executive Manager. Cities in this state will become zones that can be assigned to employees.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>State *</Label>
              <Select value={managerStateInput} onValueChange={setManagerStateInput}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {managerStateInput && (
                <p className="text-xs text-neutral-500 mt-1">
                  {getCitiesForState(managerStateInput).length} zone(s) (cities) available in {managerStateInput}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setUpdateManagerStateDialogOpen(false)
                setManagerStateInput('')
              }}>Cancel</Button>
              <Button 
                onClick={async () => {
                  if (!managerStateInput.trim()) {
                    toast.error('Please select a state')
                    return
                  }
                  setAssigning(true)
                  try {
                    await apiRequest(`/executive-managers/${managerId}/state`, {
                      method: 'PUT',
                      body: JSON.stringify({ state: managerStateInput.trim() }),
                    })
                    toast.success('Executive Manager state updated successfully')
                    setUpdateManagerStateDialogOpen(false)
                    setManagerStateInput('')
                    loadDashboard()
                  } catch (err: any) {
                    toast.error(err?.message || 'Failed to update state')
                  } finally {
                    setAssigning(false)
                  }
                }} 
                disabled={assigning}
              >
                {assigning ? 'Updating...' : 'Update State'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Mode Tab Content */}
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
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <DollarSign className="h-6 w-6 text-rose-500 mb-2" />
                <h3 className="font-semibold mb-1">Revenue at Risk</h3>
                <p className="text-sm text-gray-600">Identify revenue likely to get stuck or lost</p>
              </Card>
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <TrendingUp className="h-6 w-6 text-blue-500 mb-2" />
                <h3 className="font-semibold mb-1">Executive Dashboard</h3>
                <p className="text-sm text-gray-600">High-level view of revenue trends and issues</p>
              </Card>
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <Sparkles className="h-6 w-6 text-amber-500 mb-2" />
                <h3 className="font-semibold mb-1">Priority Engine</h3>
                <p className="text-sm text-gray-600">Automatically rank actions by business impact</p>
              </Card>
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
                <h3 className="font-semibold mb-1">Deal Risk Scoring</h3>
                <p className="text-sm text-gray-600">Identify deals at high risk of failing</p>
              </Card>
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <Users className="h-6 w-6 text-purple-500 mb-2" />
                <h3 className="font-semibold mb-1">Performance Risk</h3>
                <p className="text-sm text-gray-600">Highlight managers showing performance drops</p>
              </Card>
              <Card className="p-4 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                <Calculator className="h-6 w-6 text-orange-500 mb-2" />
                <h3 className="font-semibold mb-1">Delay Cost Calculator</h3>
                <p className="text-sm text-gray-600">Calculate financial loss from delays</p>
              </Card>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
