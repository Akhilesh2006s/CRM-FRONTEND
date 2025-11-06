'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, ArrowUpDown, Eye } from 'lucide-react'
import { toast } from 'sonner'

type TrackingData = {
  _id: string
  employeeName: string
  mobileNo: string
  zone: string
  started: string
  lastUsed: string
  lastLocation: string
  logCount: number
}

type Employee = {
  _id: string
  name?: string
}

export default function EmployeeTrackingReportPage() {
  const [trackingData, setTrackingData] = useState<TrackingData[]>([])
  const [allTrackingData, setAllTrackingData] = useState<TrackingData[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  
  // Filters
  const [employee, setEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    loadEmployees()
    loadTrackingData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [allTrackingData, employee, fromDate, toDate])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadTrackingData = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<TrackingData[]>('/employees/tracking')
      setAllTrackingData(data || [])
    } catch (_) {
      toast.error('Failed to load employee tracking data')
    }
    setLoading(false)
  }

  const applyFilters = () => {
    let filtered = [...allTrackingData]

    if (employee) {
      filtered = filtered.filter(t => t._id === employee)
    }
    
    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter(t => {
        const started = new Date(t.started)
        const lastUsed = new Date(t.lastUsed)
        return started >= from || lastUsed >= from
      })
    }
    
    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter(t => {
        const started = new Date(t.started)
        const lastUsed = new Date(t.lastUsed)
        return started <= to || lastUsed <= to
      })
    }

    setTrackingData(filtered)
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (employee) qs.append('employeeId', employee)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)

      const data = await apiRequest<TrackingData[]>(`/employees/tracking?${qs.toString()}`)
      setAllTrackingData(data || [])
      setTrackingData(data || [])
    } catch (_) {
      toast.error('Failed to load employee tracking data')
    }
    setLoading(false)
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (employee) qs.append('employeeId', employee)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)

      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(`${API_BASE_URL}/api/employees/tracking/export?${qs.toString()}`, {
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
      a.download = `Employee_Tracking_Report_${new Date().toISOString().split('T')[0]}.xlsx`
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

  const handleViewDetails = (employeeId: string) => {
    // Navigate to employee details or show modal
    window.location.href = `/dashboard/employees/${employeeId}`
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900 whitespace-nowrap">Employee Tracking Report</h1>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 md:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          Total: <span className="font-semibold text-neutral-900">{trackingData.length}</span> employees found
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : trackingData.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No tracking data found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-full">
              <Table className="w-full min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer">
                    S.No <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Employee Name <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Mobile No <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Zone <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Started <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead className="cursor-pointer">
                    Last Used <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead>Last Location</TableHead>
                  <TableHead className="cursor-pointer">
                    Log Count <ArrowUpDown className="inline h-3 w-3 ml-1" />
                  </TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingData.map((track, index) => (
                  <TableRow key={track._id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{track.employeeName}</TableCell>
                    <TableCell>{track.mobileNo || '-'}</TableCell>
                    <TableCell>{track.zone || '-'}</TableCell>
                    <TableCell>{formatDate(track.started)}</TableCell>
                    <TableCell>{formatDate(track.lastUsed)}</TableCell>
                    <TableCell className="max-w-md truncate" title={track.lastLocation}>
                      {track.lastLocation || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 font-semibold">
                        {track.logCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(track._id)}
                        className="h-8 w-8 p-0 hover:bg-green-100"
                      >
                        <Eye className="h-4 w-4 text-green-600" />
                      </Button>
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

