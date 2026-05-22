'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, ArrowUpDown, Eye, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

type TrackingData = {
  _id: string
  employeeName: string
  mobileNo: string
  zone: string
  started: string
  lastUsed: string
  lastLocation: string
  lastLatitude?: number
  lastLongitude?: number
  logCount: number
}

type Employee = {
  _id: string
  name?: string
}

function EmployeeTrackingReportContent() {
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const contextEmployeeName = searchParams.get('employeeName') || ''

  const [trackingData, setTrackingData] = useState<TrackingData[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])

  const [employee, setEmployee] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    const empId = searchParams.get('employeeId')
    const from = searchParams.get('fromDate')
    const to = searchParams.get('toDate')
    if (empId) setEmployee(empId)
    if (from) setFromDate(from)
    if (to) setToDate(to)
  }, [searchParams])

  useEffect(() => {
    loadEmployees()
    handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const applyClientFilters = (data: TrackingData[]) => {
    let filtered = [...data]

    if (employee) {
      filtered = filtered.filter((t) => t._id === employee)
    }

    if (fromDate) {
      const from = new Date(fromDate)
      filtered = filtered.filter((t) => {
        const lastUsed = new Date(t.lastUsed)
        return lastUsed >= from
      })
    }

    if (toDate) {
      const to = new Date(toDate + 'T23:59:59')
      filtered = filtered.filter((t) => {
        const lastUsed = new Date(t.lastUsed)
        return lastUsed <= to
      })
    }

    return filtered
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (employee) qs.append('employeeId', employee)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)

      const url = qs.toString()
        ? `/employees/tracking?${qs.toString()}`
        : '/employees/tracking'
      const data = await apiRequest<TrackingData[]>(url)
      setTrackingData(applyClientFilters(data || []))
    } catch (_) {
      toast.error('Failed to load employee tracking data')
      setTrackingData([])
    }
    setLoading(false)
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (employee) qs.append('employeeId', employee)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)

      const token =
        typeof window !== 'undefined' ? localStorage.getItem('authToken') : null

      const response = await fetch(
        `${API_BASE_URL}/api/employees/tracking/export?${qs.toString()}`,
        {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      )

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
      hour12: false,
    })
  }

  const mapLink = (track: TrackingData) => {
    if (track.lastLatitude != null && track.lastLongitude != null) {
      return `https://www.google.com/maps?q=${track.lastLatitude},${track.lastLongitude}`
    }
    return null
  }

  return (
    <div className="space-y-6 w-full">
      {returnTo && (
        <Card className="p-4 bg-blue-50 border-blue-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-800">
              Tracking for{' '}
              <span className="font-semibold text-blue-700">
                {contextEmployeeName || 'selected employee'}
              </span>
            </p>
            <Button variant="outline" size="sm" className="bg-white" asChild>
              <Link href={returnTo}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Expense Update
              </Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0"
        >
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <Card className="p-4 md:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Select Employee
            </label>
            <Select
              value={employee || 'all'}
              onValueChange={(val) => setEmployee(val === 'all' ? '' : val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp._id} value={emp._id}>
                    {emp.name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              From Date
            </label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              To Date
            </label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSearch}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Search
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 w-full">
        <div className="text-sm text-neutral-600 mb-4">
          Total:{' '}
          <span className="font-semibold text-neutral-900">{trackingData.length}</span>{' '}
          employees found
        </div>

        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : trackingData.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No tracking data found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="w-full min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Mobile No</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Last Location</TableHead>
                  <TableHead>Log Count</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackingData.map((track, index) => {
                  const maps = mapLink(track)
                  return (
                    <TableRow key={track._id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">{track.employeeName}</TableCell>
                      <TableCell>{track.mobileNo || '-'}</TableCell>
                      <TableCell>{track.zone || '-'}</TableCell>
                      <TableCell>{formatDate(track.started)}</TableCell>
                      <TableCell>{formatDate(track.lastUsed)}</TableCell>
                      <TableCell className="max-w-md">
                        <span className="truncate block" title={track.lastLocation}>
                          {track.lastLocation || '-'}
                        </span>
                        {maps && (
                          <a
                            href={maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View on map
                          </a>
                        )}
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
                          onClick={() => {
                            window.location.href = `/dashboard/employees/${track._id}`
                          }}
                          className="h-8 w-8 p-0 hover:bg-green-100"
                        >
                          <Eye className="h-4 w-4 text-green-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function EmployeeTrackingReportPage() {
  return (
    <Suspense fallback={<div className="py-8 text-neutral-500">Loading report...</div>}>
      <EmployeeTrackingReportContent />
    </Suspense>
  )
}
