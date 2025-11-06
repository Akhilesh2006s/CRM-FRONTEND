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

type ContactQuery = {
  _id: string
  school_code?: string
  school_type?: string
  school_name?: string
  zone?: string
  executive?: { _id: string; name?: string }
  town?: string
  subject?: string
  description?: string
  contact_mobile?: string
  enquiry_date?: string
}

type Employee = {
  _id: string
  name?: string
}

export default function ContactQueriesPage() {
  const [queries, setQueries] = useState<ContactQuery[]>([])
  const [allQueries, setAllQueries] = useState<ContactQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  
  // Filters
  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  useEffect(() => {
    loadEmployees()
    loadQueries()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allQueries, zone, employee, schoolName, schoolCode, fromDate, toDate, contactMobile])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadQueries = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<ContactQuery[]>('/contact-queries')
      setAllQueries(data || [])
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(data.map(q => q.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
    } catch (_) {
      toast.error('Failed to load contact queries')
    }
    setLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...allQueries]

    if (zone) {
      filtered = filtered.filter(q => q.zone?.toLowerCase().includes(zone.toLowerCase()))
    }
    
    if (employee) {
      filtered = filtered.filter(q => q.executive?._id === employee)
    }
    
    if (schoolName) {
      filtered = filtered.filter(q => q.school_name?.toLowerCase().includes(schoolName.toLowerCase()))
    }
    
    if (schoolCode) {
      filtered = filtered.filter(q => q.school_code?.toLowerCase().includes(schoolCode.toLowerCase()))
    }
    
    if (contactMobile) {
      filtered = filtered.filter(q => q.contact_mobile?.includes(contactMobile))
    }
    
    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter(q => q.enquiry_date && new Date(q.enquiry_date) >= from)
    }
    
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter(q => q.enquiry_date && new Date(q.enquiry_date) <= to)
    }

    setQueries(filtered)
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (zone) qs.append('zone', zone)
      if (employee) qs.append('employee', employee)
      if (schoolName) qs.append('schoolName', schoolName)
      if (schoolCode) qs.append('schoolCode', schoolCode)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      if (contactMobile) qs.append('contactMobile', contactMobile)

      const data = await apiRequest<ContactQuery[]>(`/contact-queries?${qs.toString()}`)
      setAllQueries(data || [])
      setQueries(data || [])
    } catch (_) {
      toast.error('Failed to load contact queries')
    }
    setLoading(false)
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (zone) qs.append('zone', zone)
      if (employee) qs.append('employee', employee)
      if (schoolName) qs.append('schoolName', schoolName)
      if (schoolCode) qs.append('schoolCode', schoolCode)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      if (contactMobile) qs.append('contactMobile', contactMobile)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(`${API_BASE_URL}/api/contact-queries/export?${qs.toString()}`, {
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
      a.download = `Contact_Queries_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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
      hour12: false
    })
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 whitespace-nowrap">Contact Enqueries</h1>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Zone</label>
            <Select value={zone || "all"} onValueChange={(val) => setZone(val === "all" ? "" : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Zone" />
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Employee</label>
            <Select value={employee || "all"} onValueChange={(val) => setEmployee(val === "all" ? "" : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Employee" />
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Name</label>
            <Input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="By School Name"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Code</label>
            <Input
              type="text"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="By School Code"
              className="w-full"
            />
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By Contact Mobile</label>
            <Input
              type="text"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              placeholder="By Contact Mobile"
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
          Total: <span className="font-semibold text-neutral-900">{queries.length}</span> queries found
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No queries found.</div>
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
                    School Code <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    School Type <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    School Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Zone <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Executive <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead>Town</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="cursor-pointer">
                    Date of Enquiry <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((query, index) => (
                  <TableRow key={query._id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{query.school_code || '-'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        query.school_type === 'New' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {query.school_type || 'Existing'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{query.school_name || '-'}</TableCell>
                    <TableCell>{query.zone || '-'}</TableCell>
                    <TableCell>{query.executive?.name || '-'}</TableCell>
                    <TableCell>{query.town || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate" title={query.subject}>{query.subject || '-'}</TableCell>
                    <TableCell className="max-w-md truncate" title={query.description}>{query.description || '-'}</TableCell>
                    <TableCell>{formatDate(query.enquiry_date)}</TableCell>
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

