'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { ChevronRight, Loader2, AlertTriangle, Eye } from 'lucide-react'

type ReturnDetail = {
  _id: string
  returnId?: string
  returnNumber?: number
  status: string
  executiveName?: string
  customerName?: string
  schoolCode?: string
  returnDate?: string
  lrNumber?: string
  finYear?: string
  remarks?: string
  executiveRemarks?: string
  whReturnRemarks?: string
  managerRemarks?: string
  rejectionReason?: string
  returnValue?: number
  approvedReturnValue?: number
  verifiedBy?: { name?: string }
  approvedBy?: { name?: string }
  approvedAt?: string
  verifiedAt?: string
  createdBy?: { name?: string }
  dcOrderId?: { school_name?: string; school_code?: string }
  products?: Array<{
    product: string
    level?: string
    soldQty: number
    returnQty: number
    receivedQty?: number
    condition?: string
    reason?: string
    mismatchRemark?: string
    quantityMismatch?: boolean
    managerDecision?: string
    approvedQty?: number
    stockBucket?: string
    managerRemark?: string
  }>
}

function qtyDiff(field: number, wh: number) {
  if (field === wh) return null
  return wh - field
}

export default function AdminStockReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const data = await apiRequest<ReturnDetail>(`/stock-returns/admin/${id}`)
        setDetail(data)
      } catch (e: any) {
        toast({
          title: 'Error',
          description: e.message || 'Failed to load return',
          variant: 'destructive',
        })
        router.push('/dashboard/returns/employees')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  const lines = detail?.products || []

  const mismatchCount = useMemo(
    () =>
      lines.filter(
        (p) => qtyDiff(Number(p.returnQty) || 0, Number(p.receivedQty) || 0) !== null
      ).length,
    [lines]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading return…
      </div>
    )
  }

  if (!detail) return null

  const schoolName =
    (detail.dcOrderId && typeof detail.dcOrderId === 'object'
      ? detail.dcOrderId.school_name
      : null) ||
    detail.customerName ||
    '-'

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Stock Return Detail
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Return #{detail.returnNumber ?? detail.returnId} · {schoolName} ·{' '}
            <span className="font-medium text-foreground">{detail.status}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Field Executive: {detail.executiveName || detail.createdBy?.name || '—'} ·
            Warehouse Executive: {detail.verifiedBy?.name || '—'} · Manager:{' '}
            {detail.approvedBy?.name || '—'}
          </p>
        </div>
        <nav className="text-sm text-muted-foreground flex items-center gap-1 flex-wrap">
          <Link href="/dashboard" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/dashboard/returns/employees" className="hover:text-foreground">
            Employee Returns
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">Detail</span>
        </nav>
      </div>

      {detail.rejectionReason && (
        <Card className="p-4 border-red-200 bg-red-50">
          <h2 className="font-semibold text-red-900">Rejection reason</h2>
          <p className="text-red-800 mt-1 text-sm">{detail.rejectionReason}</p>
        </Card>
      )}

      {detail.managerRemarks && (
        <Card className="p-4 border-amber-200 bg-amber-50/80">
          <h2 className="font-semibold text-amber-900">Manager remarks</h2>
          <p className="text-amber-950 mt-1 text-sm">{detail.managerRemarks}</p>
          {detail.approvedBy?.name && (
            <p className="text-xs text-amber-800 mt-2">
              By {detail.approvedBy.name}
              {detail.approvedAt
                ? ` · ${new Date(detail.approvedAt).toLocaleString()}`
                : ''}
            </p>
          )}
        </Card>
      )}

      {mismatchCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            {mismatchCount} line(s) differ between Field Executive and Warehouse Executive
            quantities.
          </span>
        </div>
      )}

      <Card className="p-4">
        <h2 className="font-medium mb-3">Return summary</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">School</span>
            <p className="font-medium">{schoolName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">School code</span>
            <p className="font-medium">
              {detail.schoolCode || detail.dcOrderId?.school_code || '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">LR No / Fin year</span>
            <p className="font-medium">
              {detail.lrNumber || '—'} / {detail.finYear || '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Return date</span>
            <p className="font-medium">
              {detail.returnDate
                ? new Date(detail.returnDate).toLocaleDateString()
                : '—'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Return value</span>
            <p className="font-medium">
              ₹{Number(detail.returnValue || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Approved value</span>
            <p className="font-medium">
              ₹{Number(detail.approvedReturnValue || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">WH verified</span>
            <p className="font-medium">
              {detail.verifiedAt
                ? new Date(detail.verifiedAt).toLocaleString()
                : '—'}
            </p>
          </div>
        </div>
        {(detail.remarks || detail.executiveRemarks || detail.whReturnRemarks) && (
          <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm border-t pt-3">
            {detail.remarks && (
              <div>
                <span className="text-muted-foreground">Executive return remarks</span>
                <p>{detail.remarks}</p>
              </div>
            )}
            {detail.executiveRemarks && (
              <div>
                <span className="text-muted-foreground">Field exec notes</span>
                <p>{detail.executiveRemarks}</p>
              </div>
            )}
            {detail.whReturnRemarks && (
              <div>
                <span className="text-muted-foreground">Warehouse exec notes</span>
                <p>{detail.whReturnRemarks}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 overflow-hidden">
        <h2 className="font-medium mb-1">
          Field Executive vs Warehouse Executive vs Manager
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Full audit trail for Super Admin review
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-2 px-2 text-left" colSpan={2}>
                  Product
                </th>
                <th className="py-2 px-2 text-center border-l bg-blue-50" colSpan={2}>
                  Field Executive
                </th>
                <th className="py-2 px-2 text-center border-l bg-orange-50" colSpan={3}>
                  Warehouse Executive
                </th>
                <th className="py-2 px-2 text-center border-l bg-emerald-50" colSpan={4}>
                  Manager
                </th>
              </tr>
              <tr className="border-b text-xs">
                <th className="py-2 px-2 text-left">Product</th>
                <th className="py-2 px-2 text-left">Level</th>
                <th className="py-2 px-2 text-right border-l bg-blue-50/80">Return Qty</th>
                <th className="py-2 px-2 text-left bg-blue-50/80">Reason</th>
                <th className="py-2 px-2 text-right border-l bg-orange-50/80">Received</th>
                <th className="py-2 px-2 text-left bg-orange-50/80">Condition</th>
                <th className="py-2 px-2 text-left bg-orange-50/80">WH mismatch note</th>
                <th className="py-2 px-2 text-left border-l bg-emerald-50/80">Decision</th>
                <th className="py-2 px-2 text-right bg-emerald-50/80">Approved</th>
                <th className="py-2 px-2 text-left bg-emerald-50/80">Bucket</th>
                <th className="py-2 px-2 text-left bg-emerald-50/80">Line remark</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-6 text-center text-muted-foreground">
                    No product lines
                  </td>
                </tr>
              ) : (
                lines.map((p, idx) => {
                  const field = Number(p.returnQty) || 0
                  const wh = Number(p.receivedQty) || 0
                  const diff = qtyDiff(field, wh)
                  const mismatch = diff !== null && diff !== 0
                  return (
                    <tr
                      key={`${p.product}-${idx}`}
                      className={`border-b ${mismatch ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="py-2 px-2 font-medium">{p.product}</td>
                      <td className="py-2 px-2">{p.level || '—'}</td>
                      <td className="py-2 px-2 text-right border-l bg-blue-50/30 font-semibold">
                        {field}
                      </td>
                      <td className="py-2 px-2 text-xs bg-blue-50/30">{p.reason || '—'}</td>
                      <td className="py-2 px-2 text-right border-l bg-orange-50/30 font-semibold">
                        {wh}
                      </td>
                      <td className="py-2 px-2 text-xs bg-orange-50/30">
                        {p.condition || '—'}
                      </td>
                      <td className="py-2 px-2 text-xs bg-orange-50/30 text-amber-800">
                        {p.mismatchRemark || (mismatch ? `Diff ${diff}` : '—')}
                      </td>
                      <td className="py-2 px-2 border-l bg-emerald-50/30">
                        {p.managerDecision || '—'}
                      </td>
                      <td className="py-2 px-2 text-right bg-emerald-50/30">
                        {p.approvedQty ?? '—'}
                      </td>
                      <td className="py-2 px-2 bg-emerald-50/30">{p.stockBucket || '—'}</td>
                      <td className="py-2 px-2 text-xs bg-emerald-50/30">
                        {p.managerRemark || '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push('/dashboard/returns/employees')}
      >
        Back to list
      </Button>
    </div>
  )
}
