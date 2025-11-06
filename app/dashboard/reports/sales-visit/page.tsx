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

type DC = {
  _id: string
  dcDate?: string
  dcCategory?: string
  dcRemarks?: string
  dcNotes?: string
  customerName?: string
  customerAddress?: string
  customerPhone?: string
  createdAt?: string
  employeeId?: { _id: string; name?: string }
  createdBy?: { _id: string; name?: string }
  dcOrderId?: {
    _id: string
    school_name?: string
    school_type?: string
    dc_code?: string
    zone?: string
    location?: string
    contact_mobile?: string
  }
  saleId?: {
    _id: string
    customerName?: string
    zone?: string
  }
}

type Employee = {
  _id: string
  name?: string
}

export default function SalesVisitReportPage() {
  const [visits, setVisits] = useState<DC[]>([])
  const [allVisits, setAllVisits] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  
  // Filters
  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  useEffect(() => {
    loadEmployees()
    loadVisits()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allVisits, zone, employee, fromDate, toDate, schoolName, schoolCode, contactMobile])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadVisits = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<DC[]>('/dc')
      setAllVisits(data || [])
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(
        data
          .map(dc => dc.dcOrderId?.zone || dc.saleId?.zone)
          .filter(Boolean)
      )) as string[]
      setZones(uniqueZones.sort())
    } catch (_) {
      toast.error('Failed to load sales visits')
    }
    setLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...allVisits]

    if (zone) {
      filtered = filtered.filter(dc => {
        const dcZone = dc.dcOrderId?.zone || dc.saleId?.zone || ''
        return dcZone.toLowerCase().includes(zone.toLowerCase())
      })
    }
    
    if (employee) {
      filtered = filtered.filter(dc => 
        dc.employeeId?._id === employee || dc.createdBy?._id === employee
      )
    }
    
    if (schoolName) {
      filtered = filtered.filter(dc => {
        const name = dc.dcOrderId?.school_name || dc.customerName || ''
        return name.toLowerCase().includes(schoolName.toLowerCase())
      })
    }
    
    if (schoolCode) {
      filtered = filtered.filter(dc => {
        const code = dc.dcOrderId?.dc_code || ''
        return code.toLowerCase().includes(schoolCode.toLowerCase())
      })
    }
    
    if (contactMobile) {
      filtered = filtered.filter(dc => {
        const mobile = dc.dcOrderId?.contact_mobile || dc.customerPhone || ''
        return mobile.includes(contactMobile)
      })
    }
    
    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter(dc => {
        const visitDate = dc.dcDate || dc.createdAt
        return visitDate && new Date(visitDate) >= from
      })
    }
    
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter(dc => {
        const visitDate = dc.dcDate || dc.createdAt
        return visitDate && new Date(visitDate) <= to
      })
    }

    setVisits(filtered)
  }

  const handleSearch = () => {
    applyFilters()
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (zone) qs.append('zone', zone)
      if (employee) qs.append('employeeId', employee)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      if (schoolName) qs.append('schoolName', schoolName)
      if (schoolCode) qs.append('schoolCode', schoolCode)
      if (contactMobile) qs.append('contactMobile', contactMobile)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(`${API_BASE_URL}/api/dc/export-sales-visit?${qs.toString()}`, {
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
      a.download = `Sales_Visit_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const getSchoolName = (dc: DC) => {
    return dc.dcOrderId?.school_name || dc.customerName || '-'
  }

  const getSchoolCode = (dc: DC) => {
    return dc.dcOrderId?.dc_code || '-'
  }

  const getSchoolType = (dc: DC) => {
    return dc.dcOrderId?.school_type || (dc.dcOrderId ? 'Existing' : 'New')
  }

  const getZone = (dc: DC) => {
    return dc.dcOrderId?.zone || dc.saleId?.zone || '-'
  }

  const getExecutive = (dc: DC) => {
    return dc.employeeId?.name || dc.createdBy?.name || 'Not Assigned'
  }

  const getTown = (dc: DC) => {
    return dc.dcOrderId?.location || dc.customerAddress || '-'
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 whitespace-nowrap">Sales Visit</h1>
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Name</label>
            <Input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Enter school name"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Code</label>
            <Input
              type="text"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="Enter school code"
              className="w-full"
            />
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
          Total: <span className="font-semibold text-neutral-900">{visits.length}</span> visits found
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : visits.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No visits found.</div>
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
                  <TableHead>Visit Category</TableHead>
                  <TableHead>Visit Remarks</TableHead>
                  <TableHead className="cursor-pointer">
                    Visit Date <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((visit, index) => (
                  <TableRow key={visit._id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{getSchoolCode(visit)}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        getSchoolType(visit) === 'New' 
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {getSchoolType(visit)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{getSchoolName(visit)}</TableCell>
                    <TableCell>{getZone(visit)}</TableCell>
                    <TableCell>{getExecutive(visit)}</TableCell>
                    <TableCell>{getTown(visit)}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-800">
                        {visit.dcCategory || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{visit.dcRemarks || visit.dcNotes || '-'}</TableCell>
                    <TableCell>{formatDate(visit.dcDate || visit.createdAt)}</TableCell>
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

