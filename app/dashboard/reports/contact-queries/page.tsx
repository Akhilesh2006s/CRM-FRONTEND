'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { API_BASE_URL, LOCAL_API_BASE_URL } from '@/lib/api'

type ContactQuery = {
  _id: string
  school_code?: string
  school_type?: string
  school_name?: string
  zone?: string
  executive?: { _id: string; name?: string; email?: string }
  town?: string
  subject?: string
  description?: string
  contact_mobile?: string
  enquiry_date?: string
  status?: string
  resolved_by?: { _id: string; name?: string }
  resolved_at?: string
  createdBy?: { _id: string; name?: string }
  createdAt?: string
}

type Employee = {
  _id: string
  name?: string
}

type Zone = {
  _id?: string
  name: string
}

function mergeZoneNames(masterZones: Zone[], queries: ContactQuery[]): string[] {
  const fromMaster = masterZones.map((z) => z.name).filter(Boolean)
  const fromQueries = queries.map((q) => q.zone).filter(Boolean) as string[]
  return Array.from(new Set([...fromMaster, ...fromQueries])).sort((a, b) =>
    a.localeCompare(b)
  )
}

export default function ContactQueriesPage() {
  const [queries, setQueries] = useState<ContactQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])

  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selectedQuery, setSelectedQuery] = useState<ContactQuery | null>(null)

  const refreshZones = useCallback((masterZones: Zone[], queryList: ContactQuery[]) => {
    setZones(mergeZoneNames(masterZones, queryList))
  }, [])

  useEffect(() => {
    loadEmployees()
    loadInitial()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadInitial = async () => {
    setLoading(true)
    try {
      const [queriesData, zonesData] = await Promise.all([
        apiRequest<ContactQuery[]>('/contact-queries'),
        apiRequest<Zone[]>('/zones').catch(() => []),
      ])
      const list = queriesData || []
      setQueries(list)
      refreshZones(zonesData || [], list)
    } catch (_) {
      toast.error('Failed to load contact queries')
      setQueries([])
    }
    setLoading(false)
  }

  const buildSearchParams = () => {
    const qs = new URLSearchParams()
    if (zone) qs.append('zone', zone)
    if (employee) qs.append('employee', employee)
    if (schoolName) qs.append('schoolName', schoolName)
    if (schoolCode) qs.append('schoolCode', schoolCode)
    if (fromDate) qs.append('fromDate', fromDate)
    if (toDate) qs.append('toDate', toDate)
    if (contactMobile) qs.append('contactMobile', contactMobile)
    return qs
  }

  const handleSearch = async () => {
    setLoading(true)
    try {
      const qs = buildSearchParams()
      const [data, zonesData] = await Promise.all([
        apiRequest<ContactQuery[]>(
          `/contact-queries${qs.toString() ? `?${qs.toString()}` : ''}`
        ),
        apiRequest<Zone[]>('/zones').catch(() => []),
      ])
      const list = data || []
      setQueries(list)
      refreshZones(zonesData || [], list)
    } catch (_) {
      toast.error('Failed to load contact queries')
    }
    setLoading(false)
  }

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setSelectedQuery(null)
    try {
      const detail = await apiRequest<ContactQuery>(`/contact-queries/${id}`)
      setSelectedQuery(detail)
    } catch (_) {
      toast.error('Failed to load enquiry details')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const qs = buildSearchParams()
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('authToken') : null
      const base =
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ||
        LOCAL_API_BASE_URL

      const response = await fetch(
        `${base}/api/contact-queries/export?${qs.toString()}`,
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
      hour12: false,
    })
  }

  return (
    <div className="space-y-6 w-full">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Select Zone
            </label>
            <Select value={zone || 'all'} onValueChange={(val) => setZone(val === 'all' ? '' : val)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              Select Employee
            </label>
            <Select
              value={employee || 'all'}
              onValueChange={(val) => setEmployee(val === 'all' ? '' : val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Employee" />
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
              By School Name
            </label>
            <Input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="By School Name"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              By School Code
            </label>
            <Input
              type="text"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="By School Code"
              className="w-full"
            />
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

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">
              By Contact Mobile
            </label>
            <Input
              type="text"
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
              placeholder="By Contact Mobile"
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
          <span className="font-semibold text-neutral-900">{queries.length}</span> enquiries
          found
        </div>

        {loading ? (
          <div className="text-center py-8 text-neutral-500">Loading...</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">No enquiries found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table className="w-full min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>School Code</TableHead>
                  <TableHead>School Type</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Executive</TableHead>
                  <TableHead>Contact Mobile</TableHead>
                  <TableHead>Town</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date of Enquiry</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((query, index) => (
                  <TableRow
                    key={query._id}
                    className="cursor-pointer hover:bg-neutral-50"
                    onClick={() => openDetail(query._id)}
                  >
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{query.school_code || '-'}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          query.school_type === 'New'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {query.school_type || 'Existing'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{query.school_name || '-'}</TableCell>
                    <TableCell>{query.zone || '-'}</TableCell>
                    <TableCell>{query.executive?.name || '-'}</TableCell>
                    <TableCell>{query.contact_mobile || '-'}</TableCell>
                    <TableCell>{query.town || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate" title={query.subject}>
                      {query.subject || '-'}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 rounded text-xs bg-neutral-100 text-neutral-800">
                        {query.status || 'Pending'}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(query.enquiry_date)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(query._id)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enquiry Details</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <p className="text-neutral-500 py-4">Loading details...</p>
          ) : selectedQuery ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <DetailField label="School Code" value={selectedQuery.school_code} />
              <DetailField label="School Type" value={selectedQuery.school_type} />
              <DetailField label="School Name" value={selectedQuery.school_name} />
              <DetailField label="Zone" value={selectedQuery.zone} />
              <DetailField label="Town" value={selectedQuery.town} />
              <DetailField label="Contact Mobile" value={selectedQuery.contact_mobile} />
              <DetailField label="Executive" value={selectedQuery.executive?.name} />
              <DetailField label="Status" value={selectedQuery.status} />
              <DetailField label="Subject" value={selectedQuery.subject} className="sm:col-span-2" />
              <DetailField
                label="Description"
                value={selectedQuery.description}
                className="sm:col-span-2"
                multiline
              />
              <DetailField
                label="Date of Enquiry"
                value={formatDate(selectedQuery.enquiry_date)}
              />
              <DetailField
                label="Resolved By"
                value={selectedQuery.resolved_by?.name}
              />
              <DetailField
                label="Resolved At"
                value={
                  selectedQuery.resolved_at
                    ? formatDate(selectedQuery.resolved_at)
                    : undefined
                }
              />
              <DetailField
                label="Created By"
                value={selectedQuery.createdBy?.name}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DetailField({
  label,
  value,
  className = '',
  multiline = false,
}: {
  label: string
  value?: string | null
  className?: string
  multiline?: boolean
}) {
  return (
    <div className={className}>
      <p className="text-neutral-500 text-xs font-medium uppercase tracking-wide mb-1">
        {label}
      </p>
      {multiline ? (
        <p className="text-neutral-900 whitespace-pre-wrap break-words">
          {value || '-'}
        </p>
      ) : (
        <p className="text-neutral-900 font-medium">{value || '-'}</p>
      )}
    </div>
  )
}
