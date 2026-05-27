'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { NotebookPen, ArrowUpDown } from 'lucide-react'

type DcOrderRef = {
  _id?: string
  dc_code?: string
  school_name?: string
  school_code?: string
}

type StockReturn = {
  _id: string
  returnId: string
  returnNumber?: number
  lrNumber?: string
  finYear?: string
  schoolCode?: string
  remarks?: string
  executiveRemarks?: string
  dcOrderId?: string | DcOrderRef
  status: string
  executiveName?: string
  customerName?: string
  returnDate?: string
  verifiedBy?: { name?: string }
}

type SortKey =
  | 'returnNo'
  | 'lrNo'
  | 'finYear'
  | 'schoolName'
  | 'schoolCode'
  | 'executive'
  | 'returnDate'
  | 'remarks'
  | 'status'

function formatReturnDate(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

function resolveSchoolName(row: StockReturn): string {
  const dc = row.dcOrderId
  if (dc && typeof dc === 'object' && dc.school_name) return dc.school_name
  return row.customerName || '-'
}

function resolveSchoolCode(row: StockReturn): string {
  if (row.schoolCode?.trim()) return row.schoolCode.trim()
  const dc = row.dcOrderId
  if (dc && typeof dc === 'object' && dc.school_code) return dc.school_code
  return '-'
}

function resolveRemarks(row: StockReturn): string {
  return (row.remarks || row.executiveRemarks || '').trim() || '-'
}

function statusBadgeClass(status: string): string {
  if (status === 'Pending Manager Approval') return 'bg-amber-100 text-amber-800'
  if (status === 'Received') return 'bg-blue-100 text-blue-800'
  if (status === 'Partially Approved') return 'bg-purple-100 text-purple-800'
  if (status === 'Stock Updated' || status === 'Approved') return 'bg-green-100 text-green-800'
  if (status === 'Rejected') return 'bg-red-100 text-red-800'
  return 'bg-neutral-100 text-neutral-700'
}

export default function WarehouseManagerStockReturnsPage() {
  const router = useRouter()
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('returnDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [pendingOnly, setPendingOnly] = useState(true)

  useEffect(() => {
    loadReturns()
  }, [pendingOnly])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const url = pendingOnly
        ? '/stock-returns/warehouse-manager/list?pending=true'
        : '/stock-returns/warehouse-manager/list'
      const response = await apiRequest<any>(url)
      const returnsList = Array.isArray(response) ? response : response?.data || []
      setReturns(
        returnsList.map((r: any) => ({
          ...r,
          status: r.status || 'Submitted',
        }))
      )
    } catch (e: any) {
      toast.error(e.message || 'Failed to load returns')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedReturns = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const list = [...returns]
    list.sort((a, b) => {
      let av = ''
      let bv = ''
      switch (sortKey) {
        case 'returnNo':
          av = String(a.returnNumber ?? a.returnId ?? '')
          bv = String(b.returnNumber ?? b.returnId ?? '')
          break
        case 'lrNo':
          av = a.lrNumber || ''
          bv = b.lrNumber || ''
          break
        case 'finYear':
          av = a.finYear || ''
          bv = b.finYear || ''
          break
        case 'schoolName':
          av = resolveSchoolName(a)
          bv = resolveSchoolName(b)
          break
        case 'schoolCode':
          av = resolveSchoolCode(a)
          bv = resolveSchoolCode(b)
          break
        case 'executive':
          av = a.executiveName || ''
          bv = b.executiveName || ''
          break
        case 'returnDate':
          av = a.returnDate || ''
          bv = b.returnDate || ''
          break
        case 'remarks':
          av = resolveRemarks(a)
          bv = resolveRemarks(b)
          break
        case 'status':
          av = a.status || ''
          bv = b.status || ''
          break
        default:
          break
      }
      if (sortKey === 'returnNo') {
        const an = Number(av)
        const bn = Number(bv)
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an - bn) * dir
      }
      return av.localeCompare(bv, undefined, { sensitivity: 'base' }) * dir
    })
    return list
  }, [returns, sortKey, sortDir])

  const SortableHeader = ({ label, column }: { label: string; column: SortKey }) => (
    <th className="py-3 px-3 font-semibold text-neutral-800 whitespace-nowrap">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-neutral-950"
        onClick={() => toggleSort(column)}
      >
        {label}
        <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
      </button>
    </th>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Return Stock List</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Warehouse manager — review field executive vs warehouse executive quantities
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={pendingOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPendingOnly(true)}
          >
            Pending review
          </Button>
          <Button
            type="button"
            variant={!pendingOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPendingOnly(false)}
          >
            All returns
          </Button>
        </div>
      </div>

      <Card className="p-4 md:p-6 border border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b bg-neutral-50">
                <th className="py-3 px-3 font-semibold w-12">S.No</th>
                <SortableHeader label="Return No" column="returnNo" />
                <SortableHeader label="LR No" column="lrNo" />
                <SortableHeader label="Fin Year" column="finYear" />
                <SortableHeader label="School Name" column="schoolName" />
                <SortableHeader label="School Code" column="schoolCode" />
                <SortableHeader label="Executive" column="executive" />
                <SortableHeader label="Return Date" column="returnDate" />
                <SortableHeader label="Remarks" column="remarks" />
                <SortableHeader label="Status" column="status" />
                <th className="py-3 px-3 font-semibold text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-500">
                    Loading...
                  </td>
                </tr>
              ) : sortedReturns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-neutral-500">
                    No returns found
                  </td>
                </tr>
              ) : (
                sortedReturns.map((row, index) => (
                  <tr key={row._id} className="border-b hover:bg-neutral-50/80">
                    <td className="py-2.5 px-3">{index + 1}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {row.returnNumber ?? row.returnId}
                    </td>
                    <td className="py-2.5 px-3">{row.lrNumber || '-'}</td>
                    <td className="py-2.5 px-3">{row.finYear || '-'}</td>
                    <td
                      className="py-2.5 px-3 max-w-[180px] truncate"
                      title={resolveSchoolName(row)}
                    >
                      {resolveSchoolName(row)}
                    </td>
                    <td className="py-2.5 px-3">{resolveSchoolCode(row)}</td>
                    <td className="py-2.5 px-3">{row.executiveName || '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {formatReturnDate(row.returnDate)}
                    </td>
                    <td
                      className="py-2.5 px-3 max-w-[140px] truncate"
                      title={resolveRemarks(row)}
                    >
                      {resolveRemarks(row)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadgeClass(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-amber-700 hover:bg-amber-50"
                        title="Review return"
                        onClick={() =>
                          router.push(`/dashboard/returns/warehouse-manager/${row._id}`)
                        }
                      >
                        <NotebookPen className="w-5 h-5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
