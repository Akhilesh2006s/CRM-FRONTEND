'use client'

import { useEffect, useState } from 'react'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Eye, CheckCircle2, XCircle, RotateCcw, Package, AlertTriangle, CheckCircle, X } from 'lucide-react'

type StockReturn = {
  _id: string
  returnId: string
  saleId?: string
  dcOrderId?: string
  returnType: string
  totalQuantity?: number
  totalReceivedQty?: number
  status: string
  createdAt: string
  updatedAt: string
  executiveId?: string
  executiveName?: string
  customerName?: string
  warehouse?: string
  returnDate?: string
  verifiedBy?: {
    _id: string
    name: string
  }
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
    managerDecision?: string
    approvedQty?: number
    stockBucket?: string
    managerRemark?: string
  }>
  evidencePhotos?: string[]
  warehousePhotos?: string[]
  executiveRemarks?: string
  managerRemarks?: string
  rejectionReason?: string
}

type ProductDecisionRow = {
  id: string
  product: string
  soldQty: number
  returnQty: number
  receivedQty: number
  condition: string
  reason: string
  remarks?: string
  mismatchRemark?: string
  managerDecision: string
  approvedQty: number
  stockBucket: string
  managerRemark: string
  quantityMismatch: boolean
}

export default function WarehouseManagerStockReturnsPage() {
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [viewReturnDialogOpen, setViewReturnDialogOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null)
  const [productDecisionRows, setProductDecisionRows] = useState<ProductDecisionRow[]>([])
  const [managerRemarks, setManagerRemarks] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState(false)
  
  const user = getCurrentUser()

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      // Load returns that are in "Received" or "Pending Manager Approval" status
      const response = await apiRequest<any>(`/stock-returns/executive/list`)
      const returnsList = Array.isArray(response) ? response : (response?.data || [])
      // Filter to show only returns awaiting manager approval
      const pendingReturns = returnsList.filter((r: any) => 
        r.status === 'Received' || r.status === 'Pending Manager Approval'
      )
      setReturns(pendingReturns)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load returns')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const openReturnDialog = (returnItem: StockReturn) => {
    setSelectedReturn(returnItem)
    setManagerRemarks(returnItem.managerRemarks || '')
    setRejectionReason(returnItem.rejectionReason || '')
    
    // Initialize product decision rows
    if (returnItem.products && Array.isArray(returnItem.products)) {
      const decisionRows: ProductDecisionRow[] = returnItem.products.map((p, idx) => ({
        id: `product-${idx}`,
        product: p.product,
        soldQty: p.soldQty,
        returnQty: p.returnQty,
        receivedQty: p.receivedQty || 0,
        condition: p.condition || '',
        reason: p.reason,
        remarks: p.remarks || '',
        mismatchRemark: p.mismatchRemark || '',
        managerDecision: p.managerDecision || '',
        approvedQty: p.approvedQty || 0,
        stockBucket: p.stockBucket || '',
        managerRemark: p.managerRemark || '',
        quantityMismatch: p.quantityMismatch || false,
      }))
      setProductDecisionRows(decisionRows)
    } else {
      setProductDecisionRows([])
    }
    
    setViewReturnDialogOpen(true)
  }

  const updateProductDecision = (id: string, field: keyof ProductDecisionRow, value: any) => {
    setProductDecisionRows(productDecisionRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        
        // Reset approvedQty and stockBucket if decision is Reject or Send Back
        if (field === 'managerDecision') {
          if (value === 'Reject' || value === 'Send Back') {
            updated.approvedQty = 0
            updated.stockBucket = ''
          } else if (value === 'Approve') {
            // Auto-set approvedQty to receivedQty for full approval
            updated.approvedQty = updated.receivedQty
          }
        }
        
        // Validate approvedQty doesn't exceed receivedQty
        if (field === 'approvedQty' && value > updated.receivedQty) {
          toast.error('Approved quantity cannot exceed received quantity')
          return row
        }
        
        return updated
      }
      return row
    }))
  }

  const getConditionSummary = (products: StockReturn['products']) => {
    if (!products || products.length === 0) return 'N/A'
    const conditions = products.map(p => p.condition).filter(Boolean)
    if (conditions.length === 0) return 'N/A'
    const counts: Record<string, number> = {}
    conditions.forEach(c => {
      counts[c!] = (counts[c!] || 0) + 1
    })
    return Object.entries(counts).map(([c, n]) => `${c} (${n})`).join(', ')
  }

  const hasFlags = (returnItem: StockReturn) => {
    const hasMismatch = returnItem.products?.some(p => p.quantityMismatch)
    const hasDamage = returnItem.products?.some(p => p.condition === 'Damaged')
    const hasExpired = returnItem.products?.some(p => p.condition === 'Expired')
    return { hasMismatch, hasDamage, hasExpired }
  }

  const calculateStockImpact = () => {
    let totalApprovedQty = 0
    let sellableQty = 0
    let damagedQty = 0
    let expiredQty = 0
    
    productDecisionRows.forEach(row => {
      if (row.managerDecision === 'Approve' || row.managerDecision === 'Partial Approve') {
        totalApprovedQty += row.approvedQty
        if (row.stockBucket === 'Sellable') sellableQty += row.approvedQty
        else if (row.stockBucket === 'Damaged') damagedQty += row.approvedQty
        else if (row.stockBucket === 'Expired') expiredQty += row.approvedQty
      }
    })
    
    return { totalApprovedQty, sellableQty, damagedQty, expiredQty }
  }

  const validateDecisions = (): { valid: boolean; message?: string } => {
    // Check if at least one product has a decision
    const hasDecisions = productDecisionRows.some(r => r.managerDecision)
    if (!hasDecisions) {
      return { valid: false, message: 'Please make a decision for at least one product' }
    }
    
    // Check if all products with decisions have required fields
    for (const row of productDecisionRows) {
      if (row.managerDecision) {
        if (row.managerDecision === 'Approve' || row.managerDecision === 'Partial Approve') {
          if (row.approvedQty <= 0) {
            return { valid: false, message: `Approved quantity must be greater than 0 for ${row.product}` }
          }
          if (!row.stockBucket) {
            return { valid: false, message: `Stock bucket is required for ${row.product}` }
          }
          if (!row.managerRemark && (row.managerDecision === 'Partial Approve' || row.approvedQty !== row.receivedQty)) {
            return { valid: false, message: `Reason is required for ${row.product} (partial approval or quantity override)` }
          }
        } else if (row.managerDecision === 'Reject' || row.managerDecision === 'Send Back') {
          if (!row.managerRemark) {
            return { valid: false, message: `Reason is required for ${row.product}` }
          }
        }
      }
    }
    
    return { valid: true }
  }

  const handleApprove = async () => {
    const validation = validateDecisions()
    if (!validation.valid) {
      toast.error(validation.message || 'Validation failed')
      return
    }
    
    setProcessing(true)
    try {
      const payload = {
        action: 'approve',
        products: productDecisionRows.map(row => ({
          product: row.product,
          managerDecision: row.managerDecision,
          approvedQty: row.approvedQty,
          stockBucket: row.stockBucket,
          managerRemark: row.managerRemark,
        })),
        managerRemarks: managerRemarks,
      }

      await apiRequest(`/stock-returns/${selectedReturn?._id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Return approved successfully. Stock will be updated.')
      setViewReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to approve return')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Rejection reason is required')
      return
    }
    
    setProcessing(true)
    try {
      const payload = {
        action: 'reject',
        rejectionReason: rejectionReason,
        managerRemarks: managerRemarks,
      }

      await apiRequest(`/stock-returns/${selectedReturn?._id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Return rejected')
      setViewReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject return')
    } finally {
      setProcessing(false)
    }
  }

  const handleSendBack = async () => {
    const validation = validateDecisions()
    if (!validation.valid) {
      toast.error(validation.message || 'Validation failed')
      return
    }
    
    setProcessing(true)
    try {
      const payload = {
        action: 'send_back',
        products: productDecisionRows.map(row => ({
          product: row.product,
          managerRemark: row.managerRemark,
        })),
        managerRemarks: managerRemarks,
      }

      await apiRequest(`/stock-returns/${selectedReturn?._id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Return sent back for re-verification')
      setViewReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to send back return')
    } finally {
      setProcessing(false)
    }
  }

  const handleVendorReturn = async () => {
    const validation = validateDecisions()
    if (!validation.valid) {
      toast.error(validation.message || 'Validation failed')
      return
    }
    
    setProcessing(true)
    try {
      const payload = {
        action: 'vendor_return',
        products: productDecisionRows.map(row => ({
          product: row.product,
          managerDecision: row.managerDecision,
          approvedQty: row.approvedQty,
          stockBucket: row.stockBucket,
          managerRemark: row.managerRemark,
        })),
        managerRemarks: managerRemarks,
      }

      await apiRequest(`/stock-returns/${selectedReturn?._id}/manager-action`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('Return marked for vendor return')
      setViewReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to mark for vendor return')
    } finally {
      setProcessing(false)
    }
  }

  const stockBuckets = ['Sellable', 'Damaged', 'Expired', 'QC / Hold']
  const decisionOptions = ['Approve', 'Partial Approve', 'Reject', 'Send Back']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Stock Returns - Manager Review</h1>
        <p className="text-sm text-neutral-600 mt-1">Review and approve executive stock return requests</p>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 px-4 font-semibold">Return ID</th>
                <th className="py-3 px-4 font-semibold">Return Status</th>
                <th className="py-3 px-4 font-semibold">Warehouse Exec</th>
                <th className="py-3 px-4 font-semibold">Sales Exec</th>
                <th className="py-3 px-4 font-semibold">Expected Qty vs Received Qty</th>
                <th className="py-3 px-4 font-semibold">Condition Summary</th>
                <th className="py-3 px-4 font-semibold">Flags</th>
                <th className="py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={8}>
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={8}>
                    No returns pending approval
                  </td>
                </tr>
              ) : (
                returns.map((returnItem) => {
                  const flags = hasFlags(returnItem)
                  const expectedQty = returnItem.totalQuantity || 0
                  const receivedQty = returnItem.totalReceivedQty || 0
                  
                  return (
                    <tr key={returnItem._id} className="border-b hover:bg-neutral-50">
                      <td className="py-3 px-4">{returnItem.returnId}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          returnItem.status === 'Pending Manager Approval' ? 'bg-yellow-100 text-yellow-800' :
                          returnItem.status === 'Received' ? 'bg-blue-100 text-blue-800' :
                          'bg-neutral-100 text-neutral-800'
                        }`}>
                          {returnItem.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{returnItem.verifiedBy?.name || '-'}</td>
                      <td className="py-3 px-4">{returnItem.executiveName || '-'}</td>
                      <td className="py-3 px-4">
                        {expectedQty} / {receivedQty}
                        {expectedQty !== receivedQty && (
                          <span className="text-yellow-600 ml-1">⚠️</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getConditionSummary(returnItem.products)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {flags.hasMismatch && <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">Mismatch</span>}
                          {flags.hasDamage && <span className="text-xs bg-red-100 text-red-800 px-1 rounded">Damage</span>}
                          {flags.hasExpired && <span className="text-xs bg-orange-100 text-orange-800 px-1 rounded">Expired</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReturnDialog(returnItem)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Open
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Review Return Dialog */}
      <Dialog open={viewReturnDialogOpen} onOpenChange={setViewReturnDialogOpen}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Return - {selectedReturn?.returnId}</DialogTitle>
            <DialogDescription>
              Review return details and make approval decisions
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6 py-4">
              {/* Read-only Return Information */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Return Information (Read-only)</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Return ID</Label>
                    <Input value={selectedReturn.returnId} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Customer</Label>
                    <Input value={selectedReturn.customerName || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Invoice / Sale ID</Label>
                    <Input value={selectedReturn.saleId || selectedReturn.dcOrderId || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Sales Executive</Label>
                    <Input value={selectedReturn.executiveName || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Warehouse Executive</Label>
                    <Input value={selectedReturn.verifiedBy?.name || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Return Type</Label>
                    <Input value={selectedReturn.returnType || '-'} readOnly className="bg-neutral-50" />
                  </div>
                </div>
              </div>

              {/* Executive Remarks - Read-only */}
              {selectedReturn.executiveRemarks && (
                <div className="border-b pb-4">
                  <Label>Executive Remarks</Label>
                  <Textarea value={selectedReturn.executiveRemarks} readOnly className="bg-neutral-50" rows={3} />
                </div>
              )}

              {/* Photos - Read-only */}
              {(selectedReturn.evidencePhotos && selectedReturn.evidencePhotos.length > 0) || 
               (selectedReturn.warehousePhotos && selectedReturn.warehousePhotos.length > 0) ? (
                <div className="border-b pb-4">
                  <Label>Photos</Label>
                  {selectedReturn.evidencePhotos && selectedReturn.evidencePhotos.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 mb-2">Executive Uploaded:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedReturn.evidencePhotos.map((url, idx) => (
                          <img key={idx} src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedReturn.warehousePhotos && selectedReturn.warehousePhotos.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-neutral-600 mb-2">Warehouse Verification:</p>
                      <div className="grid grid-cols-4 gap-2">
                        {selectedReturn.warehousePhotos.map((url, idx) => (
                          <img key={idx} src={url} alt={`Warehouse ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Product Decision Table */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Product Decisions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-neutral-100">
                        <th className="py-2 px-3 text-left">Product</th>
                        <th className="py-2 px-3 text-left">Sold Qty</th>
                        <th className="py-2 px-3 text-left">Return Qty</th>
                        <th className="py-2 px-3 text-left">Received Qty</th>
                        <th className="py-2 px-3 text-left">Condition</th>
                        <th className="py-2 px-3 text-left">Decision *</th>
                        <th className="py-2 px-3 text-left">Approved Qty</th>
                        <th className="py-2 px-3 text-left">Stock Bucket</th>
                        <th className="py-2 px-3 text-left">Manager Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDecisionRows.map((row) => (
                        <tr key={row.id} className={`border-b ${row.quantityMismatch ? 'bg-yellow-50' : ''}`}>
                          <td className="py-2 px-3">{row.product}</td>
                          <td className="py-2 px-3">{row.soldQty}</td>
                          <td className="py-2 px-3">{row.returnQty}</td>
                          <td className="py-2 px-3">{row.receivedQty}</td>
                          <td className="py-2 px-3">{row.condition}</td>
                          <td className="py-2 px-3">
                            <Select
                              value={row.managerDecision}
                              onValueChange={(value) => updateProductDecision(row.id, 'managerDecision', value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {decisionOptions.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            {(row.managerDecision === 'Approve' || row.managerDecision === 'Partial Approve') ? (
                              <Input
                                type="number"
                                value={row.approvedQty}
                                onChange={(e) => updateProductDecision(row.id, 'approvedQty', Number(e.target.value))}
                                className="w-20"
                                min="0"
                                max={row.receivedQty}
                              />
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {(row.managerDecision === 'Approve' || row.managerDecision === 'Partial Approve') ? (
                              <Select
                                value={row.stockBucket}
                                onValueChange={(value) => updateProductDecision(row.id, 'stockBucket', value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {stockBuckets.map((bucket) => (
                                    <SelectItem key={bucket} value={bucket}>
                                      {bucket}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Textarea
                              value={row.managerRemark}
                              onChange={(e) => updateProductDecision(row.id, 'managerRemark', e.target.value)}
                              placeholder="Reason (required for partial/reject/send back)"
                              className="w-48"
                              rows={2}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial & Inventory Impact */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Financial & Inventory Impact (Read-only)</h3>
                {(() => {
                  const impact = calculateStockImpact()
                  return (
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <Label>Total Approved Qty</Label>
                        <Input value={impact.totalApprovedQty} readOnly className="bg-neutral-50" />
                      </div>
                      <div>
                        <Label>Sellable Stock</Label>
                        <Input value={impact.sellableQty} readOnly className="bg-neutral-50" />
                      </div>
                      <div>
                        <Label>Damaged Stock</Label>
                        <Input value={impact.damagedQty} readOnly className="bg-neutral-50" />
                      </div>
                      <div>
                        <Label>Expired Stock</Label>
                        <Input value={impact.expiredQty} readOnly className="bg-neutral-50" />
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Manager Remarks */}
              <div className="space-y-4 border-b pb-4">
                <Label>Manager Remarks</Label>
                <Textarea
                  value={managerRemarks}
                  onChange={(e) => setManagerRemarks(e.target.value)}
                  placeholder="Additional remarks or notes"
                  rows={3}
                />
              </div>

              {/* Rejection Reason (for reject action) */}
              <div className="space-y-4">
                <Label>Rejection Reason (Required for Reject)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection"
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setViewReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSendBack} disabled={processing}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Send Back
            </Button>
            <Button variant="outline" onClick={handleVendorReturn} disabled={processing}>
              <Package className="w-4 h-4 mr-2" />
              Vendor Return
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approve Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


