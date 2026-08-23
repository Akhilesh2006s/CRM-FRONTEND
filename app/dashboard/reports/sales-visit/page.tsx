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
  Repeat,
  Trophy,
} from 'lucide-react'
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
    address?: string
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

function titleCaseName(value?: string) {
  if (!value || value === '-') return value || '-'
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function initials(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
}

function looksLikeSchoolCode(value: string) {
  return /dc[-_]?\s*\d+/i.test(value) || /^\s*[A-Za-z]{1,8}[-_]\d+/.test(value)
}

function categoryBadgeClass(category?: string) {
  const value = (category || '').trim()
  if (value === 'New School') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (value === 'Term 1') return 'bg-purple-50 text-purple-700 border-purple-200'
  if (value === 'Term 2') return 'bg-cyan-50 text-cyan-700 border-cyan-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

export default function SalesVisitReportPage() {
  const [visits, setVisits] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [selectedVisit, setSelectedVisit] = useState<DC | null>(null)

  // Filters — same state names and API params as before
  const [zone, setZone] = useState('')
  const [employee, setEmployee] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [schoolCode, setSchoolCode] = useState('')

  useEffect(() => {
    loadEmployees()
    loadVisits()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const loadVisits = async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (zone) qs.set('zone', zone)
      if (employee) qs.set('employeeId', employee)
      if (visitDate) {
        qs.set('fromDate', visitDate)
        qs.set('toDate', visitDate)
      }
      if (schoolName) qs.set('schoolName', schoolName)
      if (schoolCode) qs.set('schoolCode', schoolCode)
      const data = await apiRequest<DC[]>(`/dc${qs.toString() ? `?${qs.toString()}` : ''}`)
      const rows = (Array.isArray(data) ? data : []).filter((dc) => {
        const name = (dc.dcOrderId?.school_name || dc.customerName || '').trim()
        if (!name) return true
        if (/ABCDEFGHIJKLMNOPQRSTUVWXYZ/i.test(name)) return false
        if (/@{3,}|#{2,}|\$\$/.test(name)) return false
        return true
      })
      setVisits(rows)
      const uniqueZones = Array.from(new Set(
        rows.map(dc => dc.dcOrderId?.zone || dc.saleId?.zone).filter(Boolean)
      )) as string[]
      if (!zone) setZones(uniqueZones.sort())
    } catch (_) {
      toast.error('Failed to load sales visits')
    }
    setLoading(false)
  }

  const handleSearch = () => {
    loadVisits()
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (zone) qs.append('zone', zone)
      if (employee) qs.append('employeeId', employee)
      if (visitDate) {
        qs.append('fromDate', visitDate)
        qs.append('toDate', visitDate)
      }
      if (schoolName) qs.append('schoolName', schoolName)
      if (schoolCode) qs.append('schoolCode', schoolCode)
      await downloadReportFile(`/dc/export-sales-visit?${qs.toString()}`, 'Sales_Visit_Report.xlsx')
      toast.success('Excel file downloaded')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export to Excel')
    }
  }

  const formatVisitDate = (dateStr?: string) => {
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
      second: '2-digit',
      hour12: true,
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

  const getVisitRemarks = (dc: DC) => dc.dcRemarks || dc.dcNotes || ''

  const getContactMobile = (dc: DC) => dc.dcOrderId?.contact_mobile || dc.customerPhone || '-'

  const getAddress = (dc: DC) => dc.dcOrderId?.address || dc.customerAddress || '-'

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

  const kpis = useMemo(() => {
    const totalVisits = visits.length
    const uniqueSchools = new Set(
      visits
        .map((v) => {
          const code = getSchoolCode(v)
          if (code && code !== '-') return code
          const name = getSchoolName(v)
          return name && name !== '-' ? name : ''
        })
        .filter(Boolean)
    ).size

    const newCount = visits.filter((v) => {
      const category = v.dcCategory || ''
      return category === 'New School' || getSchoolType(v) === 'New'
    }).length
    const followUpCount = totalVisits - newCount
    const newPercent = totalVisits ? Math.round((newCount / totalVisits) * 100) : 0
    const followUpPercent = totalVisits ? Math.round((followUpCount / totalVisits) * 100) : 0

    const leadsConverted = visits.filter((v) => {
      const remarks = getVisitRemarks(v).toLowerCase()
      return remarks.includes('converted') || remarks.includes('lead')
    }).length

    const activeZones = new Set(
      visits.map((v) => {
        const z = getZone(v)
        return z && z !== '-' ? z : ''
      }).filter(Boolean)
    ).size

    return {
      totalVisits,
      uniqueSchools,
      newPercent,
      followUpPercent,
      leadsConverted,
      activeZones,
    }
  }, [visits])

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Sales Visit Report</h1>
          <p className="text-sm text-neutral-500 mt-1">School visits from DC records</p>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="rounded-2xl border border-blue-100 bg-blue-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Total Visits</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{kpis.totalVisits}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-blue-600">
              <Building2 className="h-5 w-5" />
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
              <p className="text-xs font-medium uppercase tracking-wide text-amber-600">New vs Follow-up</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{kpis.newPercent}% / {kpis.followUpPercent}%</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-amber-600">
              <Repeat className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-rose-100 bg-rose-50 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">Leads Converted</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{kpis.leadsConverted}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-rose-600">
              <Trophy className="h-5 w-5" />
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

      <Card className="p-4 md:p-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Zone</label>
            <Select value={zone || 'all'} onValueChange={(val) => setZone(val === 'all' ? '' : val)}>
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Select Employee</label>
            <Select value={employee || 'all'} onValueChange={(val) => setEmployee(val === 'all' ? '' : val)}>
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
            <label className="text-sm font-medium text-neutral-700 mb-2 block">Visit Date</label>
            <Input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              placeholder="dd-mm-yyyy"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700 mb-2 block">By School Name / Code</label>
            <Input
              type="text"
              value={schoolName || schoolCode}
              onChange={(e) => handleSchoolSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search by School Name / Code"
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

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Visit log</h2>
          <span className="text-xs text-slate-500">{visits.length} records</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : visits.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No visits found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-14">#</th>
                  <th className="text-left px-4 py-3 w-28">Visit Date</th>
                  <th className="text-left px-4 py-3 w-44">Executive & Zone</th>
                  <th className="text-left px-4 py-3 w-56">School Details</th>
                  <th className="text-left px-4 py-3 w-36">Town / Location</th>
                  <th className="text-left px-4 py-3 w-32">Visit Category</th>
                  <th className="text-left px-4 py-3">Visit Remarks & Status</th>
                  <th className="text-left px-4 py-3 w-16">Action</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit, index) => {
                  const remarks = getVisitRemarks(visit)
                  const converted = remarks.toLowerCase().includes('lead converted to client')
                  const schoolType = getSchoolType(visit)
                  const executive = getExecutive(visit)
                  const zoneLabel = getZone(visit)
                  const schoolCodeLabel = getSchoolCode(visit)
                  const schoolNameLabel = titleCaseName(getSchoolName(visit))
                  const townLabel = getTown(visit)
                  return (
                    <tr key={visit._id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">
                        {formatVisitDate(visit.dcDate || visit.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">
                            {initials(executive)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate" title={executive}>{executive}</p>
                            {zoneLabel && zoneLabel !== '-' && (
                              <span className="inline-flex mt-0.5 max-w-full truncate text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600" title={zoneLabel}>
                                {zoneLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 truncate" title={schoolNameLabel}>{schoolNameLabel}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {schoolCodeLabel !== '-' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {schoolCodeLabel}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            schoolType === 'New'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {schoolType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 truncate" title={townLabel}>{townLabel}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full border ${categoryBadgeClass(visit.dcCategory)}`}>
                          {visit.dcCategory || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        {converted ? (
                          <span
                            title={remarks}
                            className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 font-medium"
                          >
                          ✅ Converted to Client
                          </span>
                        ) : (
                          <p className="text-slate-600 truncate" title={remarks || '-'}>
                            {remarks || '-'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-blue-50"
                          onClick={() => setSelectedVisit(visit)}
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

      <Dialog open={!!selectedVisit} onOpenChange={(open) => { if (!open) setSelectedVisit(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Visit details</DialogTitle>
            <DialogDescription>Complete visit log for this school</DialogDescription>
          </DialogHeader>
          {selectedVisit && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">School</p>
                <p className="font-semibold text-slate-900">{titleCaseName(getSchoolName(selectedVisit))}</p>
                <p className="text-slate-500">{getSchoolCode(selectedVisit)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Date / Time</p>
                  <p className="text-slate-800">{formatDateTime(selectedVisit.dcDate || selectedVisit.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Contact Mobile</p>
                  <p className="text-slate-800">{getContactMobile(selectedVisit)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">School Address</p>
                <p className="text-slate-800">{getAddress(selectedVisit)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Full Remarks</p>
                <p className="text-slate-800 whitespace-pre-wrap">{getVisitRemarks(selectedVisit) || '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
