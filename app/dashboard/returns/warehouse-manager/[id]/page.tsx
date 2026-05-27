'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { ChevronRight, Loader2, AlertTriangle } from 'lucide-react'

type ProductLine = {
  id: string
  product: string
  productName: string
  soldQty: number
  fieldExecQty: number
  warehouseExecQty: number
  condition: string
  reason: string
  mismatchRemark: string
  managerDecision: string
  approvedQty: number
  stockBucket: string
  managerRemark: string
}

type ReturnDetail = {
  _id: string
  returnId: string
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
  verifiedBy?: { name?: string }
  approvedBy?: { name?: string }
  managerRemarks?: string
  rejectionReason?: string
  approvedAt?: string
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

const DECISION_OPTIONS = ['Approve', 'Partial Approve', 'Reject', 'Send Back']
const STOCK_BUCKETS = ['Sellable', 'Damaged', 'Expired', 'QC / Hold']

function canDecide(status: string) {
  return status === 'Received' || status === 'Pending Manager Approval'
}

function selectValue(v: string) {
  const t = (v || '').trim()
  return t.length > 0 ? t : undefined
}

function qtyDiff(field: number, wh: number) {
  if (field === wh) return null
  return wh - field
}

export default function WarehouseManagerReturnReviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [detail, setDetail] = useState<ReturnDetail | null>(null)
  const [lines, setLines] = useState<ProductLine[]>([])
  const [managerRemarks, setManagerRemarks] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')

  const readOnly = detail ? !canDecide(detail.status) : true

  const loadDetail = async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await apiRequest<ReturnDetail>(`/stock-returns/warehouse-manager/${id}`)
      setDetail(data)
      setManagerRemarks(data.managerRemarks || '')
      setRejectionReason(data.rejectionReason || '')
      setLines(
        (data.products || []).map((p, idx) => ({
          id: `line-${idx}`,
          product: p.product || '',
          productName: p.level || '',
          soldQty: Number(p.soldQty) || 0,
          fieldExecQty: Number(p.returnQty) || 0,
          warehouseExecQty: Number(p.receivedQty) || 0,
          condition: p.condition || '',
          reason: p.reason || '',
          mismatchRemark: p.mismatchRemark || '',
          managerDecision: p.managerDecision || '',
          approvedQty: Number(p.approvedQty) || 0,
          stockBucket: p.stockBucket || '',
          managerRemark: p.managerRemark || '',
        }))
      )
    } catch (e: any) {
      toast.error(e.message || 'Failed to load return')
      router.push('/dashboard/returns/warehouse-manager')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  const updateLine = (lineId: string, patch: Partial<ProductLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const next = { ...l, ...patch }
        if (patch.managerDecision === 'Approve') {
          next.approvedQty = next.warehouseExecQty
        }
        if (patch.managerDecision === 'Reject' || patch.managerDecision === 'Send Back') {
          next.approvedQty = 0
          next.stockBucket = ''
        }
        if (
          patch.approvedQty != null &&
          next.approvedQty > next.warehouseExecQty
        ) {
          toast.error('Approved qty cannot exceed warehouse received qty')
          return l
        }
        return next
      })
    )
  }

  const validateLines = (): boolean => {
    const withDecision = lines.filter((l) => l.managerDecision)
    if (withDecision.length === 0) {
      toast.error('Set a decision for at least one product line')
      return false
    }
    for (const l of withDecision) {
      if (l.managerDecision === 'Approve' || l.managerDecision === 'Partial Approve') {
        if (l.approvedQty <= 0) {
          toast.error(`Approved qty required for ${l.product}`)
          return false
        }
        if (!l.stockBucket) {
          toast.error(`Stock bucket required for ${l.product}`)
          return false
        }
        if (
          l.managerDecision === 'Partial Approve' &&
          !l.managerRemark.trim()
        ) {
          toast.error(`Remark required for partial approval on ${l.product}`)
          return false
        }
      }
      if (
        (l.managerDecision === 'Reject' || l.managerDecision === 'Send Back') &&
        !l.managerRemark.trim()
      ) {
        toast.error(`Remark required for ${l.product}`)
        return false
      }
    }
    return true
  }

  const buildProductPayload = () =>
    lines.map((l) => ({
      product: l.product,
      managerDecision: l.managerDecision,
      approvedQty: l.approvedQty,
      stockBucket: l.stockBucket,
      managerRemark: l.managerRemark,
    }))

  const runAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!detail) return
    setProcessing(true)
    try {
      await apiRequest(`/stock-returns/${detail._id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify({
          action,
          products: buildProductPayload(),
          managerRemarks,
          ...extra,
        }),
      })
      toast.success(
        action === 'approve'
          ? 'Return processed — stock updated where approved'
          : action === 'reject'
            ? 'Return rejected'
            : 'Return sent back to warehouse executive'
      )
      router.push('/dashboard/returns/warehouse-manager')
    } catch (e: any) {
      toast.error(e.message || 'Action failed')
    } finally {
      setProcessing(false)
    }
  }

  const handleApprove = () => {
    if (!validateLines()) return
    runAction('approve')
  }

  const handleRejectAll = () => {
    if (!rejectionReason.trim()) {
      toast.error('Enter rejection reason')
      return
    }
    runAction('reject', { rejectionReason })
  }

  const handleSendBack = () => {
    if (!validateLines()) return
    runAction('send_back')
  }

  const mismatchCount = useMemo(
    () => lines.filter((l) => qtyDiff(l.fieldExecQty, l.warehouseExecQty) !== null).length,
    [lines]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-neutral-600">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading return review…
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
    <div className="space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Return Review</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Return No. {detail.returnNumber ?? detail.returnId} · {schoolName}
            {readOnly && (
              <span className="ml-2 text-amber-700">({detail.status} — view only)</span>
            )}
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Field Executive: {detail.executiveName || '—'} · Warehouse Executive:{' '}
            {detail.verifiedBy?.name || '—'}
          </p>
        </div>
        <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
          <Link href="/dashboard" className="hover:text-neutral-800">
            Home
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link href="/dashboard/returns/warehouse-manager" className="hover:text-neutral-800">
            Stock
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-neutral-800">Return Review</span>
        </nav>
      </div>

      {mismatchCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            {mismatchCount} line(s) have different Field Executive vs Warehouse Executive
            quantities. Review carefully before approving.
          </span>
        </div>
      )}

      <Card className="p-4 border border-neutral-200">
        <h2 className="font-semibold text-neutral-900 mb-3">Return summary</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-neutral-500">School</span>
            <p className="font-medium">{schoolName}</p>
          </div>
          <div>
            <span className="text-neutral-500">School code</span>
            <p className="font-medium">{detail.schoolCode || detail.dcOrderId?.school_code || '—'}</p>
          </div>
          <div>
            <span className="text-neutral-500">LR No</span>
            <p className="font-medium">{detail.lrNumber || '—'}</p>
          </div>
          <div>
            <span className="text-neutral-500">Status</span>
            <p className="font-medium">{detail.status}</p>
          </div>
        </div>
        {(detail.executiveRemarks || detail.whReturnRemarks || detail.remarks) && (
          <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
            {detail.executiveRemarks && (
              <div>
                <span className="text-neutral-500">Field exec remarks</span>
                <p>{detail.executiveRemarks}</p>
              </div>
            )}
            {detail.whReturnRemarks && (
              <div>
                <span className="text-neutral-500">Warehouse exec remarks</span>
                <p>{detail.whReturnRemarks}</p>
              </div>
            )}
            {detail.remarks && (
              <div>
                <span className="text-neutral-500">Return remarks</span>
                <p>{detail.remarks}</p>
              </div>
            )}
          </div>
        )}
        {(detail.managerRemarks || detail.rejectionReason) && (
          <div className="mt-3 grid md:grid-cols-2 gap-3 text-sm">
            {detail.managerRemarks && (
              <div>
                <span className="text-neutral-500">Manager remarks</span>
                <p>{detail.managerRemarks}</p>
              </div>
            )}
            {detail.rejectionReason && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <span className="text-red-800 font-medium">Rejection reason</span>
                <p className="text-red-900 mt-1">{detail.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
        {detail.approvedBy?.name && (
          <p className="mt-2 text-xs text-neutral-500">
            Processed by {detail.approvedBy.name}
            {detail.approvedAt
              ? ` on ${new Date(detail.approvedAt).toLocaleString()}`
              : ''}
          </p>
        )}
      </Card>

      <Card className="p-4 border border-neutral-200 overflow-hidden">
        <h2 className="font-semibold text-neutral-900 mb-1">
          Compare quantities — Field Executive vs Warehouse Executive
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          Approve full or partial per line, or reject individual lines. Use Reject entire return
          to reject all.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-neutral-100 border-b">
                <th className="py-2 px-2 text-left" colSpan={3}>
                  Product
                </th>
                <th className="py-2 px-2 text-center border-l bg-blue-50" colSpan={3}>
                  Field Executive
                </th>
                <th className="py-2 px-2 text-center border-l bg-orange-50" colSpan={3}>
                  Warehouse Executive
                </th>
                <th className="py-2 px-2 text-center border-l bg-emerald-50" colSpan={4}>
                  Manager decision
                </th>
              </tr>
              <tr className="bg-neutral-50 border-b text-xs">
                <th className="py-2 px-2 text-left">Product</th>
                <th className="py-2 px-2 text-left">Name</th>
                <th className="py-2 px-2 text-right">Sold</th>
                <th className="py-2 px-2 text-right border-l bg-blue-50/80">Return Qty</th>
                <th className="py-2 px-2 text-left bg-blue-50/80">Reason</th>
                <th className="py-2 px-2 bg-blue-50/80" />
                <th className="py-2 px-2 text-right border-l bg-orange-50/80">Received Qty</th>
                <th className="py-2 px-2 text-left bg-orange-50/80">Condition</th>
                <th className="py-2 px-2 text-center bg-orange-50/80">Diff</th>
                <th className="py-2 px-2 text-left border-l bg-emerald-50/80">Decision</th>
                <th className="py-2 px-2 text-right bg-emerald-50/80">Approved Qty</th>
                <th className="py-2 px-2 text-left bg-emerald-50/80">Bucket</th>
                <th className="py-2 px-2 text-left bg-emerald-50/80">Remark</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-6 text-center text-neutral-500">
                    No product lines
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const diff = qtyDiff(line.fieldExecQty, line.warehouseExecQty)
                  const mismatch = diff !== null && diff !== 0
                  return (
                    <tr
                      key={line.id}
                      className={`border-b ${mismatch ? 'bg-amber-50/60' : ''}`}
                    >
                      <td className="py-2 px-2 font-medium">{line.product}</td>
                      <td className="py-2 px-2">{line.productName || '—'}</td>
                      <td className="py-2 px-2 text-right">{line.soldQty}</td>
                      <td className="py-2 px-2 text-right border-l bg-blue-50/30 font-semibold text-blue-900">
                        {line.fieldExecQty}
                      </td>
                      <td className="py-2 px-2 text-xs bg-blue-50/30">{line.reason}</td>
                      <td className="py-2 px-2 bg-blue-50/30" />
                      <td className="py-2 px-2 text-right border-l bg-orange-50/30 font-semibold text-orange-900">
                        {line.warehouseExecQty}
                      </td>
                      <td className="py-2 px-2 text-xs bg-orange-50/30">
                        {line.condition || '—'}
                      </td>
                      <td
                        className={`py-2 px-2 text-center text-xs font-medium bg-orange-50/30 ${
                          mismatch ? 'text-amber-700' : 'text-neutral-400'
                        }`}
                      >
                        {diff === null ? '—' : diff > 0 ? `+${diff}` : String(diff)}
                      </td>
                      <td className="py-2 px-2 border-l bg-emerald-50/30">
                        <Select
                          value={selectValue(line.managerDecision)}
                          onValueChange={(v) =>
                            updateLine(line.id, { managerDecision: v })
                          }
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
                            <SelectValue placeholder="Decision" />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            {DECISION_OPTIONS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 bg-emerald-50/30">
                        <Input
                          type="number"
                          min={0}
                          max={line.warehouseExecQty}
                          value={line.approvedQty}
                          onChange={(e) =>
                            updateLine(line.id, {
                              approvedQty: Number(e.target.value) || 0,
                            })
                          }
                          disabled={
                            readOnly ||
                            !line.managerDecision ||
                            line.managerDecision === 'Reject' ||
                            line.managerDecision === 'Send Back'
                          }
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-2 px-2 bg-emerald-50/30">
                        <Select
                          value={selectValue(line.stockBucket)}
                          onValueChange={(v) => updateLine(line.id, { stockBucket: v })}
                          disabled={
                            readOnly ||
                            line.managerDecision === 'Reject' ||
                            line.managerDecision === 'Send Back'
                          }
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue placeholder="Bucket" />
                          </SelectTrigger>
                          <SelectContent className="z-[200]">
                            {STOCK_BUCKETS.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2 bg-emerald-50/30">
                        <Input
                          value={line.managerRemark}
                          onChange={(e) =>
                            updateLine(line.id, { managerRemark: e.target.value })
                          }
                          placeholder="Remark"
                          disabled={readOnly}
                          className="h-8 min-w-[120px]"
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4 border border-neutral-200 space-y-4">
        <div>
          <Label>Manager remarks</Label>
          <Textarea
            value={managerRemarks}
            onChange={(e) => setManagerRemarks(e.target.value)}
            rows={2}
            readOnly={readOnly}
            className={readOnly ? 'bg-neutral-50 mt-1' : 'mt-1'}
          />
        </div>
        {readOnly && detail.rejectionReason ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <Label className="text-red-800">Rejection reason</Label>
            <p className="text-red-900 mt-1 text-sm">{detail.rejectionReason}</p>
          </div>
        ) : !readOnly ? (
          <div>
            <Label>Rejection reason (for reject entire return)</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={2}
              placeholder="Required only when rejecting the full return"
              className="mt-1"
            />
          </div>
        ) : null}
      </Card>

      <div className="sticky bottom-0 bg-white border border-neutral-200 rounded-lg shadow-sm px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/dashboard/returns/warehouse-manager')}
        >
          Back to list
        </Button>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSendBack}
              disabled={processing}
            >
              Send back to WH Exec
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRejectAll}
              disabled={processing}
            >
              Reject entire return
            </Button>
            <Button type="button" onClick={handleApprove} disabled={processing}>
              {processing ? 'Processing…' : 'Approve (full / partial)'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
