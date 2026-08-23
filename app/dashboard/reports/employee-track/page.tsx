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
import { Download, MapPin, Radio, Search, Users } from 'lucide-react'
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
  phone?: string
  mobile?: string
  zone?: string
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

function isSameLocalDay(dateStr?: string) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export default function EmployeeTrackingReportPage() {
  const [trackingData, setTrackingData] = useState<TrackingData[]>([])
  const [allTrackingData, setAllTrackingData] = useState<TrackingData[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedTrack, setSelectedTrack] = useState<TrackingData | null>(null)

  const [searchText, setSearchText] = useState('')
  const [employee, setEmployee] = useState('')
  const [zone, setZone] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => {
    loadEmployees()
    loadTrackingData()
  }, [])

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<Employee[]>('/employees?isActive=true')
      setEmployees(data || [])
    } catch (_) {}
  }

  const resolveEmployeeId = (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return ''
    const matches = employees.filter((emp) => {
      const name = (emp.name || '').toLowerCase()
      const phone = String(emp.phone || emp.mobile || '')
      return name.includes(q) || phone.includes(query.trim())
    })
    return matches.length === 1 ? matches[0]._id : ''
  }

  const loadTrackingData = async () => {
    setLoading(true)
    try {
      const resolvedId = resolveEmployeeId(searchText)
      setEmployee(resolvedId)

      const qs = new URLSearchParams()
      if (resolvedId) qs.append('employeeId', resolvedId)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      const data = await apiRequest<TrackingData[]>(`/employees/tracking${qs.toString() ? `?${qs.toString()}` : ''}`)
      const rows = Array.isArray(data) ? data : []
      setAllTrackingData(rows)

      const q = searchText.trim().toLowerCase()
      let filtered = rows
      if (q) {
        filtered = filtered.filter((row) =>
          (row.employeeName || '').toLowerCase().includes(q) ||
          (row.mobileNo || '').toLowerCase().includes(q)
        )
      }
      if (zone) {
        filtered = filtered.filter((row) => (row.zone || '') === zone)
      }
      if (fromDate) {
        filtered = filtered.filter((row) => localYmd(row.started) === fromDate)
      }
      if (toDate) {
        filtered = filtered.filter((row) => localYmd(row.lastUsed) === toDate)
      }
      setTrackingData(filtered)
    } catch (_) {
      toast.error('Failed to load employee tracking data')
    }
    setLoading(false)
  }

  const handleSearch = () => {
    loadTrackingData()
  }

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      const resolvedId = employee || resolveEmployeeId(searchText)
      if (resolvedId) qs.append('employeeId', resolvedId)
      if (fromDate) qs.append('fromDate', fromDate)
      if (toDate) qs.append('toDate', toDate)
      await downloadReportFile(`/employees/tracking/export?${qs.toString()}`, 'Employee_Tracking_Report.xlsx')
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
      hour12: true,
    })
  }

  const handleViewDetails = (track: TrackingData) => {
    setSelectedTrack(track)
  }

  const zones = useMemo(() => {
    const fromTracking = allTrackingData.map((row) => row.zone).filter(Boolean)
    const fromEmployees = employees.map((emp) => emp.zone).filter(Boolean) as string[]
    return Array.from(new Set([...fromTracking, ...fromEmployees])).sort()
  }, [allTrackingData, employees])

  const kpis = useMemo(() => {
    const fieldExecutives = trackingData.length
    const totalGpsLogs = trackingData.reduce((sum, row) => sum + (Number(row.logCount) || 0), 0)
    const zoneCoverage = new Set(trackingData.map((row) => row.zone).filter(Boolean)).size
    return { fieldExecutives, totalGpsLogs, zoneCoverage }
  }, [trackingData])

  const maxLogs = useMemo(
    () => Math.max(1, ...trackingData.map((row) => Number(row.logCount) || 0)),
    [trackingData]
  )

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Employee Tracking Report</h1>
          <p className="text-sm text-slate-500 mt-1">Field executive activity, GPS logs, and last known location</p>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Field Executives</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-800">{kpis.fieldExecutives}</p>
            <Users className="h-5 w-5 text-slate-400" />
          </div>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total GPS Logs</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-800">{kpis.totalGpsLogs.toLocaleString('en-IN')}</p>
            <Radio className="h-5 w-5 text-slate-400" />
          </div>
        </Card>
        <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Zone Coverage</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-semibold text-slate-800">{kpis.zoneCoverage}</p>
            <MapPin className="h-5 w-5 text-slate-400" />
          </div>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search for Employee or Mobile"
              className="pl-9 rounded-xl bg-white"
            />
          </div>

          <Select value={zone || 'all'} onValueChange={(val) => setZone(val === 'all' ? '' : val)}>
            <SelectTrigger className="w-full xl:w-48 rounded-xl bg-white">
              <SelectValue placeholder="All Zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Started</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Last Used</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>

          <Button onClick={handleSearch} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            Search
          </Button>
        </div>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Tracking log</h2>
          <span className="text-xs text-slate-500">{trackingData.length} employees found</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : trackingData.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No tracking data found.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">S.No</th>
                  <th className="text-left px-4 py-3">Employee</th>
                  <th className="text-left px-4 py-3">Zone</th>
                  <th className="text-left px-4 py-3">Live Status</th>
                  <th className="text-left px-4 py-3">Activity Timestamps</th>
                  <th className="text-left px-4 py-3">Last Location</th>
                  <th className="text-left px-4 py-3">Logs</th>
                  <th className="text-left px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.map((track, index) => {
                  const activeToday = isSameLocalDay(track.lastUsed)
                  const logPct = Math.min(100, Math.round(((Number(track.logCount) || 0) / maxLogs) * 100))
                  return (
                    <tr key={track._id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{track.employeeName || '-'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{track.mobileNo || '-'}</p>
                      </td>
                      <td className="px-4 py-3">
                        {track.zone ? (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {track.zone}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {activeToday ? (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active Today
                          </span>
                        ) : (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                            Idle
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>First Check-in: {formatDate(track.started)}</p>
                        <p className="mt-0.5">Last Active: {formatDate(track.lastUsed)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="truncate text-slate-700" title={track.lastLocation || '-'}>
                            {track.lastLocation || '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 w-36">
                        <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                          {track.logCount || 0}
                        </span>
                        <div className="mt-2 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${logPct}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(track)}
                          className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                          View Activity
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

      <Dialog open={!!selectedTrack} onOpenChange={(open) => { if (!open) setSelectedTrack(null) }}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>View Activity</DialogTitle>
            <DialogDescription>Tracking details for this field executive</DialogDescription>
          </DialogHeader>
          {selectedTrack && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Employee</p>
                <p className="font-semibold text-slate-800">{selectedTrack.employeeName || '-'}</p>
                <p className="text-xs text-slate-500">{selectedTrack.mobileNo || '-'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Zone</p>
                  <p className="text-slate-800">{selectedTrack.zone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Live Status</p>
                  <p className="text-slate-800">{isSameLocalDay(selectedTrack.lastUsed) ? 'Active Today' : 'Idle'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">First Check-in</p>
                  <p className="text-slate-800">{formatDate(selectedTrack.started)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Last Active</p>
                  <p className="text-slate-800">{formatDate(selectedTrack.lastUsed)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Last Location</p>
                <p className="text-slate-800">{selectedTrack.lastLocation || '-'}</p>
                {selectedTrack.lastLatitude != null && selectedTrack.lastLongitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${selectedTrack.lastLatitude},${selectedTrack.lastLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-1 text-blue-600 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Open in Maps
                  </a>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">GPS Logs</p>
                <p className="text-slate-800">{selectedTrack.logCount || 0}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
