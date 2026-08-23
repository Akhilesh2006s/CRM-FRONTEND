'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { toast } from 'sonner'
import {
  Activity,
  Download,
  GitCompare,
  History,
  Search,
  Shapes,
} from 'lucide-react'

type ChangeLog = {
  _id: string
  entityType?: string
  entityId?: string
  action?: string
  summary?: string
  fields?: string[]
  actorName?: string
  actorEmail?: string
  createdAt?: string
}

type ChangeLogStats = {
  creates?: number
  updates?: number
  deletes?: number
  topEntity?: string
}

const ENTITY_OPTIONS = ['all', 'Lead', 'DC', 'DcOrder', 'Expense', 'Product', 'Training', 'Service', 'ContactQuery']

function entityBadgeClass(entity?: string) {
  const value = (entity || '').trim()
  if (value === 'DC') return 'bg-purple-100 text-purple-700'
  if (value === 'DcOrder') return 'bg-blue-100 text-blue-700'
  if (value === 'Lead') return 'bg-emerald-100 text-emerald-700'
  if (value === 'Expense') return 'bg-amber-100 text-amber-700'
  if (value === 'Product') return 'bg-indigo-100 text-indigo-700'
  if (value === 'Training') return 'bg-cyan-100 text-cyan-700'
  if (value === 'Service') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

function actionBadgeClass(action?: string) {
  const value = (action || '').toLowerCase()
  if (value === 'create') return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (value === 'update') return 'bg-sky-50 text-sky-700 border border-sky-200'
  if (value === 'delete') return 'bg-rose-50 text-rose-700 border border-rose-200'
  return 'bg-slate-50 text-slate-700 border border-slate-200'
}

function formatWhen(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function splitSummary(summary?: string) {
  const value = (summary || '').trim()
  if (!value) return { title: '—', detail: '' }
  const parts = value.split(/\s+[—–-]\s+/)
  if (parts.length < 2) return { title: value, detail: '' }
  return { title: parts[0], detail: parts.slice(1).join(' — ') }
}

function performedBy(row: ChangeLog) {
  return row.actorName || row.actorEmail || 'Amenity (System)'
}

export default function ChangeLogsPage() {
  const [rows, setRows] = useState<ChangeLog[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<ChangeLogStats>({})
  const [loading, setLoading] = useState(true)
  const [entityType, setEntityType] = useState('all')
  const [action, setAction] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const load = async (nextPage = page) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (entityType !== 'all') qs.set('entityType', entityType)
      if (action !== 'all') qs.set('action', action)
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      if (search.trim()) qs.set('search', search.trim())
      qs.set('page', String(nextPage))
      qs.set('limit', String(limit))
      const data = await apiRequest<{ data: ChangeLog[]; total: number; stats?: ChangeLogStats }>(
        `/reports/change-logs?${qs.toString()}`
      )
      const list = Array.isArray(data?.data) ? data.data : []
      setRows(list)
      setTotal(Number(data?.total) || 0)
      setStats(data?.stats || {})
      setPage(nextPage)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load change logs')
      setRows([])
      setStats({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (entityType !== 'all') qs.set('entityType', entityType)
      if (action !== 'all') qs.set('action', action)
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      if (search.trim()) qs.set('search', search.trim())
      await downloadReportFile(`/reports/change-logs/export?${qs.toString()}`, 'Change_Logs.xlsx')
    } catch (e: any) {
      toast.error(e?.message || 'Export failed')
    }
  }

  const kpis = useMemo(() => {
    const source = rows
    const createCount =
      stats.creates ?? source.filter((row) => (row.action || '').toLowerCase() === 'create').length
    const updateCount =
      stats.updates ?? source.filter((row) => (row.action || '').toLowerCase() === 'update').length
    let topEntity = stats.topEntity || ''
    if (!topEntity) {
      const counts: Record<string, number> = {}
      source.forEach((row) => {
        const type = row.entityType || 'Unknown'
        counts[type] = (counts[type] || 0) + 1
      })
      const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
      topEntity = ranked.length >= 2 ? `${ranked[0][0]} & ${ranked[1][0]}` : (ranked[0]?.[0] || '—')
    }
    return {
      total: total || source.length,
      createCount,
      updateCount,
      topEntity,
    }
  }, [rows, total, stats])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-100">
            <History className="w-6 h-6 text-slate-700" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Change Logs</h1>
            <p className="text-sm text-slate-500 mt-1">Creates, updates, and deletes across CRM records</p>
          </div>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide">Total Activities</p>
              <p className="mt-2 text-2xl font-bold">{kpis.total.toLocaleString('en-IN')} Recorded</p>
            </div>
            <Activity className="h-5 w-5 opacity-70" />
          </div>
        </Card>
        <Card className="rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide">Creates vs Updates</p>
              <p className="mt-2 text-lg font-bold">
                {kpis.createCount} Created • {kpis.updateCount} Updated
              </p>
            </div>
            <GitCompare className="h-5 w-5 opacity-70" />
          </div>
        </Card>
        <Card className="rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide">Top Modified Entity</p>
              <p className="mt-2 text-2xl font-bold">{kpis.topEntity}</p>
            </div>
            <Shapes className="h-5 w-5 opacity-70" />
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-full xl:w-40 rounded-xl bg-white">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>{v === 'all' ? 'All Entities' : v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-full xl:w-36 rounded-xl bg-white">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">From</label>
            <Input
              type="date"
              value={fromDate}
              min="2010-01-01"
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">To</label>
            <Input
              type="date"
              value={toDate}
              min="2010-01-01"
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>

          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(1) }}
              placeholder="Search summary or user..."
              className="pl-9 rounded-xl bg-white"
            />
          </div>

          <Button onClick={() => load(1)} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            Search
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Activity log</h2>
          <span className="text-xs text-slate-500">{total} records</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No change logs yet. New creates and updates will appear here.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-44">When</th>
                  <th className="text-left px-4 py-3 w-28">Entity</th>
                  <th className="text-left px-4 py-3 w-28">Action</th>
                  <th className="text-left px-4 py-3">Summary</th>
                  <th className="text-left px-4 py-3 w-64">Modified Fields</th>
                  <th className="text-left px-4 py-3 w-40">Performed By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const summary = splitSummary(row.summary)
                  const fields = Array.isArray(row.fields) ? row.fields.filter(Boolean) : []
                  return (
                    <tr key={row._id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{formatWhen(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium px-2 py-0.5 rounded text-xs ${entityBadgeClass(row.entityType)}`}>
                          {row.entityType || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${actionBadgeClass(row.action)}`}>
                          {row.action || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-0">
                        <p className="font-semibold text-slate-900 truncate" title={summary.title}>{summary.title}</p>
                        {summary.detail ? (
                          <p className="text-xs text-slate-500 truncate mt-0.5" title={summary.detail}>{summary.detail}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {fields.length ? (
                          <div className="flex flex-wrap gap-1">
                            {fields.slice(0, 6).map((field) => (
                              <span
                                key={field}
                                className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[11px]"
                              >
                                {field}
                              </span>
                            ))}
                            {fields.length > 6 ? (
                              <span className="text-[11px] text-slate-400">+{fields.length - 6}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800 truncate" title={performedBy(row)}>
                        {performedBy(row)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > limit && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{total} records</span>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</Button>
            <span className="py-2">Page {page} of {totalPages}</span>
            <Button variant="outline" className="rounded-xl" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
