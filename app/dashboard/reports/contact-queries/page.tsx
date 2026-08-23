'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Building2,
  Download,
  Eye,
  GraduationCap,
  MapPin,
  MessageSquare,
  Search,
} from 'lucide-react'
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
  contact_person?: string
  enquiry_date?: string
  status?: string
  source?: string
}

type Employee = {
  _id: string
  name?: string
}

type Zone = {
  name?: string
}

type LeadRow = {
  _id: string
  school_name?: string
  school_code?: string
  lead_type?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  location?: string
  city?: string
  remarks?: string
  recommendations?: string
  products?: { product_name?: string }[]
  status?: string
  createdAt?: string
  managed_by?: { _id?: string; name?: string }
  createdBy?: { _id?: string; name?: string }
}

function titleCaseName(value?: string) {
  if (!value || value === '-') return value || '-'
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function looksLikeSchoolCode(value: string) {
  return /dc[-_]?\s*\d+/i.test(value) || /^\s*[A-Za-z]{1,8}[-_]\d+/.test(value)
}

function mapLeadToEnquiry(lead: LeadRow): ContactQuery {
  const products = (lead.products || [])
    .map((p) => p?.product_name)
    .filter(Boolean)
    .join(', ')
  const executive = lead.managed_by || lead.createdBy
  return {
    _id: lead._id,
    school_code: lead.school_code || '',
    school_type: lead.lead_type === 'renewal' ? 'Existing' : 'New',
    school_name: lead.school_name || '',
    zone: lead.zone || '',
    executive: executive?._id ? { _id: executive._id, name: executive.name } : undefined,
    town: lead.location || lead.city || '',
    subject: products || 'School enquiry',
    description:
      lead.remarks ||
      lead.recommendations ||
      (lead.contact_person ? `Contact: ${lead.contact_person}` : ''),
    contact_mobile: lead.contact_mobile || '',
    contact_person: lead.contact_person || '',
    enquiry_date: lead.createdAt,
    status: lead.status || 'Pending',
    source: 'lead',
  }
}

function csvCell(value?: string | number) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function localYmd(dateStr?: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function inEnquiryDateRange(enquiryDate?: string, from?: string, to?: string) {
  if (!from && !to) return true
  const ymd = localYmd(enquiryDate)
  if (!ymd) return false
  if (from && ymd < from) return false
  if (to && ymd > to) return false
  return true
}

function statusBadgeClass(status?: string) {
  const value = (status || '').trim().toLowerCase()
  if (value === 'closed' || value === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (value === 'pending' || value === 'processing' || value === 'in progress') {
    return 'bg-amber-50 text-amber-700 border-amber-200'
  }
  if (value === 'saved') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function ContactQueriesPage() {
  const [queries, setQueries] = useState<ContactQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [selectedQuery, setSelectedQuery] = useState<ContactQuery | null>(null)

  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [contactMobile, setContactMobile] = useState('')

  useEffect(() => {
    loadEmployees()
    loadZones()
    loadQueries()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadZones = async () => {
    try {
      const data = await apiRequest<Zone[]>('/zones')
      setZones((data || []).map((z) => z.name).filter((name): name is string => Boolean(name)).sort())
    } catch (_) {}
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

  const loadQueries = async () => {
    setLoading(true)
    try {
      const qs = buildSearchParams()
      const leadQs = new URLSearchParams()
      leadQs.set('limit', '200')
      leadQs.set('page', '1')
      if (zone) leadQs.set('zone', zone)
      if (employee) leadQs.set('employee', employee)
      if (fromDate) leadQs.set('fromDate', fromDate)
      if (toDate) leadQs.set('toDate', toDate)
      if (contactMobile) leadQs.set('contactMobile', contactMobile)
      if (schoolName) leadQs.set('schoolName', schoolName)

      const [queryRes, leadRes] = await Promise.all([
        apiRequest<ContactQuery[]>(
          `/contact-queries${qs.toString() ? `?${qs.toString()}` : ''}`
        ).catch(() => [] as ContactQuery[]),
        apiRequest<{ data?: LeadRow[] } | LeadRow[]>(`/leads?${leadQs.toString()}`),
      ])

      const queryRows = Array.isArray(queryRes) ? queryRes : []
      const leadRaw = Array.isArray(leadRes) ? leadRes : (leadRes?.data || [])
      let leadRows = leadRaw.map(mapLeadToEnquiry)
      if (schoolCode) {
        const needle = schoolCode.toLowerCase()
        leadRows = leadRows.filter((row) => (row.school_code || '').toLowerCase().includes(needle))
      }

      const byId = new Map<string, ContactQuery>()
      ;[...queryRows, ...leadRows].forEach((row) => {
        if (row?._id) byId.set(String(row._id), row)
      })
      const rows = Array.from(byId.values())
        .filter((row) => inEnquiryDateRange(row.enquiry_date, fromDate, toDate))
        .sort((a, b) => {
          const aTime = a.enquiry_date ? new Date(a.enquiry_date).getTime() : 0
          const bTime = b.enquiry_date ? new Date(b.enquiry_date).getTime() : 0
          return bTime - aTime
        })

      setQueries(rows)
      const uniqueZones = Array.from(new Set(rows.map((q) => q.zone).filter(Boolean))) as string[]
      setZones((prev) => Array.from(new Set([...prev, ...uniqueZones])).sort())
    } catch (_) {
      toast.error('Failed to load contact enquiries')
      setQueries([])
    }
    setLoading(false)
  }

  const handleSearch = () => {
    loadQueries()
  }

  const handleSchoolSearchChange = (value: string) => {
    if (!value) {
      setSchoolName('')
      setSchoolCode('')
      return
    }
    if (looksLikeSchoolCode(value)) {
      setSchoolCode(value)
      setSchoolName('')
    } else {
      setSchoolName(value)
      setSchoolCode('')
    }
  }

  const handleExport = async () => {
    if (!queries.length) {
      toast.error('No enquiries to export')
      return
    }
    try {
      const qs = buildSearchParams()
      await downloadReportFile(`/contact-queries/export?${qs.toString()}`, 'Contact_Enquiries_Report.xlsx')
      toast.success('Excel file downloaded')
    } catch (_) {
      const headers = [
        'S.No',
        'School Code',
        'School Type',
        'School Name',
        'Zone',
        'Executive',
        'Town',
        'Contact Person',
        'Contact Mobile',
        'Subject',
        'Description',
        'Status',
        'Date of Enquiry',
      ]
      const lines = [
        headers.map(csvCell).join(','),
        ...queries.map((query, index) =>
          [
            index + 1,
            query.school_code || '',
            query.school_type || 'New',
            query.school_name || '',
            query.zone || '',
            query.executive?.name || '',
            query.town || '',
            query.contact_person || '',
            query.contact_mobile || '',
            query.subject || '',
            query.description || '',
            query.status || '',
            query.enquiry_date ? new Date(query.enquiry_date).toLocaleString('en-IN') : '',
          ].map(csvCell).join(',')
        ),
      ]
      const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Contact_Enquiries_Report.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Excel file downloaded')
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  }

  const kpis = useMemo(() => {
    const total = queries.length
    const uniqueSchools = new Set(
      queries
        .map((q) => q.school_code || q.school_name || '')
        .filter(Boolean)
    ).size
    const newCount = queries.filter((q) => (q.school_type || 'New') === 'New').length
    const existingCount = total - newCount
    const openCount = queries.filter((q) => {
      const status = (q.status || '').toLowerCase()
      return status === 'pending' || status === 'processing' || status === 'in progress'
    }).length
    const activeZones = new Set(queries.map((q) => q.zone).filter(Boolean)).size
    return { total, uniqueSchools, newCount, existingCount, openCount, activeZones }
  }, [queries])

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Contact Enquiries</h1>
          <p className="text-sm text-slate-500 mt-1">School contact records and logged enquiries</p>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="rounded-2xl border border-blue-100 bg-blue-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Total Enquiries</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{kpis.total}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-blue-600">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-emerald-100 bg-emerald-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Unique Schools</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{kpis.uniqueSchools}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-emerald-600">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-amber-100 bg-amber-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">New / Existing</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{kpis.newCount} / {kpis.existingCount}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-amber-600">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-purple-100 bg-purple-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-purple-600">Active Zones</p>
              <p className="mt-2 text-2xl font-bold text-purple-700">{kpis.activeZones}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-purple-600">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={schoolName || schoolCode}
              onChange={(e) => handleSchoolSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search by school name or code"
              className="pl-9 rounded-xl bg-white"
            />
          </div>

          <Select value={zone || 'all'} onValueChange={(val) => setZone(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-full xl:w-44 rounded-xl bg-white">
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={employee || 'all'} onValueChange={(val) => setEmployee(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-full xl:w-52 rounded-xl bg-white">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp._id} value={emp._id}>{emp.name || 'Unknown'}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="text"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Contact mobile"
            className="rounded-xl bg-white w-full xl:w-40"
          />

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Enquiry From</label>
            <Input
              type="date"
              value={fromDate}
              min="2010-01-01"
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Enquiry To</label>
            <Input
              type="date"
              value={toDate}
              min="2010-01-01"
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>

          <Button onClick={handleSearch} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            Search
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Enquiry log</h2>
          <span className="text-xs text-slate-500">{queries.length} enquiries found</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : queries.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No enquiries found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-14">#</th>
                  <th className="text-left px-4 py-3 w-28">Enquiry Date</th>
                  <th className="text-left px-4 py-3 w-56">School</th>
                  <th className="text-left px-4 py-3 w-40">Zone / Executive</th>
                  <th className="text-left px-4 py-3 w-40">Contact</th>
                  <th className="text-left px-4 py-3">Subject</th>
                  <th className="text-left px-4 py-3 w-28">Status</th>
                  <th className="text-left px-4 py-3 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((query, index) => {
                  const schoolNameLabel = titleCaseName(query.school_name)
                  const executive = query.executive?.name || 'Not Assigned'
                  return (
                    <tr key={`${query.source || 'query'}-${query._id}`} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                        {formatDate(query.enquiry_date)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 truncate" title={schoolNameLabel}>{schoolNameLabel}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {query.school_code ? (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {query.school_code}
                            </span>
                          ) : null}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            query.school_type === 'Existing'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {query.school_type || 'New'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 truncate" title={executive}>{executive}</p>
                        {query.zone ? (
                          <span className="inline-flex mt-0.5 max-w-full truncate text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600" title={query.zone}>
                            {query.zone}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 truncate" title={query.contact_person || '-'}>{query.contact_person || '-'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{query.contact_mobile || '-'}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="text-slate-800 truncate" title={query.subject}>{query.subject || '-'}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5" title={query.description}>{query.description || query.town || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${statusBadgeClass(query.status)}`}>
                          {query.status || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50"
                          onClick={() => setSelectedQuery(query)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedQuery} onOpenChange={(open) => { if (!open) setSelectedQuery(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enquiry details</DialogTitle>
            <DialogDescription>School contact enquiry for this record</DialogDescription>
          </DialogHeader>
          {selectedQuery && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">School</p>
                <p className="font-semibold text-slate-900">{titleCaseName(selectedQuery.school_name)}</p>
                <p className="text-slate-500">{selectedQuery.school_code || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date / Time</p>
                  <p className="text-slate-800">{formatDateTime(selectedQuery.enquiry_date)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <p className="text-slate-800">{selectedQuery.status || 'Pending'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Contact Person</p>
                  <p className="text-slate-800">{selectedQuery.contact_person || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Contact Mobile</p>
                  <p className="text-slate-800">{selectedQuery.contact_mobile || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Zone</p>
                  <p className="text-slate-800">{selectedQuery.zone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Town</p>
                  <p className="text-slate-800">{selectedQuery.town || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Subject</p>
                <p className="text-slate-800">{selectedQuery.subject || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Description</p>
                <p className="text-slate-800 whitespace-pre-wrap">{selectedQuery.description || '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
