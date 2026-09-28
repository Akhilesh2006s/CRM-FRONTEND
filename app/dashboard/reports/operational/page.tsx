'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'

type ReportCatalogItem = { key: string; title: string; description: string }
type ReportColumn = { key: string; label: string; type?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime' }
type ReportPayload = {
  report: ReportCatalogItem
  columns: ReportColumn[]
  rows: Record<string, unknown>[]
  summary: Record<string, unknown>
  notes?: string[]
  generatedAt: string
}

function formatLabel(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(value: unknown, type?: ReportColumn['type']) {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'currency') return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  if (type === 'percent') return `${(Number(value || 0) * 100).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`
  if (type === 'number') return Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (type === 'date' || type === 'datetime') {
    const date = new Date(String(value))
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('en-IN', type === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' })
    }
  }
  return String(value)
}

export default function OperationalReportsPage() {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([])
  const [reportKey, setReportKey] = useState('collections')
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [zone, setZone] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    apiRequest<ReportCatalogItem[]>('/reports/operational')
      .then((items) => {
        setCatalog(items)
        if (items.length && !items.some((item) => item.key === reportKey)) setReportKey(items[0].key)
      })
      .catch((error) => toast.error(error?.message || 'Failed to load report catalog'))
  }, [])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (fromDate) params.set('fromDate', fromDate)
    if (toDate) params.set('toDate', toDate)
    if (academicYear) params.set('academicYear', academicYear)
    if (zone) params.set('zone', zone)
    if (schoolCode) params.set('schoolCode', schoolCode)
    if (search) params.set('search', search)
    params.set('limit', '1000')
    return params.toString()
  }, [academicYear, fromDate, schoolCode, search, toDate, zone])

  const loadReport = useCallback(async () => {
    try {
      setLoading(true)
      const response = await apiRequest<ReportPayload>(`/reports/operational/${reportKey}?${queryString}`)
      setPayload(response)
    } catch (error: any) {
      setPayload(null)
      toast.error(error?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [queryString, reportKey])

  useEffect(() => { loadReport() }, [loadReport])

  const exportReport = async () => {
    try {
      setExporting(true)
      await downloadReportFile(`/reports/operational/${reportKey}/export?${queryString}`, `${reportKey}.xlsx`)
      toast.success('Excel report downloaded')
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export report')
    } finally {
      setExporting(false)
    }
  }

  const selected = catalog.find((item) => item.key === reportKey)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-neutral-600" />
            <h1 className="text-2xl font-semibold text-neutral-900 md:text-3xl">Operational Reports</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500">Collections, school status, PO/DC, master lists, schedules, visits, returns, and ledger.</p>
        </div>
        <Button onClick={exportReport} disabled={loading || exporting || !payload}>
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export Excel'}
        </Button>
      </div>

      <Card className="border border-neutral-200 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-neutral-600">
            Report
            <select className="h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm" value={reportKey} onChange={(event) => setReportKey(event.target.value)}>
              {catalog.map((item) => <option key={item.key} value={item.key}>{item.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">From date<Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">To date<Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">Academic year<Input placeholder="2026-27" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">Zone<Input placeholder="Zone" value={zone} onChange={(event) => setZone(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium text-neutral-600">School code<Input placeholder="School code" value={schoolCode} onChange={(event) => setSchoolCode(event.target.value)} /></label>
          <label className="space-y-1 text-xs font-medium text-neutral-600 xl:col-span-2">Search<Input placeholder="Search any displayed field" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={loadReport} disabled={loading}><Search className="h-4 w-4" />Apply filters</Button>
          <Button variant="outline" onClick={() => { setFromDate(''); setToDate(''); setAcademicYear(''); setZone(''); setSchoolCode(''); setSearch('') }}>
            <RefreshCw className="h-4 w-4" />Clear
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-neutral-900">{payload?.report?.title || selected?.title || 'Report'}</h2>
        <p className="text-sm text-neutral-500">{payload?.report?.description || selected?.description}</p>
      </div>

      {payload && Object.keys(payload.summary || {}).length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Object.entries(payload.summary).map(([key, value]) => (
            <Card key={key} className="border border-neutral-200 p-4">
              <div className="text-xs uppercase tracking-wide text-neutral-500">{formatLabel(key)}</div>
              <div className="mt-1 text-xl font-semibold text-neutral-900">{typeof value === 'number' ? value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : String(value ?? '—')}</div>
            </Card>
          ))}
        </div>
      )}

      {payload?.notes?.map((note) => (
        <div key={note} className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{note}</div>
      ))}

      <Card className="overflow-hidden border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <span className="text-sm font-medium text-neutral-900">{loading ? 'Loading…' : `${payload?.rows.length || 0} rows`}</span>
          {payload?.generatedAt && <span className="text-xs text-neutral-500">Generated {new Date(payload.generatedAt).toLocaleString('en-IN')}</span>}
        </div>
        <div className="max-h-[65vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-neutral-100">
              <TableRow>{payload?.columns.map((item) => <TableHead key={item.key}>{item.label}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {!loading && payload?.rows.map((row, index) => (
                <TableRow key={index}>
                  {payload.columns.map((item) => <TableCell key={item.key} className={item.type === 'text' || !item.type ? 'max-w-80 whitespace-normal' : 'text-right'}>{formatValue(row[item.key], item.type)}</TableCell>)}
                </TableRow>
              ))}
              {!loading && (!payload || payload.rows.length === 0) && <TableRow><TableCell colSpan={payload?.columns.length || 1} className="py-12 text-center text-neutral-500">No records match these filters.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
