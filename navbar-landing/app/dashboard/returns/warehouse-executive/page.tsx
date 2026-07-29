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
import { Can } from '@/components/permissions/Can'
import { Eye, X, Upload, CheckCircle2 } from 'lucide-react'

type StockReturn = {
  _id: string
  returnId: string
  saleId?: string
  dcOrderId?: string
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

type ProductVerificationRow = {
  id: string
  product: string
  soldQty: number
  returnQty: number
  reason: string
  remarks?: string
  receivedQty: number
  condition: string
  batchLot: string
  storageLocation: string
  quantityMismatch: boolean
  mismatchRemark: string
}

function normalizeQty(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function isQuantityMismatch(returnQty: unknown, receivedQty: unknown): boolean {
  const expected = normalizeQty(returnQty)
  const received = normalizeQty(receivedQty)
  if (Number.isNaN(expected) || Number.isNaN(received)) return false
  return expected > 0 && received !== expected
}

function resolveInitialReceivedQty(
  returnQty: unknown,
  receivedQty: unknown,
  condition?: string
): number {
  const expected = normalizeQty(returnQty)
  const received = normalizeQty(receivedQty)
  const hasPriorVerification =
    Boolean(condition?.trim()) ||
    (Number.isFinite(received) && receivedQty != null && receivedQty !== '' && received > 0)

  if (hasPriorVerification && Number.isFinite(received)) {
    return received
  }

  return Number.isFinite(expected) ? expected : 0
}

function canVerifyReturn(status: string): boolean {
  return status === 'Submitted' || status === 'Sent Back'
}

export default function WarehouseExecutiveStockReturnsPage() {
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [viewReturnDialogOpen, setViewReturnDialogOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null)
  const [productVerificationRows, setProductVerificationRows] = useState<ProductVerificationRow[]>([])
  const [warehousePhotos, setWarehousePhotos] = useState<File[]>([])
  const [warehousePhotoUrls, setWarehousePhotoUrls] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const user = getCurrentUser()

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    setLoading(true)
    try {
      const response = await apiRequest<any>(`/stock-returns/warehouse-executive/queue`)
      const returnsList = Array.isArray(response) ? response : (response?.data || [])
      setReturns(returnsList)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load returns')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const openReturnDialog = (returnItem: StockReturn) => {
    setSelectedReturn(returnItem)
    
    // Initialize product verification rows from return products
    if (returnItem.products && Array.isArray(returnItem.products)) {
      const verificationRows: ProductVerificationRow[] = returnItem.products.map((p, idx) => {
        const receivedQty = resolveInitialReceivedQty(p.returnQty, p.receivedQty, p.condition)
        const mismatch = isQuantityMismatch(p.returnQty, receivedQty)
        return {
          id: `product-${idx}`,
          product: p.product,
          soldQty: p.soldQty,
          returnQty: p.returnQty,
          reason: p.reason,
          remarks: p.remarks || '',
          receivedQty,
          condition: p.condition || '',
          batchLot: p.batchLot || '',
          storageLocation: p.storageLocation || '',
          quantityMismatch: mismatch,
          mismatchRemark: mismatch ? (p.mismatchRemark || '') : '',
        }
      })
      setProductVerificationRows(verificationRows)
    } else {
      setProductVerificationRows([])
    }
    
    // Initialize warehouse photos
    setWarehousePhotoUrls(returnItem.warehousePhotos || [])
    setWarehousePhotos([])
    
    setViewReturnDialogOpen(true)
  }

  const updateProductVerification = (id: string, field: keyof ProductVerificationRow, value: any) => {
    setProductVerificationRows(productVerificationRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        
        if (field === 'receivedQty') {
          const mismatch = isQuantityMismatch(updated.returnQty, updated.receivedQty)
          updated.quantityMismatch = mismatch
          if (!mismatch) {
            updated.mismatchRemark = ''
          }
        }
        
        return updated
      }
      return row
    }))
  }

  const handleWarehousePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingPhotos(true)
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('photo', file)
        
        const response = await fetch(`${API_BASE_URL}/api/stock-returns/upload-photo`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: formData,
        })
        
        if (!response.ok) throw new Error('Upload failed')
        const data = await response.json()
        return data.url || data.photoUrl
      })

      const urls = await Promise.all(uploadPromises)
      setWarehousePhotoUrls([...warehousePhotoUrls, ...urls])
      setWarehousePhotos([...warehousePhotos, ...Array.from(files)])
      toast.success('Photos uploaded successfully')
    } catch (e: any) {
      toast.error('Failed to upload photos: ' + (e.message || 'Unknown error'))
    } finally {
      setUploadingPhotos(false)
    }
  }

  const removeWarehousePhoto = (index: number) => {
    setWarehousePhotoUrls(warehousePhotoUrls.filter((_, i) => i !== index))
    setWarehousePhotos(warehousePhotos.filter((_, i) => i !== index))
  }

  const validateVerification = (): boolean => {
    for (const row of productVerificationRows) {
      const receivedQty = normalizeQty(row.receivedQty)
      if (Number.isNaN(receivedQty) || receivedQty < 0) {
        toast.error(`Please enter a valid received quantity for ${row.product}`)
        return false
      }
      if (!row.condition) {
        toast.error(`Please select condition for ${row.product}`)
        return false
      }
      if (isQuantityMismatch(row.returnQty, receivedQty) && !row.mismatchRemark?.trim()) {
        toast.error(`Please provide remark for quantity mismatch in ${row.product}`)
        return false
      }
    }
    return true
  }

  const submitToManager = async () => {
    if (!selectedReturn) return
    
    if (!validateVerification()) return
    
    setSubmitting(true)
    try {
      const totalReceivedQty = productVerificationRows.reduce(
        (sum, r) => sum + (normalizeQty(r.receivedQty) || 0),
        0
      )
      const hasMismatch = productVerificationRows.some((r) =>
        isQuantityMismatch(r.returnQty, r.receivedQty)
      )

      const payload = {
        returnId: selectedReturn.returnId,
        products: productVerificationRows.map((row) => {
          const receivedQty = normalizeQty(row.receivedQty) || 0
          const mismatch = isQuantityMismatch(row.returnQty, receivedQty)
          return {
            product: row.product,
            soldQty: row.soldQty,
            returnQty: row.returnQty,
            reason: row.reason,
            remarks: row.remarks,
            receivedQty,
            condition: row.condition,
            batchLot: row.batchLot,
            storageLocation: row.storageLocation,
            quantityMismatch: mismatch,
            mismatchRemark: mismatch ? (row.mismatchRemark || '').trim() : '',
          }
        }),
        warehousePhotos: warehousePhotoUrls,
        totalReceivedQty,
        verifiedBy: user?._id,
        verifiedAt: new Date().toISOString(),
        submittedToManagerAt: new Date().toISOString(),
      }

      await apiRequest(`/stock-returns/${selectedReturn._id}/warehouse-verify`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success(
        hasMismatch
          ? 'Return submitted for manager review (quantity mismatch)'
          : 'Return submitted to Warehouse Manager successfully'
      )
      setViewReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit to manager')
    } finally {
      setSubmitting(false)
    }
  }

  const conditionOptions = ['Sellable', 'Damaged', 'Expired', 'Missing', 'Short received']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Stock Returns</h1>
        <p className="text-sm text-neutral-600 mt-1">Verify and process executive return requests</p>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 px-4 font-semibold">Return ID</th>
                <th className="py-3 px-4 font-semibold">Customer</th>
                <th className="py-3 px-4 font-semibold">Executive Name</th>
                <th className="py-3 px-4 font-semibold">Expected Qty</th>
                <th className="py-3 px-4 font-semibold">Return Type</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={7}>
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={7}>
                    No return requests found
                  </td>
                </tr>
              ) : (
                returns.map((returnItem) => (
                  <tr key={returnItem._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 px-4">{returnItem.returnId}</td>
                    <td className="py-3 px-4">{returnItem.customerName || '-'}</td>
                    <td className="py-3 px-4">{returnItem.executiveName || '-'}</td>
                    <td className="py-3 px-4">{returnItem.totalQuantity || returnItem.returnQty || 0}</td>
                    <td className="py-3 px-4">{returnItem.returnType || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        returnItem.status === 'Sent Back'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {returnItem.status}
                      </span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View and Verify Return Dialog */}
      <Dialog open={viewReturnDialogOpen} onOpenChange={setViewReturnDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Verify Return - {selectedReturn?.returnId}</DialogTitle>
            <DialogDescription>
              View return details and enter physical verification data
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-6 py-4">
              {/* Read-only Return Information */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Return Information (Read-only)</h3>
                <div className="grid md:grid-cols-2 gap-4">
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
                    <Label>Executive Name</Label>
                    <Input value={selectedReturn.executiveName || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Return Type</Label>
                    <Input value={selectedReturn.returnType || '-'} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Return Date</Label>
                    <Input 
                      value={selectedReturn.returnDate ? new Date(selectedReturn.returnDate).toLocaleDateString() : '-'} 
                      readOnly 
                      className="bg-neutral-50" 
                    />
                  </div>
                </div>
              </div>

              {/* Products - Read-only */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Products Requested (Read-only)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-neutral-100">
                        <th className="py-2 px-3 text-left">Product</th>
                        <th className="py-2 px-3 text-left">Sold Qty</th>
                        <th className="py-2 px-3 text-left">Return Qty</th>
                        <th className="py-2 px-3 text-left">Reason</th>
                        <th className="py-2 px-3 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.products && selectedReturn.products.length > 0 ? (
                        selectedReturn.products.map((p, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-3">{p.product}</td>
                            <td className="py-2 px-3">{p.soldQty}</td>
                            <td className="py-2 px-3">{p.returnQty}</td>
                            <td className="py-2 px-3">{p.reason}</td>
                            <td className="py-2 px-3">{p.remarks || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-4 text-center text-neutral-500" colSpan={5}>
                            No products found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Executive Remarks - Read-only */}
              {selectedReturn.executiveRemarks && (
                <div className="border-b pb-4">
                  <Label>Executive Remarks</Label>
                  <Textarea value={selectedReturn.executiveRemarks} readOnly className="bg-neutral-50" rows={3} />
                </div>
              )}

              {/* Executive Uploaded Photos - Read-only */}
              {selectedReturn.evidencePhotos && selectedReturn.evidencePhotos.length > 0 && (
                <div className="border-b pb-4">
                  <Label>Executive Uploaded Photos</Label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {selectedReturn.evidencePhotos.map((url, idx) => (
                      <img key={idx} src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                    ))}
                  </div>
                </div>
              )}

              {/* Physical Verification Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Physical Verification</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-neutral-100">
                        <th className="py-2 px-3 text-left">Product</th>
                        <th className="py-2 px-3 text-left">Expected Qty</th>
                        <th className="py-2 px-3 text-left">Received Qty *</th>
                        <th className="py-2 px-3 text-left">Condition *</th>
                        <th className="py-2 px-3 text-left">Batch / Lot</th>
                        <th className="py-2 px-3 text-left">Storage Location</th>
                        <th className="py-2 px-3 text-left">Mismatch Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productVerificationRows.map((row) => {
                        const hasMismatch = isQuantityMismatch(row.returnQty, row.receivedQty)
                        return (
                          <tr key={row.id} className={`border-b ${hasMismatch ? 'bg-yellow-50' : ''}`}>
                            <td className="py-2 px-3">{row.product}</td>
                            <td className="py-2 px-3">{row.returnQty}</td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                value={row.receivedQty}
                                onChange={(e) => updateProductVerification(row.id, 'receivedQty', Number(e.target.value))}
                                className="w-24"
                                min="0"
                              />
                              {hasMismatch && (
                                <span className="text-xs text-yellow-600 block mt-1">⚠️ Mismatch</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Select
                                value={row.condition}
                                onValueChange={(value) => updateProductVerification(row.id, 'condition', value)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                                <SelectContent>
                                  {conditionOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                value={row.batchLot}
                                onChange={(e) => updateProductVerification(row.id, 'batchLot', e.target.value)}
                                placeholder="Batch/Lot number"
                                className="w-32"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                value={row.storageLocation}
                                onChange={(e) => updateProductVerification(row.id, 'storageLocation', e.target.value)}
                                placeholder="Storage location"
                                className="w-32"
                              />
                            </td>
                            <td className="py-2 px-3">
                              {hasMismatch ? (
                                <Textarea
                                  value={row.mismatchRemark}
                                  onChange={(e) => updateProductVerification(row.id, 'mismatchRemark', e.target.value)}
                                  placeholder="Mandatory remark for mismatch"
                                  className="w-48"
                                  rows={2}
                                />
                              ) : (
                                <span className="text-neutral-400 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warehouse Evidence Photos */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-lg font-semibold">Evidence Upload (Optional)</h3>
                <div>
                  <Label>Upload Photos</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleWarehousePhotoUpload}
                      disabled={uploadingPhotos}
                    />
                    {uploadingPhotos && <p className="text-sm text-neutral-500 mt-1">Uploading...</p>}
                  </div>
                  {warehousePhotoUrls.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {warehousePhotoUrls.map((url, idx) => (
                        <div key={idx} className="relative">
                          <img src={url} alt={`Warehouse Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute top-0 right-0"
                            onClick={() => removeWarehousePhoto(idx)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Summary</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label>Total Items</Label>
                    <Input value={productVerificationRows.length} readOnly className="bg-neutral-50" />
                  </div>
                  <div>
                    <Label>Total Expected Quantity</Label>
                    <Input 
                      value={productVerificationRows.reduce((sum, r) => sum + r.returnQty, 0)} 
                      readOnly 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Total Received Quantity</Label>
                    <Input 
                      value={productVerificationRows.reduce((sum, r) => sum + (normalizeQty(r.receivedQty) || 0), 0)} 
                      readOnly 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Has Quantity Mismatch</Label>
                    <Input 
                      value={productVerificationRows.some((r) => isQuantityMismatch(r.returnQty, r.receivedQty)) ? 'Yes - Requires Manager Review' : 'No'} 
                      readOnly 
                      className={`bg-neutral-50 ${productVerificationRows.some((r) => isQuantityMismatch(r.returnQty, r.receivedQty)) ? 'text-yellow-600 font-semibold' : ''}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Can permission="returns.warehouse.verify">
              <Button
                onClick={submitToManager}
                disabled={submitting || !selectedReturn || !canVerifyReturn(selectedReturn.status)}
              >
                {submitting ? 'Submitting...' : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Submit to Warehouse Manager
                  </>
                )}
              </Button>
            </Can>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

