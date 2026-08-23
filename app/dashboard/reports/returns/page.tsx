'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { downloadReportFile } from '@/lib/reportDownload'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Download, Search, Package, Clock, Warehouse } from 'lucide-react'

type ExecReturn = { _id: string; returnNumber: number; returnDate: string; createdAt: string; createdBy?: { name?: string }; leadId?: { school_name?: string }; remarks?: string; lrNumber?: string; finYear?: string }
type WarehouseReturn = { _id: string; returnNumber: number; returnDate: string; createdAt: string; createdBy?: { name?: string }; remarks?: string; lrNumber?: string; finYear?: string }

type ReturnRow = ExecReturn | WarehouseReturn

function formatDateIn(dateStr?: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTimeIn(dateStr?: string) {
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

function remarksText(row: ReturnRow) {
  return (row.remarks || '').trim()
}

function isPendingRow(row: ReturnRow) {
  const text = remarksText(row).toLowerCase()
  return text.includes('pending')
}

function statusFromRemarks(remarks?: string) {
  const text = (remarks || '').toLowerCase()
  if (text.includes('pending')) {
    return {
      label: 'Pending Approval',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    }
  }
  if (text.includes('partial')) {
    return {
      label: 'Partial Approval',
      className: 'bg-sky-50 text-sky-700 border border-sky-200',
    }
  }
  return {
    label: 'Approved',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  }
}

function matchesSearch(row: ReturnRow, search: string) {
  if (!search) return true
  const q = search.toLowerCase()
  return (
    (row.lrNumber || '').toLowerCase().includes(q) ||
    (row.createdBy?.name || '').toLowerCase().includes(q) ||
    (row.remarks || '').toLowerCase().includes(q)
  )
}

export default function ReturnsReportPage() {
  const [executive, setExecutive] = useState<ExecReturn[]>([])
  const [warehouse, setWarehouse] = useState<WarehouseReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [finYear, setFinYear] = useState('all')
  const [activeTab, setActiveTab] = useState<'executive' | 'warehouse'>('executive')

  const load = async () => {
    setLoading(true)
    try {
      const execQs = new URLSearchParams()
      if (fromDate) execQs.set('fromDate', fromDate)
      if (toDate) execQs.set('toDate', toDate)
      const [execData, whData] = await Promise.all([
        apiRequest<ExecReturn[]>(`/stock-returns/executive${execQs.toString() ? `?${execQs.toString()}` : ''}`),
        apiRequest<WarehouseReturn[]>(`/stock-returns/warehouse`),
      ])
      setExecutive(execData || [])
      let warehouseRows = whData || []
      if (fromDate || toDate) {
        warehouseRows = warehouseRows.filter((r) => {
          const created = r.createdAt ? new Date(r.createdAt) : null
          if (!created) return false
          if (fromDate && created < new Date(fromDate)) return false
          if (toDate && created > new Date(toDate + 'T23:59:59')) return false
          return true
        })
      }
      setWarehouse(warehouseRows)
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleExport = async () => {
    try {
      const qs = new URLSearchParams()
      if (fromDate) qs.set('fromDate', fromDate)
      if (toDate) qs.set('toDate', toDate)
      await downloadReportFile(`/reports/returns/export?${qs.toString()}`, 'Returns_Report.xlsx')
      toast({ title: 'Excel file downloaded' })
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Export failed', variant: 'destructive' })
    }
  }

  const finYears = useMemo(() => {
    const years = new Set<string>()
    ;[...executive, ...warehouse].forEach((row) => {
      if (row.finYear) years.add(row.finYear)
    })
    return Array.from(years).sort().reverse()
  }, [executive, warehouse])

  const filterRows = <T extends ReturnRow>(rows: T[]) =>
    rows.filter((row) => {
      if (finYear !== 'all' && row.finYear !== finYear) return false
      return matchesSearch(row, searchTerm)
    })

  const executiveReturns = useMemo(
    () => filterRows(executive),
    [executive, searchTerm, finYear]
  )
  const warehouseReturns = useMemo(
    () => filterRows(warehouse),
    [warehouse, searchTerm, finYear]
  )

  const totalReturnsCount = executiveReturns.length + warehouseReturns.length
  const pendingManagerReview = [...executiveReturns, ...warehouseReturns].filter(isPendingRow).length
  const receivedAtWarehouse = warehouseReturns.length

  const activeRows = activeTab === 'executive' ? executiveReturns : warehouseReturns

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Returns Report</h1>
          <p className="text-sm text-neutral-500 mt-1">Executive and warehouse stock returns</p>
        </div>
        <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0">
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Total Returns</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{totalReturnsCount} Logged</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-emerald-700">
              <Package className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending Manager Review</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{pendingManagerReview}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Received at Warehouse</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{receivedAtWarehouse}</p>
            </div>
            <div className="rounded-xl bg-white/70 p-2 text-blue-700">
              <Warehouse className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      <Card className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-end gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load() }}
              placeholder="Search by LR No, Executive, or Remarks..."
              className="pl-9 rounded-xl bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Fin Year</label>
            <Select value={finYear} onValueChange={setFinYear}>
              <SelectTrigger className="w-full xl:w-36 rounded-xl bg-white">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {finYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">From Date</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">To Date</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl bg-white w-full xl:w-40"
            />
          </div>

          <Button onClick={load} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0">
            Search
          </Button>
        </div>
      </Card>

      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 md:px-5 pt-4">
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('executive')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'executive'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Returns ({executiveReturns.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('warehouse')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'warehouse'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Warehouse Returns ({warehouseReturns.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading…</div>
        ) : activeRows.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {activeTab === 'executive' ? 'No executive returns' : 'No warehouse returns'}
          </div>
        ) : (
          <div className="w-full overflow-x-auto mt-3">
            <table className="w-full min-w-[980px] table-fixed text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-24">Return #</th>
                  <th className="text-left px-4 py-3 w-40">LR Number</th>
                  <th className="text-left px-4 py-3 w-44">
                    {activeTab === 'executive' ? 'Initiated By' : 'Manager'}
                  </th>
                  <th className="text-left px-4 py-3 w-28">Fin Year</th>
                  <th className="text-left px-4 py-3 w-32">Return Date</th>
                  <th className="text-left px-4 py-3">Status & Remarks</th>
                  <th className="text-left px-4 py-3 w-44">Created At</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => {
                  const status = statusFromRemarks(row.remarks)
                  const remark = remarksText(row)
                  return (
                    <tr key={row._id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">#{row.returnNumber}</td>
                      <td className="px-4 py-3">
                        {row.lrNumber ? (
                          <span className="font-mono bg-slate-100 text-slate-800 text-xs px-2 py-0.5 rounded border border-slate-200">
                            {row.lrNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800 truncate" title={row.createdBy?.name || '-'}>
                        {row.createdBy?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {row.finYear ? (
                          <span className="inline-flex text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {row.finYear}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800 whitespace-nowrap">{formatDateIn(row.returnDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        {remark ? (
                          <p className="text-xs text-slate-500 mt-1 truncate" title={remark}>{remark}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDateTimeIn(row.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
