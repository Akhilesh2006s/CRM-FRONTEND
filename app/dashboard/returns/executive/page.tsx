'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
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
    class?: string
    level?: string
    subject?: string
    soldQty: number
    returnQty: number
    unitPrice?: number
    lineTotal?: number
    reason: string
    remarks?: string
  }>
  evidencePhotos?: string[]
  executiveRemarks?: string
  lrNumber?: string
  lrDate?: string
  finYear?: string
  schoolCode?: string
  schoolType?: string
  transport?: string
  town?: string
  address?: string
  zone?: string
  cluster?: string
  contactPerson?: string
  contactMobile?: string
  remarks?: string
  totalItems?: number
  totalQuantity?: number
  returnValue?: number
  approvedReturnValue?: number
}

const MAIN_WAREHOUSE = 'Main Warehouse'

function defaultFinYear(d = new Date()): string {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  if (m >= 4) return `${y}-${String(y + 1).slice(-2)}`
  return `${y - 1}-${String(y).slice(-2)}`
}

function mergeDcOrderDetail(base: DcOrder, full: DcOrder): DcOrder {
  return {
    ...base,
    dc_code: full.dc_code || base.dc_code,
    school_name: full.school_name || base.school_name,
    school_code: full.school_code || base.school_code,
    school_type: full.school_type || base.school_type,
    contact_person: full.contact_person || base.contact_person,
    contact_mobile: full.contact_mobile || base.contact_mobile,
    address: full.address || base.address,
    zone: full.zone || base.zone,
    location: full.location || base.location,
    city: full.city || base.city,
    area: full.area || base.area,
    cluster_code: full.cluster_code || base.cluster_code,
    transport_name: full.transport_name || base.transport_name,
    year: (full as DcOrder & { year?: string }).year,
    products: mapDcOrderProducts(full.products as DcOrder['products']).length
      ? mapDcOrderProducts(full.products as DcOrder['products'])
      : base.products,
  }
}

type DcOrder = {
  _id: string
  dc_code?: string
  school_name?: string
  school_code?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  address?: string
  zone?: string
  location?: string
  city?: string
  area?: string
  cluster_code?: string
  transport_name?: string
  year?: string
  products?: Array<{
    product_name: string
    class?: string
    level?: string
    subject?: string
    quantity: number
    unit_price?: number
  }>
  status?: string
}

type ProductRow = {
  id: string
  product: string
  class: string
  level: string
  subject: string
  soldQty: number
  returnQty: number
  unitPrice: number
  reason: string
  remarks: string
}

/** Radix Select breaks on empty string; use undefined for "no selection". */
function selectValueOrUndefined(value: string | undefined | null): string | undefined {
  const v = (value || '').trim()
  return v.length > 0 ? v : undefined
}

const SELECT_IN_DIALOG_CLASS = 'z-[200]'

function mapDcOrderProducts(
  products: Array<{
    product_name?: string
    name?: string
    class?: string
    level?: string
    subject?: string
    quantity?: number
    unit_price?: number
  }> | undefined
): DcOrder['products'] {
  if (!Array.isArray(products)) return []
  return products.map((p) => ({
    product_name: (p.product_name || p.name || '').trim(),
    class: String(p.class || '').trim(),
    level: String(p.level || '').trim(),
    subject: String(p.subject || '').trim(),
    quantity: Number(p.quantity) || 0,
    unit_price: p.unit_price,
  }))
}

function productsFromEmployeeDc(dc: {
  productDetails?: Array<{
    product?: string
    product_name?: string
    class?: string
    level?: string
    subject?: string
    requestedQuantity?: number
    quantity?: number
    price?: number
  }>
  dcOrderId?: { products?: DcOrder['products']; school_name?: string; dc_code?: string } | string
}): DcOrder['products'] {
  const order =
    dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId : null
  const fromOrder = mapDcOrderProducts(order?.products as DcOrder['products'])
  if (fromOrder.length > 0) return fromOrder
  const details = Array.isArray(dc.productDetails) ? dc.productDetails : []
  return details.map((p) => ({
    product_name: (p.product || p.product_name || '').trim(),
    class: String(p.class || '').trim(),
    level: String(p.level || '').trim(),
    subject: String(p.subject || '').trim(),
    quantity: Number(p.requestedQuantity ?? p.quantity) || 0,
    unit_price: Number(p.price) || 0,
  }))
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
  const [lrNumber, setLrNumber] = useState('')
  const [lrDate, setLrDate] = useState('')
  const [finYear, setFinYear] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [transport, setTransport] = useState('')
  const [town, setTown] = useState('')
  const [address, setAddress] = useState('')
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [returnRemarks, setReturnRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  
  const user = useMemo(() => getCurrentUser(), [])
  const { productNames: availableProducts } = useProducts()

  const productSuggestions = useMemo(() => {
    const names = new Set<string>(availableProducts)
    const order = dcOrders.find((o) => o._id === dcOrderId)
    order?.products?.forEach((p) => {
      const n = (p.product_name || '').trim()
      if (n) names.add(n)
    })
    productRows.forEach((r) => {
      const n = r.product.trim()
      if (n) names.add(n)
    })
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [availableProducts, dcOrders, dcOrderId, productRows])

  useEffect(() => {
    if (user?._id) {
      setExecutiveName(user.name || '')
    }
  }, [user])

  useEffect(() => {
    if (!user?._id) return
    loadReturns()
  }, [user?._id])

  const loadReturns = async () => {
    if (!user?._id) return
    setLoading(true)
    try {
      const response = await apiRequest<any>(`/stock-returns/executive/mine`)
      const returnsList = Array.isArray(response) ? response : (response?.data || [])
      setReturns(
        returnsList.map((r: any) => ({
          ...r,
          returnStatus: r.status || r.returnStatus || 'Submitted',
        }))
      )
    } catch (e: any) {
      toast.error(e.message || 'Failed to load returns')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }

  const loadDcOrders = async () => {
    try {
      const byId = new Map<string, DcOrder>()

      // Same completed-DC source as Super Admin → Warehouse → Completed DC
      // (`app/dashboard/warehouse/completed-dc/page.tsx` uses `/dc/completed`,
      // with fallback `/dc?status=completed`). No employee filter / limit.
      let dcModelData: any[] = []
      try {
        const response = await apiRequest<any>(`/dc/completed`)
        if (Array.isArray(response)) {
          dcModelData = response
        } else if (response?.data && Array.isArray(response.data)) {
          dcModelData = response.data
        } else {
          dcModelData = []
        }
      } catch {
        try {
          const fallbackResponse = await apiRequest<any>(`/dc?status=completed`)
          if (Array.isArray(fallbackResponse)) {
            dcModelData = fallbackResponse
          } else if (fallbackResponse?.data && Array.isArray(fallbackResponse.data)) {
            dcModelData = fallbackResponse.data
          } else {
            dcModelData = []
          }
        } catch {
          dcModelData = []
        }
      }

      for (const dc of dcModelData) {
        const orderRef = dc.dcOrderId
        const orderId =
          typeof orderRef === 'object' && orderRef?._id
            ? String(orderRef._id)
            : orderRef
              ? String(orderRef)
              : ''
        if (!orderId) continue
        const populated = typeof orderRef === 'object' ? orderRef : null
        const existing = byId.get(orderId)
        byId.set(orderId, {
          _id: orderId,
          dc_code: populated?.dc_code || existing?.dc_code || dc.saleId || '',
          school_name:
            populated?.school_name || existing?.school_name || dc.customerName || '',
          school_code: populated?.school_code || existing?.school_code,
          school_type: populated?.school_type || existing?.school_type,
          contact_person: populated?.contact_person || existing?.contact_person,
          contact_mobile: populated?.contact_mobile || existing?.contact_mobile,
          address: populated?.address || existing?.address,
          zone: populated?.zone || existing?.zone,
          location: populated?.location || existing?.location,
          city: populated?.city || existing?.city,
          area: populated?.area || existing?.area,
          cluster_code: populated?.cluster_code || existing?.cluster_code,
          transport_name: populated?.transport_name || existing?.transport_name,
          products: productsFromEmployeeDc(dc).length
            ? productsFromEmployeeDc(dc)
            : existing?.products || [],
          status: 'completed',
        })
      }

      setDcOrders(Array.from(byId.values()))
    } catch (e: any) {
      console.error('Failed to load DC orders:', e)
      setDcOrders([])
    }
  }

  const loadWarehouses = async () => {
    setWarehouses([MAIN_WAREHOUSE])
  }

  const generateReturnId = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    return `RET-${timestamp}-${random}`
  }

  const openAddReturnDialog = async () => {
    const newReturnId = generateReturnId()
    setReturnId(newReturnId)
    setReturnDate(new Date().toISOString().split('T')[0])
    setReturnType('')
    setProductRows([])
    setEvidencePhotos([])
    setEvidencePhotoUrls([])
    setExecutiveRemarks('')
    setLrNumber('')
    setLrDate('')
    setFinYear(defaultFinYear())
    setSchoolCode('')
    setSchoolType('')
    setTransport('')
    setTown('')
    setAddress('')
    setZone('')
    setCluster('')
    setContactPerson('')
    setContactMobile('')
    setReturnRemarks('')
    setSaleId('')
    setDcOrderId('')
    setCustomerName('')
    setWarehouse(MAIN_WAREHOUSE)
    setAddReturnDialogOpen(true)
    await Promise.all([loadDcOrders(), loadWarehouses()])
  }

  const applyDcOrderToForm = (order: DcOrder) => {
    setCustomerName(order.school_name || '')
    setSaleId(order.dc_code || order._id)
    setSchoolCode(order.school_code || '')
    setSchoolType(order.school_type || '')
    setContactPerson(order.contact_person || '')
    setContactMobile(order.contact_mobile || '')
    setAddress(order.address || '')
    setZone(order.zone || '')
    setTown(order.location || order.city || order.area || '')
    setCluster(order.cluster_code || '')
    setTransport(order.transport_name || '')
    if (order.year?.trim()) setFinYear(order.year.trim())
    else setFinYear(defaultFinYear())
    const products = order.products && order.products.length > 0 ? order.products : []
    if (products.length > 0) {
      setProductRows(
        products.map((p, idx) => ({
          id: `product-${idx}`,
          product: p.product_name || '',
          class: p.class || '',
          level: p.level || '',
          subject: p.subject || '',
          soldQty: p.quantity || 0,
          returnQty: 0,
          unitPrice: Number(p.unit_price) || 0,
          reason: '',
          remarks: '',
        }))
      )
    } else {
      setProductRows([])
      toast.info('No products on this DC — use Add Product to enter return lines.')
    }
  }

  const handleDcOrderChange = async (orderId: string) => {
    setDcOrderId(orderId)
    let order = dcOrders.find((o) => o._id === orderId)
    if (!order) return

    try {
      const full = await apiRequest<DcOrder>(`/dc-orders/${orderId}`)
      order = mergeDcOrderDetail(order, full)
      setDcOrders((prev) => prev.map((o) => (o._id === orderId ? order! : o)))
    } catch (e: any) {
      toast.error(e.message || 'Could not load DC details')
    }
    applyDcOrderToForm(order)
  }

  const addProductRow = () => {
    const newRow: ProductRow = {
      id: `product-${Date.now()}`,
      product: '',
      class: '',
      level: '',
      subject: '',
      soldQty: 0,
      returnQty: 0,
      unitPrice: 0,
      reason: '',
      remarks: '',
    }
    setProductRows([...productRows, newRow])
  }

  const removeProductRow = (id: string) => {
    setProductRows(productRows.filter(r => r.id !== id))
  }

  const fillLineFromDcProduct = (rowId: string, productName: string) => {
    if (!dcOrderId || !productName.trim()) return
    const order = dcOrders.find((o) => o._id === dcOrderId)
    const orderProduct = order?.products?.find(
      (p) => (p.product_name || '').trim() === productName.trim()
    )
    if (!orderProduct) return
    setProductRows((rows) =>
      rows.map((row) => {
        if (row.id !== rowId) return row
        const soldQty = orderProduct.quantity || 0
        const returnQty = row.returnQty > soldQty ? soldQty : row.returnQty
        return {
          ...row,
          soldQty,
          returnQty,
          unitPrice: Number(orderProduct.unit_price) || 0,
          class: String(orderProduct.class || ''),
          level: String(orderProduct.level || ''),
          subject: String(orderProduct.subject || ''),
        }
      })
    )
  }

  const updateProductRow = (id: string, field: keyof ProductRow, value: any) => {
    setProductRows(productRows.map(row => {
      if (row.id === id) {
        const updated = { ...row, [field]: value }
        if (field === 'returnQty' && updated.returnQty > updated.soldQty) {
          toast.error('Return quantity cannot exceed sold quantity')
          return row
        }
        if (field === 'soldQty' && updated.returnQty > updated.soldQty) {
          updated.returnQty = updated.soldQty
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
        const raw = data.url || data.photoUrl || ''
        return resolveUploadUrl(raw) || raw
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

  const validateForm = (forSubmit = false): boolean => {
    if (!dcOrderId) {
      toast.error('Please select a completed Sale / DC Order')
      return false
    }
    if (!warehouse) {
      toast.error('Please select a warehouse')
      return false
    }
    if (!customerName.trim()) {
      toast.error('Please enter customer / outlet name')
      return false
    }
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
    // Only products with Return Qty > 0 are being returned; ignore 0 / empty.
    const returningRows = productRows.filter((row) => Number(row.returnQty) > 0)
    if (forSubmit && returningRows.length === 0) {
      toast.error('Please enter a return quantity for at least one product.')
      return false
    }
    for (const row of returningRows) {
      if (!row.product) {
        toast.error('Please select product for returned rows')
        return false
      }
      if (!row.reason) {
        toast.error(`Please provide a reason for ${row.product}`)
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
    if (forSubmit) {
      if (!lrNumber.trim()) {
        toast.error('Please enter LR No from the delivery partner')
        return false
      }
      if (!lrDate || !String(lrDate).trim()) {
        toast.error('Please select LR Date')
        return false
      }
      if (!finYear.trim()) {
        toast.error('Please enter Fin Year')
        return false
      }
    }
    return true
  }

  const mapProductsForApi = (rows: ProductRow[], onlyReturning = true) => {
    const source = onlyReturning ? rows.filter((row) => Number(row.returnQty) > 0) : rows
    return source.map((row) => ({
      product: row.product,
      class: row.class,
      level: row.level,
      subject: row.subject,
      soldQty: row.soldQty,
      returnQty: row.returnQty,
      unitPrice: row.unitPrice,
      reason: row.reason,
      remarks: row.remarks,
    }))
  }

  const buildReturnPayload = (status: 'Draft' | 'Submitted') => {
    const onlyReturning = status === 'Submitted'
    const mapped = mapProductsForApi(productRows, onlyReturning)
    const totalItems = mapped.length
    const totalQuantity = mapped.reduce((sum, r) => sum + r.returnQty, 0)
    return {
      returnId,
      executiveId: user?._id,
      executiveName,
      customerName,
      saleId,
      dcOrderId,
      warehouse,
      returnDate,
      returnType,
      lrNumber: lrNumber.trim(),
      lrDate: lrDate.trim() || undefined,
      finYear: finYear.trim(),
      schoolType: schoolType.trim(),
      schoolCode: schoolCode.trim(),
      transport: transport.trim(),
      town: town.trim(),
      address: address.trim(),
      zone: zone.trim(),
      cluster: cluster.trim(),
      contactPerson: contactPerson.trim(),
      contactMobile: contactMobile.trim(),
      remarks: returnRemarks.trim(),
      products: mapped,
      evidencePhotos: evidencePhotoUrls,
      executiveRemarks,
      totalItems,
      totalQuantity,
      status,
    }
  }

  const saveDraft = async () => {
    if (!validateForm(false)) return
    
    setSaving(true)
    try {
      const payload = buildReturnPayload('Draft')

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
    if (!validateForm(true)) return
    
    setSaving(true)
    try {
      const payload = buildReturnPayload('Submitted')

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
                <th className="py-3 px-4 font-semibold">LR No</th>
                <th className="py-3 px-4 font-semibold">Fin Year</th>
                <th className="py-3 px-4 font-semibold">School</th>
                <th className="py-3 px-4 font-semibold">School Code</th>
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
                  <td className="py-8 text-center text-neutral-500" colSpan={10}>
                    Loading...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-neutral-500" colSpan={10}>
                    No returns found
                  </td>
                </tr>
              ) : (
                returns.map((returnItem) => (
                  <tr key={returnItem._id} className="border-b hover:bg-neutral-50">
                    <td className="py-3 px-4">{returnItem.returnId}</td>
                    <td className="py-3 px-4">{returnItem.lrNumber || '-'}</td>
                    <td className="py-3 px-4">{returnItem.finYear || '-'}</td>
                    <td className="py-3 px-4">{returnItem.customerName || '-'}</td>
                    <td className="py-3 px-4">{returnItem.schoolCode || '-'}</td>
                    <td className="py-3 px-4">
                      {typeof returnItem.saleId === 'string' && returnItem.saleId
                        ? returnItem.saleId
                        : returnItem.dcOrderId &&
                            typeof returnItem.dcOrderId === 'object'
                          ? (returnItem.dcOrderId as { dc_code?: string }).dc_code || '-'
                          : typeof returnItem.dcOrderId === 'string'
                            ? returnItem.dcOrderId
                            : '-'}
                    </td>
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
                  <Select
                    value={selectValueOrUndefined(dcOrderId)}
                    onValueChange={handleDcOrderChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Sale/DC Order" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_IN_DIALOG_CLASS}>
                      {dcOrders.map((order) => (
                        <SelectItem key={order._id} value={order._id}>
                          {order.dc_code || order._id} - {order.school_name || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {dcOrders.length === 0 && (
                    <p className="text-xs text-amber-700 mt-1">
                      No completed DCs found. Complete warehouse delivery on Client Request first.
                    </p>
                  )}
                </div>
                <div>
                  <Label>Warehouse *</Label>
                  <Select
                    value={selectValueOrUndefined(warehouse)}
                    onValueChange={setWarehouse}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_IN_DIALOG_CLASS}>
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
                  <Select
                    value={selectValueOrUndefined(returnType)}
                    onValueChange={setReturnType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select return type" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_IN_DIALOG_CLASS}>
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

            {/* School & dispatch (LR from delivery partner / warehouse) */}
            <div className="space-y-4 border-b pb-4">
              <h3 className="text-lg font-semibold">School &amp; dispatch details</h3>
              <p className="text-sm text-neutral-600">
                School fields are filled from the selected DC. Hand stock to your delivery partner for return to{' '}
                {MAIN_WAREHOUSE}; enter the LR No from their lorry receipt before you submit (required).
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>LR No *</Label>
                  <Input
                    value={lrNumber}
                    onChange={(e) => setLrNumber(e.target.value)}
                    placeholder="Lorry receipt number from delivery partner"
                  />
                </div>
                <div>
                  <Label>LR Date *</Label>
                  <Input type="date" value={lrDate} onChange={(e) => setLrDate(e.target.value)} />
                </div>
                <div>
                  <Label>Fin Year *</Label>
                  <Input
                    value={finYear}
                    onChange={(e) => setFinYear(e.target.value)}
                    placeholder="e.g. 2026-27"
                  />
                </div>
                <div>
                  <Label>School Code</Label>
                  <Input
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    placeholder="School code"
                  />
                </div>
                <div>
                  <Label>School Type</Label>
                  <Input
                    value={schoolType}
                    onChange={(e) => setSchoolType(e.target.value)}
                    placeholder="School type"
                  />
                </div>
                <div>
                  <Label>Transport</Label>
                  <Input
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    placeholder="Transport name"
                  />
                </div>
                <div>
                  <Label>Town / Location</Label>
                  <Input value={town} onChange={(e) => setTown(e.target.value)} placeholder="Town or city" />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Zone" />
                </div>
                <div>
                  <Label>Cluster</Label>
                  <Input value={cluster} onChange={(e) => setCluster(e.target.value)} placeholder="Cluster code" />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Contact person"
                  />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
                    placeholder="Mobile number"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Delivery address"
                    rows={2}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Remarks (warehouse list)</Label>
                  <Textarea
                    value={returnRemarks}
                    onChange={(e) => setReturnRemarks(e.target.value)}
                    placeholder="Short note shown in warehouse executive remarks column"
                    rows={2}
                  />
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
                        <th className="py-2 px-3 text-left">Unit Price</th>
                        <th className="py-2 px-3 text-left">Reason</th>
                        <th className="py-2 px-3 text-left">Remarks</th>
                        <th className="py-2 px-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="py-2 px-3">
                            <Input
                              value={row.product}
                              onChange={(e) => updateProductRow(row.id, 'product', e.target.value)}
                              onBlur={(e) => fillLineFromDcProduct(row.id, e.target.value)}
                              list="executive-return-product-suggestions"
                              placeholder="Product name"
                              className="min-w-[140px]"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={row.soldQty === 0 ? '' : String(row.soldQty)}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/\D/g, '')
                                updateProductRow(
                                  row.id,
                                  'soldQty',
                                  cleaned === '' ? 0 : Number(cleaned)
                                )
                              }}
                              className="w-24"
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
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={row.unitPrice === 0 ? '' : String(row.unitPrice)}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/[^\d.]/g, '')
                                if (raw === '' || raw === '.') {
                                  updateProductRow(row.id, 'unitPrice', 0)
                                  return
                                }
                                const n = parseFloat(raw)
                                if (!Number.isNaN(n)) updateProductRow(row.id, 'unitPrice', n)
                              }}
                              className="w-28"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Select
                              value={selectValueOrUndefined(row.reason)}
                              onValueChange={(value) => updateProductRow(row.id, 'reason', value)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Select reason" />
                              </SelectTrigger>
                              <SelectContent className={SELECT_IN_DIALOG_CLASS}>
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
                  <datalist id="executive-return-product-suggestions">
                    {productSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
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
                        <img src={resolveUploadUrl(url)} alt={`Evidence ${idx + 1}`} className="w-full h-24 object-cover rounded border" />
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
                  <Input value={
                      typeof selectedReturn.saleId === 'string' && selectedReturn.saleId
                        ? selectedReturn.saleId
                        : selectedReturn.dcOrderId &&
                            typeof selectedReturn.dcOrderId === 'object'
                          ? (selectedReturn.dcOrderId as { dc_code?: string }).dc_code || '-'
                          : typeof selectedReturn.dcOrderId === 'string'
                            ? selectedReturn.dcOrderId
                            : '-'
                    } readOnly className="bg-neutral-50" />
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
                  <Label>LR No</Label>
                  <Input value={selectedReturn.lrNumber || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Fin Year</Label>
                  <Input value={selectedReturn.finYear || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>School Code</Label>
                  <Input value={selectedReturn.schoolCode || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Transport</Label>
                  <Input value={selectedReturn.transport || '-'} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Input value={selectedReturn.remarks || '-'} readOnly className="bg-neutral-50" />
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
