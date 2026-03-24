'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest, LOCAL_API_BASE_URL } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { MapPin, Edit, History, Download, TrendingUp, Users, Calendar, CheckCircle2, Award } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Lead = { 
  _id: string
  school_name?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  status?: string
  priority?: string
  follow_up_date?: string
  location?: string
  strength?: number
  createdAt?: string
  remarks?: string
  managed_by?: { name?: string; _id?: string }
  assigned_by?: { name?: string; _id?: string }
  createdBy?: { name?: string; _id?: string }
}

export default function ReportsClosedLeadsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<string[]>([])
  
  // Filters
  const [zone, setZone] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  useEffect(() => {
    loadLeads()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allLeads, zone, schoolName, contactMobile])

  const loadLeads = async () => {
    setLoading(true)
    try {
      // Fetch closed leads from database with a high limit to get all results
      // The API returns paginated results, so we'll fetch with a high limit
      const response = await apiRequest<any>('/leads?status=Closed&limit=1000')
      console.log('API Response:', response)
      
      // Handle both array and paginated response formats
      let allData: Lead[] = []
      
      if (Array.isArray(response)) {
        // Direct array response
        allData = response
      } else if (response?.data && Array.isArray(response.data)) {
        // Paginated response with data array
        allData = response.data
        
        // If there are more pages, fetch them
        if (response.pagination && response.pagination.totalPages > 1) {
          const totalPages = response.pagination.totalPages
          for (let page = 2; page <= totalPages; page++) {
            try {
              const pageResponse = await apiRequest<any>(`/leads?status=Closed&limit=1000&page=${page}`)
              const pageData = Array.isArray(pageResponse) 
                ? pageResponse 
                : (pageResponse?.data || [])
              allData = [...allData, ...pageData]
            } catch (err) {
              console.warn(`Failed to fetch page ${page}:`, err)
              break
            }
          }
        }
      }
      
      // Ensure we only have closed leads (double-check)
      allData = allData.filter((lead: Lead) => lead.status === 'Closed')
      
      console.log('Total closed leads found:', allData.length)
      console.log('Sample lead:', allData[0])
      
      setAllLeads(allData)
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(allData.map((l: Lead) => l.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
      
      if (allData.length === 0) {
        toast.info('No closed leads found in the database. Leads need to have status="Closed" to appear here.')
      } else {
        toast.success(`Loaded ${allData.length} closed lead(s)`)
      }
    } catch (err: any) {
      console.error('Error loading closed leads:', err)
      console.error('Error details:', {
        message: err?.message,
        stack: err?.stack,
        response: err?.response
      })
      
      // Check if it's a connection error
      if (err?.message?.includes('Failed to fetch') || err?.message?.includes('ERR_CONNECTION_REFUSED')) {
        toast.error('Cannot connect to backend server. Please check your connection or contact support.')
      } else {
        toast.error(err?.message || 'Failed to load closed leads. Check console for details.')
      }
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allLeads]

    if (zone && zone !== 'all') filtered = filtered.filter(l => l.zone?.toLowerCase().includes(zone.toLowerCase()))
    if (contactMobile) filtered = filtered.filter(l => l.contact_mobile?.includes(contactMobile))
    if (schoolName) filtered = filtered.filter(l => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()))

    setLeads(filtered)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return '-'
    }
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-orange-100 text-orange-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      case 'visit again':
        return 'bg-yellow-100 text-yellow-800'
      case 'not met management':
        return 'bg-blue-100 text-blue-800'
      case 'not interested':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleEditDetails = (lead: Lead) => {
    router.push(`/dashboard/leads/edit/${lead._id}`)
  }

  const getAssignedTo = (lead: Lead) => {
    return lead.managed_by?.name || lead.assigned_by?.name || lead.createdBy?.name || 'Not Assigned'
  }

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (!allLeads.length) return null

    // Leads by Zone
    const zoneData: Record<string, number> = {}
    allLeads.forEach(lead => {
      const zone = lead.zone || 'Unassigned'
      zoneData[zone] = (zoneData[zone] || 0) + 1
    })
    const leadsByZone = Object.entries(zoneData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 zones

    // Leads by Priority
    const priorityData: Record<string, number> = {}
    allLeads.forEach(lead => {
      const priority = lead.priority || 'Hot'
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
    allLeads.forEach(lead => {
      const employee = getAssignedTo(lead)
      employeeData[employee] = (employeeData[employee] || 0) + 1
    })
    const leadsByEmployee = Object.entries(employeeData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Top 10 employees

    // Leads Closed Over Time (last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (29 - i))
      return date.toISOString().split('T')[0]
    })
    
    const leadsOverTime = last30Days.map(date => {
      const count = allLeads.filter(lead => {
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
    const totalLeads = allLeads.length
    const hotLeads = allLeads.filter(l => l.priority === 'Hot').length
    const warmLeads = allLeads.filter(l => l.priority === 'Warm').length
    const uniqueZones = new Set(allLeads.map(l => l.zone).filter(Boolean)).size
    const uniqueEmployees = new Set(allLeads.map(l => getAssignedTo(l))).size
    const totalStrength = allLeads.reduce((sum, l) => sum + (l.strength || 0), 0)

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
        uniqueEmployees,
        totalStrength
      }
    }
  }, [allLeads])

  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f97316', '#8b5cf6', '#f59e0b', '#ec4899']

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      qs.append('status', 'Closed')
      if (zone && zone !== 'all') qs.append('zone', zone)
      if (contactMobile) qs.append('contactMobile', contactMobile)
      if (schoolName) qs.append('schoolName', schoolName)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || LOCAL_API_BASE_URL

      const response = await fetch(`${API_BASE_URL}/api/leads/export?${qs.toString()}`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Export failed' }))
        throw new Error(error.message || 'Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Closed_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel file downloaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export to Excel')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Closed Leads Analytics</h1>
          <p className="text-sm text-neutral-600 mt-1">View analytics and insights for successfully closed leads</p>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* Summary Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Total Closed</p>
                <p className="text-2xl font-bold text-green-900">{analyticsData.summary.totalLeads}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
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
          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Employees</p>
                <p className="text-2xl font-bold text-blue-900">{analyticsData.summary.uniqueEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">Total Strength</p>
                <p className="text-2xl font-bold text-amber-900">{analyticsData.summary.totalStrength.toLocaleString()}</p>
              </div>
              <Award className="w-8 h-8 text-amber-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      {analyticsData && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leads by Zone */}
          <Card className="p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Closed Leads by Zone
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
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]}>
                  {analyticsData.leadsByZone.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Leads by Priority */}
          <Card className="p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Closed Leads by Priority
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
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Leads by Employee */}
          <Card className="p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              Closed Leads by Employee
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
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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

          {/* Leads Closed Over Time */}
          <Card className="p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Leads Closed Over Time (Last 30 Days)
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
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="leads" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 5 }}
                  activeDot={{ r: 7, fill: '#059669' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Card className="p-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Zone</label>
            <Select value={zone || undefined} onValueChange={(v) => setZone(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones
                  .filter(z => z && z.trim() !== '')
                  .map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input
              placeholder="Search school..."
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Contact Mobile</label>
            <Input
              placeholder="Search mobile..."
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={loadLeads} className="w-full">
              Refresh
            </Button>
          </div>
        </div>

        {/* Lead Cards */}
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading closed leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {allLeads.length === 0 
              ? 'No closed leads found.'
              : 'No leads match the current filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              <Card key={lead._id} className="p-5 border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header with School Name and Location */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-orange-600 mb-1">
                        {lead.school_name || 'Unnamed School'}
                      </h3>
                      {lead.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-600">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span>{lead.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 font-medium">
                      Closed
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-600">Contact:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_person || '-'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Mobile:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_mobile || '-'}</span>
                    </div>
                  </div>

                  {/* Lead Details */}
                  <div className="space-y-2 text-sm">
                    {lead.remarks && (
                      <div>
                        <span className="text-neutral-600">Remarks:</span>
                        <span className="ml-2 text-neutral-900">{lead.remarks}</span>
                      </div>
                    )}
                    {lead.follow_up_date && (
                      <div>
                        <span className="text-neutral-600">Follow Up Date:</span>
                        <span className="ml-2 font-medium text-neutral-900">
                          {formatDateTime(lead.follow_up_date)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-neutral-600">Lead Status:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getPriorityColor(lead.priority)}`}>
                        {lead.priority || 'Hot'}
                      </span>
                    </div>
                    {lead.createdAt && (
                      <div>
                        <span className="text-neutral-600">Closed On:</span>
                        <span className="ml-2 font-medium text-neutral-900">
                          {formatDateTime(lead.createdAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      onClick={() => handleEditDetails(lead)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={() => router.push(`/dashboard/leads/edit/${lead._id}`)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      View Details
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
