'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, TrendingUp, Users, MapPin, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Lead = { 
  _id: string
  school_name?: string
  contact_person?: string
  contact_person2?: string
  contact_mobile?: string
  zone?: string
  status?: string
  priority?: string
  follow_up_date?: string
  location?: string
  strength?: number
  createdAt?: string
  updatedAt?: string
  managed_by?: { _id?: string; name?: string }
  assigned_by?: { _id?: string; name?: string }
  createdBy?: { _id?: string; name?: string }
}

type Employee = {
  _id: string
  name?: string
}

export default function ReportsOpenLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  
  // Filters
  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [priority, setPriority] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [schoolName, setSchoolName] = useState('')

  useEffect(() => {
    loadEmployees()
    loadLeads()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadLeads = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('status', 'Pending')
      qs.set('limit', '200')
      qs.set('page', '1')
      if (zone) qs.set('zone', zone)
      if (employee) qs.set('employee', employee)
      if (priority) qs.set('priority', priority)
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      if (contactMobile) qs.set('contactMobile', contactMobile)
      if (schoolName) qs.set('schoolName', schoolName)

      const response = await apiRequest<any>(`/leads?${qs.toString()}`)
      const allData: Lead[] = Array.isArray(response)
        ? response
        : (response?.data || [])
      const pending = allData.filter((lead: Lead) => lead.status === 'Pending')
      setAllLeads(pending)
      setLeads(pending)
      const uniqueZones = Array.from(new Set(pending.map((l) => l.zone).filter(Boolean))) as string[]
      if (!zone) setZones(uniqueZones.sort())
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadLeads()
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      qs.set('status', 'Pending')
      if (zone) qs.set('zone', zone)
      if (employee) qs.set('employee', employee)
      if (priority) qs.set('priority', priority)
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      if (contactMobile) qs.set('contactMobile', contactMobile)
      if (schoolName) qs.set('schoolName', schoolName)
      await downloadReportFile(`/leads/export?${qs.toString()}`, 'Open_Leads_Report.xlsx')
      toast.success('Excel file downloaded')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export to Excel')
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const getAssignedTo = (lead: Lead) => {
    return lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned'
  }

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!leads.length) return null

    // Leads by Zone
    const zoneData: Record<string, number> = {}
    leads.forEach(lead => {
      const zone = lead.zone || 'Unassigned'
      zoneData[zone] = (zoneData[zone] || 0) + 1
    })
    const leadsByZone = Object.entries(zoneData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 zones

    // Leads by Priority
    const priorityData: Record<string, number> = {}
    leads.forEach(lead => {
      const priority = lead.priority || 'Cold'
      priorityData[priority] = (priorityData[priority] || 0) + 1
    })
    const leadsByPriority = Object.entries(priorityData)
      .map(([name, value]) => ({ name, value }))
      .map(item => ({
        ...item,
        color: item.name === 'Hot' ? '#ef4444' : item.name === 'Warm' ? '#f97316' : '#3b82f6'
      }))

    // Leads by Employee
    const employeeData: Record<string, number> = {}
    leads.forEach(lead => {
      const employee = getAssignedTo(lead)
      employeeData[employee] = (employeeData[employee] || 0) + 1
    })
    const leadsByEmployee = Object.entries(employeeData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 employees

    // Leads Over Time (last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return date.toISOString().split('T')[0]
    })
    
    const leadsOverTime = last30Days.map(date => {
      const count = leads.filter(lead => {
        if (!lead.createdAt) return false
        const leadDate = new Date(lead.createdAt).toISOString().split('T')[0]
        return leadDate === date
      }).length
      return {
        date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        leads: count
      }
    })

    // Summary metrics
    const totalLeads = leads.length
    const hotLeads = leads.filter(l => l.priority === 'Hot').length
    const warmLeads = leads.filter(l => l.priority === 'Warm').length
    const uniqueZones = new Set(leads.map(l => l.zone).filter(Boolean)).size
    const uniqueEmployees = new Set(leads.map(l => getAssignedTo(l))).size

    return {
      leadsByZone,
      leadsByPriority,
      leadsByEmployee,
      leadsOverTime,
      summary: {
        totalLeads,
        hotLeads,
        warmLeads,
        uniqueZones,
        uniqueEmployees
      }
    }
  }, [leads])

  const COLORS = ['#3b82f6', '#ef4444', '#f97316', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899']

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 whitespace-nowrap">Open Leads Analytics</h1>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Summary Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Leads</p>
                <p className="text-2xl font-bold text-blue-900">{analyticsData.summary.totalLeads}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Hot Leads</p>
                <p className="text-2xl font-bold text-red-900">{analyticsData.summary.hotLeads}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 font-medium">Warm Leads</p>
                <p className="text-2xl font-bold text-orange-900">{analyticsData.summary.warmLeads}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Zones</p>
                <p className="text-2xl font-bold text-purple-900">{analyticsData.summary.uniqueZones}</p>
              </div>
              <MapPin className="w-8 h-8 text-purple-600" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Employees</p>
                <p className="text-2xl font-bold text-green-900">{analyticsData.summary.uniqueEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      {analyticsData && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by Zone */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Leads by Zone
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.leadsByZone}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {analyticsData.leadsByZone.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Leads by Priority */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Leads by Priority
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.leadsByPriority}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analyticsData.leadsByPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Leads by Employee */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Leads by Employee
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.leadsByEmployee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 8, 8, 0]}>
                  {analyticsData.leadsByEmployee.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Leads Over Time */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Leads Created Over Time (Last 30 Days)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.leadsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 md:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Zone</label>
            <Select value={zone || "all"} onValueChange={(val) => setZone(val === "all" ? "" : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>{z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">From Date</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="dd-mm-yyyy"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Employee</label>
            <Select value={employee || "all"} onValueChange={(val) => setEmployee(val === "all" ? "" : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>{emp.name || 'Unknown'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">To Date</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="dd-mm-yyyy"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Priority</label>
            <Select value={priority || "all"} onValueChange={(val) => setPriority(val === "all" ? "" : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Hot">Hot</SelectItem>
                <SelectItem value="Warm">Warm</SelectItem>
                <SelectItem value="Cold">Cold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By Contact Mobile</label>
            <Input
              type="text"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              placeholder="Enter mobile number"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Name</label>
            <Input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Enter school name"
              className="w-full"
            />
          </div>

          <div className="flex items-end">
            <Button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Search
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-4 md:p-6 w-full">
        <div className="text-sm text-neutral-600 mb-4">
          Total: <span className="font-semibold text-neutral-900">{leads.length}</span> leads found
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No leads found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-full">
              <Table className="w-full min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Decision Maker</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Follow-up On</TableHead>
                  <TableHead>School Strength</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead, index) => (
                  <TableRow key={lead._id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{formatDate(lead.createdAt)}</TableCell>
                    <TableCell>{lead.zone || '-'}</TableCell>
                    <TableCell>{getAssignedTo(lead)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        lead.priority === 'Hot' 
                          ? 'bg-red-100 text-red-800'
                          : lead.priority === 'Warm'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {lead.priority ? `${lead.priority} Lead` : '-'}
                      </span>
                    </TableCell>
                    <TableCell>{lead.location || '-'}</TableCell>
                    <TableCell className="font-medium">{lead.school_name || '-'}</TableCell>
                    <TableCell>{lead.contact_person || '-'}</TableCell>
                    <TableCell>{lead.contact_person2 || '-'}</TableCell>
                    <TableCell>{lead.contact_mobile || '-'}</TableCell>
                    <TableCell>{lead.follow_up_date ? formatDate(lead.follow_up_date) : '-'}</TableCell>
                    <TableCell>{lead.strength || 0}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        lead.status === 'Pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {lead.status || '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
