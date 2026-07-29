'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Can } from '@/components/permissions/Can'
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
  saleId?: string
  dcOrderId?: string | DcOrderRef
  returnType: string
  returnQty?: number
  totalQuantity?: number
  returnStatus: string
  status: string
  createdAt: string
  updatedAt: string
  executiveId?: string
  executiveName?: string
  customerName?: string
  warehouse?: string
  returnDate?: string
  products?: Array<{
    product: string
    soldQty: number
    returnQty: number
    reason: string
    remarks?: string
    receivedQty?: number
    condition?: string
    batchLot?: string
    storageLocation?: string
    quantityMismatch?: boolean
    mismatchRemark?: string
  }>
  evidencePhotos?: string[]
  warehousePhotos?: string[]
  executiveRemarks?: string
  totalItems?: number
  invoice?: string
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

export default function WarehouseExecutiveStockReturnsPage() {
  const router = useRouter()
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('returnDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const response = await apiRequest<any>(`/stock-returns/warehouse-executive/list`)
      const returnsList = Array.isArray(response) ? response : (response?.data || [])
      setReturns(
        returnsList.map((r: any) => ({
          ...r,
          status: r.status || r.returnStatus || 'Submitted',
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
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
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
          av = a.returnDate || a.createdAt || ''
          bv = b.returnDate || b.createdAt || ''
          break
        case 'remarks':
          av = resolveRemarks(a)
          bv = resolveRemarks(b)
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

  const canWarehouseEdit = (returnItem: StockReturn) => {
    const s = (returnItem.status || returnItem.returnStatus || '').trim()
    return s === 'Submitted' || s === 'Sent Back'
  }

  const openReturnUpdate = (returnItem: StockReturn) => {
    router.push(`/dashboard/returns/warehouse-executive/${returnItem._id}`)
  }

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
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Return Stock List</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Warehouse executive return dashboard — open a row to verify and submit to manager
        </p>
      </div>

      <Card className="p-4 md:p-6 border border-neutral-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b bg-neutral-50">
                <th className="py-3 px-3 font-semibold text-neutral-800 w-12">S.No</th>
                <SortableHeader label="Return No" column="returnNo" />
                <SortableHeader label="LR No" column="lrNo" />
                <SortableHeader label="Fin Year" column="finYear" />
                <SortableHeader label="School Name" column="schoolName" />
                <SortableHeader label="School Code" column="schoolCode" />
                <SortableHeader label="Executive" column="executive" />
                <SortableHeader label="Return Date" column="returnDate" />
                <SortableHeader label="Remarks" column="remarks" />
                <th className="py-3 px-3 font-semibold text-neutral-800 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 font-semibold text-neutral-800 text-center w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={11}>
                    Loading...
                  </td>
                </tr>
              ) : sortedReturns.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={11}>
                    No returns found
                  </td>
                </tr>
              ) : (
                sortedReturns.map((returnItem, index) => (
                  <tr key={returnItem._id} className="border-b hover:bg-neutral-50/80">
                    <td className="py-2.5 px-3 text-neutral-700">{index + 1}</td>
                    <td className="py-2.5 px-3 font-medium">
                      {returnItem.returnNumber ?? returnItem.returnId ?? '-'}
                    </td>
                    <td className="py-2.5 px-3">{returnItem.lrNumber || '-'}</td>
                    <td className="py-2.5 px-3">{returnItem.finYear || '-'}</td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate" title={resolveSchoolName(returnItem)}>
                      {resolveSchoolName(returnItem)}
                    </td>
                    <td className="py-2.5 px-3">{resolveSchoolCode(returnItem)}</td>
                    <td className="py-2.5 px-3">{returnItem.executiveName || '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {formatReturnDate(returnItem.returnDate)}
                    </td>
                    <td className="py-2.5 px-3 max-w-[160px] truncate" title={resolveRemarks(returnItem)}>
                      {resolveRemarks(returnItem)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                      {returnItem.status || returnItem.returnStatus || '-'}
                    </td>
                      <td className="py-2.5 px-3 text-center">
                      <Can permission="returns.warehouse.verify">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-amber-700 hover:bg-amber-50"
                          title={
                            canWarehouseEdit(returnItem)
                              ? 'Enter received qty and verify'
                              : 'View only (not Submitted)'
                          }
                          onClick={() => openReturnUpdate(returnItem)}
                        >
                          <NotebookPen className="w-5 h-5" />
                        </Button>
                      </Can>
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

