'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'

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
  managed_by?: { name?: string }
  assigned_by?: { name?: string }
  createdBy?: { name?: string }
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

  useEffect(() => {
    applyFilters()
  }, [allLeads, zone, employee, priority, fromDate, toDate, contactMobile, schoolName])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadLeads = async () => {
    setLoading(true)
    try {
      // Open leads are Pending or Processing status
      const pendingData = await apiRequest<Lead[]>('/leads?status=Pending')
      const processingData = await apiRequest<Lead[]>('/leads?status=Processing')
      const allData = [...(pendingData || []), ...(processingData || [])]
      setAllLeads(allData)
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(allData.map(l => l.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
    } catch (_) {
      toast.error('Failed to load leads')
    }
    setLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...allLeads]

    if (zone) filtered = filtered.filter(l => l.zone?.toLowerCase().includes(zone.toLowerCase()))
    if (priority) filtered = filtered.filter(l => l.priority === priority)
    if (contactMobile) filtered = filtered.filter(l => l.contact_mobile?.includes(contactMobile))
    if (schoolName) filtered = filtered.filter(l => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()))
    if (employee) {
      filtered = filtered.filter(l => 
        l.managed_by?._id === employee || 
        l.assigned_by?._id === employee ||
        l.createdBy?._id === employee
      )
    }
    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter(l => l.createdAt && new Date(l.createdAt) >= from)
    }
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter(l => l.createdAt && new Date(l.createdAt) <= to)
    }

    setLeads(filtered)
  }

  const handleSearch = () => {
    applyFilters()
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      qs.append('status', 'Pending,Processing')
      if (zone) qs.append('zone', zone)
      if (employee) qs.append('employee', employee)
      if (priority) qs.append('priority', priority)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      if (contactMobile) qs.append('contactMobile', contactMobile)
      if (schoolName) qs.append('schoolName', schoolName)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

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
      a.download = `Open_Leads_Report_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel file downloaded successfully')
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

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 whitespace-nowrap">Open Leads List</h1>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

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
                  <TableHead className="cursor-pointer">
                    S.No <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Created On <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Zone <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Assigned To <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Priority <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
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
                    <TableCell>{lead.contact_person || '-'}</TableCell>
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
