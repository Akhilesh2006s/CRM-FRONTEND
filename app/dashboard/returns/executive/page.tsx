'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useProducts } from '@/hooks/useProducts'
import { toast } from 'sonner'
import { PlusCircle, X, Upload, Eye } from 'lucide-react'

type StockReturn = {
  _id: string
  returnId: string
  saleId?: string
  dcOrderId?: string
  returnType: string
  returnQty: number
  returnStatus: string
  createdAt: string
  updatedAt: string
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
  }>
  evidencePhotos?: string[]
  executiveRemarks?: string
  totalItems?: number
  totalQuantity?: number
  returnValue?: number
}

type DcOrder = {
  _id: string
  dc_code?: string
  school_name?: string
  products?: Array<{
    product_name: string
    quantity: number
    unit_price?: number
  }>
  status?: string
}

type ProductRow = {
  id: string
  product: string
  soldQty: number
  returnQty: number
  reason: string
  remarks: string
}

export default function ExecutiveStockReturnsPage() {
  const [returns, setReturns] = useState<StockReturn[]>([])
  const [loading, setLoading] = useState(false)
  const [addReturnDialogOpen, setAddReturnDialogOpen] = useState(false)
  const [viewReturnDialogOpen, setViewReturnDialogOpen] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null)
  const [dcOrders, setDcOrders] = useState<DcOrder[]>([])
  const [warehouses, setWarehouses] = useState<string[]>([])
  
  // Form state
  const [returnId, setReturnId] = useState('')
  const [executiveName, setExecutiveName] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [saleId, setSaleId] = useState('')
  const [dcOrderId, setDcOrderId] = useState('')
  const [warehouse, setWarehouse] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnType, setReturnType] = useState('')
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  const [evidencePhotos, setEvidencePhotos] = useState<File[]>([])
  const [evidencePhotoUrls, setEvidencePhotoUrls] = useState<string[]>([])
  const [executiveRemarks, setExecutiveRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  
  const user = useMemo(() => getCurrentUser(), [])
  const { productNames: availableProducts } = useProducts()

  useEffect(() => {
    if (user?._id) {
      setExecutiveName(user.name || '')
    }
  }, [user])

  useEffect(() => {
    loadReturns()
    loadDcOrders()
    loadWarehouses()
  }, [user?._id])

  const loadReturns = async () => {
    if (!user?._id) return
    setLoading(true)
    try {
      const response = await apiRequest<any>(`/stock-returns/executive/list`)
      const returnsList = Array.isArray(response) ? response : (response?.data || [])
      setReturns(returnsList)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load returns')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const loadDcOrders = async () => {
    if (!user?._id) return
    try {
      const response = await apiRequest<any>(`/dc-orders?employee=${user._id}&status=completed`)
      const orders = Array.isArray(response) ? response : (response?.data || [])
      setDcOrders(orders)
    } catch (e: any) {
      console.error('Failed to load DC orders:', e)
      setDcOrders([])
    }
  }

  const loadWarehouses = async () => {
    try {
      // Load warehouses from API or use default list
      const response = await apiRequest<any>(`/warehouses`)
      const warehouseList = Array.isArray(response) ? response : (response?.data || [])
      setWarehouses(warehouseList.map((w: any) => w.name || w))
    } catch (e: any) {
      // Default warehouses if API fails
      setWarehouses(['Main Warehouse', 'North Warehouse', 'South Warehouse', 'East Warehouse', 'West Warehouse'])
    }
  }

  const generateReturnId = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    return `RET-${timestamp}-${random}`
  }

  const openAddReturnDialog = () => {
    const newReturnId = generateReturnId()
    setReturnId(newReturnId)
    setReturnDate(new Date().toISOString().split('T')[0])
    setReturnType('')
    setProductRows([])
    setEvidencePhotos([])
    setEvidencePhotoUrls([])
    setExecutiveRemarks('')
    setSaleId('')
    setDcOrderId('')
    setCustomerName('')
    setWarehouse('')
    setAddReturnDialogOpen(true)
  }

  const handleDcOrderChange = (orderId: string) => {
    setDcOrderId(orderId)
    const order = dcOrders.find(o => o._id === orderId)
    if (order) {
      setCustomerName(order.school_name || '')
      setSaleId(order.dc_code || order._id)
      // Pre-populate products from DC order
      if (order.products && Array.isArray(order.products)) {
        const rows: ProductRow[] = order.products.map((p, idx) => ({
          id: `product-${idx}`,
          product: p.product_name || '',
          soldQty: p.quantity || 0,
          returnQty: 0,
          reason: '',
          remarks: '',
        }))
        setProductRows(rows)
      }
    }
  }

  const addProductRow = () => {
    const newRow: ProductRow = {
      id: `product-${Date.now()}`,
      product: '',
      soldQty: 0,
      returnQty: 0,
      reason: '',
      remarks: '',
    }
    setProductRows([...productRows, newRow])
  }

  const removeProductRow = (id: string) => {
    setProductRows(productRows.filter(r => r.id !== id))
  }

  const updateProductRow = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows(productRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        // Validate returnQty <= soldQty
        if (field === 'returnQty' && updated.returnQty > updated.soldQty) {
          toast.error('Return quantity cannot exceed sold quantity')
          return row
        }
        return updated
      }
      return row
    }))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setEvidencePhotoUrls([...evidencePhotoUrls, ...urls])
      setEvidencePhotos([...evidencePhotos, ...Array.from(files)])
      toast.success('Photos uploaded successfully')
    } catch (e: any) {
      toast.error('Failed to upload photos: ' + (e.message || 'Unknown error'))
    } finally {
      setUploadingPhotos(false)
    }
  }

  const removePhoto = (index: number) => {
    setEvidencePhotoUrls(evidencePhotoUrls.filter((_, i) => i !== index))
    setEvidencePhotos(evidencePhotos.filter((_, i) => i !== index))
  }

  const validateForm = (): boolean => {
    if (!returnDate) {
      toast.error('Please select Return Date')
      return false
    }
    if (!returnType) {
      toast.error('Please select Return Type')
      return false
    }
    if (productRows.length === 0) {
      toast.error('Please add at least one product')
      return false
    }
    for (const row of productRows) {
      if (!row.product) {
        toast.error('Please select product for all rows')
        return false
      }
      if (row.returnQty <= 0) {
        toast.error('Return quantity must be greater than 0')
        return false
      }
      if (!row.reason) {
        toast.error('Please provide reason for all products')
        return false
      }
      if (row.returnQty > row.soldQty) {
        toast.error('Return quantity cannot exceed sold quantity')
        return false
      }
    }
    if ((returnType === 'Damaged' || returnType === 'Expired') && evidencePhotoUrls.length === 0) {
      toast.error('Photo evidence is mandatory for Damaged or Expired returns')
      return false
    }
    return true
  }

  const saveDraft = async () => {
    if (!validateForm()) return
    
    setSaving(true)
    try {
      const totalItems = productRows.length
      const totalQuantity = productRows.reduce((sum, r) => sum + r.returnQty, 0)
      
      const payload = {
        returnId,
        executiveId: user?._id,
        executiveName,
        customerName,
        saleId,
        dcOrderId,
        warehouse,
        returnDate,
        returnType,
        products: productRows,
        evidencePhotos: evidencePhotoUrls,
        executiveRemarks,
        totalItems,
        totalQuantity,
        status: 'Draft',
      }

      await apiRequest(`/stock-returns/executive`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast.success('Return saved as draft successfully')
      setAddReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const submitReturn = async () => {
    if (!validateForm()) return
    
    setSaving(true)
    try {
      const totalItems = productRows.length
      const totalQuantity = productRows.reduce((sum, r) => sum + r.returnQty, 0)
      
      const payload = {
        returnId,
        executiveId: user?._id,
        executiveName,
        customerName,
        saleId,
        dcOrderId,
        warehouse,
        returnDate,
        returnType,
        products: productRows,
        evidencePhotos: evidencePhotoUrls,
        executiveRemarks,
        totalItems,
        totalQuantity,
        status: 'Submitted',
      }

      await apiRequest(`/stock-returns/executive`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      toast.success('Return submitted successfully')
      setAddReturnDialogOpen(false)
      loadReturns()
    } catch (e: any) {
      toast.error(e.message || 'Failed to submit return')
    } finally {
      setSaving(false)
    }
  }

  const openViewReturnDialog = (returnItem: StockReturn) => {
    setSelectedReturn(returnItem)
    setViewReturnDialogOpen(true)
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800'
      case 'Submitted': return 'bg-blue-100 text-blue-800'
      case 'Received by Warehouse': return 'bg-yellow-100 text-yellow-800'
      case 'Under Review': return 'bg-purple-100 text-purple-800'
      case 'Approved': return 'bg-green-100 text-green-800'
      case 'Rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const returnTypes = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement']
  const returnReasons = ['Damaged', 'Expired', 'Excess', 'Wrong item', 'Replacement', 'Customer request', 'Quality issue', 'Other']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Stock Returns</h1>
          <p className="text-sm text-neutral-600 mt-1">Manage stock returns for your sales</p>
        </div>
        <Button onClick={openAddReturnDialog}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Return
        </Button>
      </div>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-3 px-4 font-semibold">Return ID</th>
                <th className="py-3 px-4 font-semibold">Sale ID</th>
                <th className="py-3 px-4 font-semibold">Return Type</th>
                <th className="py-3 px-4 font-semibold">Return Qty</th>
                <th className="py-3 px-4 font-semibold">Return Status</th>
                <th className="py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={6}>
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={6}>
                    No returns found
                  </td>
                </tr>
              ) : (
                returns.map((returnItem) => (
                  <tr key={returnItem._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 px-4">{returnItem.returnId}</td>
                    <td className="py-3 px-4">{returnItem.saleId || returnItem.dcOrderId || '-'}</td>
                    <td className="py-3 px-4">{returnItem.returnType}</td>
                    <td className="py-3 px-4">{returnItem.returnQty || returnItem.totalQuantity || 0}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(returnItem.returnStatus)}`}>
                        {returnItem.returnStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openViewReturnDialog(returnItem)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Return Dialog */}
      <Dialog open={addReturnDialogOpen} onOpenChange={setAddReturnDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Stock Return</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new stock return request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 1. Basic Return Information */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-lg font-semibold">Basic Return Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Return ID *</Label>
                  <Input value={returnId} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Executive Name *</Label>
                  <Input value={executiveName} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Customer / Outlet *</Label>
                  <Input 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>
                <div>
                  <Label>Sale ID / DC Order *</Label>
                  <Select value={dcOrderId} onValueChange={handleDcOrderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Sale/DC Order" />
                    </SelectTrigger>
                    <SelectContent>
                      {dcOrders.map((order) => (
                        <SelectItem key={order._id} value={order._id}>
                          {order.dc_code || order._id} - {order.school_name || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Warehouse *</Label>
                  <Select value={warehouse} onValueChange={setWarehouse}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh} value={wh}>
                          {wh}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Return Date *</Label>
                  <Input 
                    type="date" 
                    value={returnDate} 
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Return Type *</Label>
                  <Select value={returnType} onValueChange={setReturnType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select return type" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* 2. Product Selection */}
            <div className="space-y-4 border-b pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Product Selection</h3>
                <Button type="button" variant="outline" size="sm" onClick={addProductRow}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Product
                </Button>
              </div>
              
              {productRows.length === 0 ? (
                <p className="text-sm text-neutral-500 p-4 bg-neutral-50 rounded text-center">
                  No products added. Click "Add Product" to add products.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border">
                    <thead>
                      <tr className="bg-neutral-100">
                        <th className="py-2 px-3 text-left">Product</th>
                        <th className="py-2 px-3 text-left">Sold Qty</th>
                        <th className="py-2 px-3 text-left">Return Qty</th>
                        <th className="py-2 px-3 text-left">Reason</th>
                        <th className="py-2 px-3 text-left">Remarks</th>
                        <th className="py-2 px-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="py-2 px-3">
                            <Select
                              value={row.product}
                              onValueChange={(value) => {
                                updateProductRow(row.id, 'product', value)
                                // Auto-fill soldQty from DC order if available
                                if (dcOrderId) {
                                  const order = dcOrders.find(o => o._id === dcOrderId)
                                  const orderProduct = order?.products?.find(p => (p.product_name || '') === value)
                                  if (orderProduct) {
                                    updateProductRow(row.id, 'soldQty', orderProduct.quantity || 0)
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProducts.map((product) => (
                                  <SelectItem key={product} value={product}>
                                    {product}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              value={row.soldQty === 0 ? '' : row.soldQty}
                              onChange={(e) => {
                                const raw = e.target.value
                                const cleaned = raw.replace(/^0+(?=\d)/, '')
                                updateProductRow(
                                  row.id,
                                  'soldQty',
                                  cleaned === '' ? 0 : Number(cleaned)
                                )
                              }}
                              className="w-24"
                              min="0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              value={row.returnQty}
                              onChange={(e) => updateProductRow(row.id, 'returnQty', Number(e.target.value))}
                              className="w-24"
                              min="0"
                              max={row.soldQty}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Select
                              value={row.reason}
                              onValueChange={(value) => updateProductRow(row.id, 'reason', value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent>
                                {returnReasons.map((reason) => (
                                  <SelectItem key={reason} value={reason}>
                                    {reason}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={row.remarks}
                              onChange={(e) => updateProductRow(row.id, 'remarks', e.target.value)}
                              placeholder="Optional remarks"
                              className="w-40"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductRow(row.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 3. Evidence & Remarks */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-lg font-semibold">
                Evidence & Remarks
                {(returnType === 'Damaged' || returnType === 'Expired') && (
                  <span className="text-red-600 ml-2">*</span>
                )}
              </h3>
              <div>
                <Label>Photo Upload</Label>
                <div className="mt-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhotos}
                  />
                  {uploadingPhotos && <p className="text-sm text-neutral-500 mt-1">Uploading...</p>}
                </div>
                {evidencePhotoUrls.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {evidencePhotoUrls.map((url, idx) => (
                      <div key={idx} className="relative">
                        <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute top-0 right-0"
                          onClick={() => removePhoto(idx)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Executive Remarks</Label>
                <Textarea
                  value={executiveRemarks}
                  onChange={(e) => setExecutiveRemarks(e.target.value)}
                  placeholder="Enter remarks about the return"
                  rows={3}
                />
              </div>
            </div>

            {/* 4. Summary */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-lg font-semibold">Summary</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Total Items Returned</Label>
                  <Input value={productRows.length} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Total Quantity</Label>
                  <Input 
                    value={productRows.reduce((sum, r) => sum + r.returnQty, 0)} 
                    readOnly 
                    className="bg-neutral-50" 
                  />
                </div>
              </div>
            </div>

            {/* 5. Status & Tracking */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Status & Tracking</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Current Status</Label>
                  <Input value="Draft" readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Next Action</Label>
                  <Input value="Submit Return Request" readOnly className="bg-neutral-50" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddReturnDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={saveDraft} disabled={saving}>
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button onClick={submitReturn} disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Return Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Return Dialog */}
      <Dialog open={viewReturnDialogOpen} onOpenChange={setViewReturnDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Stock Return</DialogTitle>
            <DialogDescription>
              Return details (read-only)
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-4 py-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Return ID</Label>
                  <Input value={selectedReturn.returnId} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Sale ID</Label>
                  <Input value={selectedReturn.saleId || selectedReturn.dcOrderId || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Return Type</Label>
                  <Input value={selectedReturn.returnType} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Return Status</Label>
                  <Input value={selectedReturn.returnStatus} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Executive Name</Label>
                  <Input value={selectedReturn.executiveName || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Customer Name</Label>
                  <Input value={selectedReturn.customerName || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Return Date</Label>
                  <Input value={selectedReturn.returnDate ? new Date(selectedReturn.returnDate).toLocaleDateString() : '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Total Quantity</Label>
                  <Input value={selectedReturn.returnQty || selectedReturn.totalQuantity || 0} readOnly className="bg-neutral-50" />
                </div>
              </div>

              {selectedReturn.products && selectedReturn.products.length > 0 && (
                <div>
                  <Label>Products</Label>
                  <div className="mt-2 overflow-x-auto">
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
                        {selectedReturn.products.map((p, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="py-2 px-3">{p.product}</td>
                            <td className="py-2 px-3">{p.soldQty}</td>
                            <td className="py-2 px-3">{p.returnQty}</td>
                            <td className="py-2 px-3">{p.reason}</td>
                            <td className="py-2 px-3">{p.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedReturn.executiveRemarks && (
                <div>
                  <Label>Executive Remarks</Label>
                  <Textarea value={selectedReturn.executiveRemarks} readOnly className="bg-neutral-50" rows={3} />
                </div>
              )}

              {selectedReturn.evidencePhotos && selectedReturn.evidencePhotos.length > 0 && (
                <div>
                  <Label>Evidence Photos</Label>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {selectedReturn.evidencePhotos.map((url, idx) => (
                      <img key={idx} src={url} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Created At</Label>
                  <Input value={new Date(selectedReturn.createdAt).toLocaleString()} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Updated At</Label>
                  <Input value={new Date(selectedReturn.updatedAt).toLocaleString()} readOnly className="bg-neutral-50" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setViewReturnDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
