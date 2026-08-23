'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'
import { sortDcsNewestFirst } from '@/lib/dcListSort'
import {
  mapInventoryIdentityOntoDcRow,
  requiredQtyFromDcRow,
  validateDcStockAgainstInventory,
} from '@/lib/warehouseInventoryMatch'
import { consolidateStockRows } from '@/lib/warehouseStockList'

type ProductDetail = {
  product: string
  productName?: string
  productCategory?: string
  class: string
  category: string
  specs: string
  subject?: string
  quantity: number // Requested quantity (read-only)
  strength?: number
  price?: number
  total?: number
  level?: string
  term?: string
  availableQuantity?: number // Available quantity in warehouse (from inventory, auto-filled)
  deliverableQuantity?: number // Final deliverable quantity (calculated)
  remainingQuantity?: number // Remaining in warehouse after delivery (Available - Deliverable)
}

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  class?: string
  level?: string
  specs?: string
  subject?: string
  currentStock: number
}

type DC = {
  _id: string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  dcOrderId?: {
    _id: string
    school_name?: string
    school_type?: string
    school_code?: string
    dc_code?: string
    address?: string
    location?: string
    transport_name?: string
    transport_location?: string
    transportation_landmark?: string
    pincode?: string
    contact_person?: string
    contact_mobile?: string
    zone?: string
    cluster_code?: string
    cluster?: string
    remarks?: string
    assigned_to?: { _id?: string; name?: string; email?: string; cluster?: string } | string
  } | string
  employeeId?: {
    _id: string
    name?: string
    email?: string
    cluster?: string
  } | string
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  product?: string
  status?: string
  requestedQuantity?: number
  availableQuantity?: number
  deliverableQuantity?: number
  poPhotoUrl?: string
  managerId?: {
    _id: string
    name?: string
  }
  managerRequestedAt?: string
  productDetails?: ProductDetail[]
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  dcNotes?: string
  contactPerson?: string
  contactMobile?: string
  zone?: string
  cluster?: string
  remarks?: string
  transport?: string
  lrNo?: string
  lrDate?: string
  boxes?: string
  transportArea?: string
  deliveryStatus?: string
}

/** Prefer first non-empty string; never overwrite saved values with blanks. */
function pickNonEmpty(...vals: Array<string | undefined | null>): string {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim()
    }
  }
  return ''
}

/** Identity fields used to match a DC row to a warehouse SKU. */
function toStockRow(p: Record<string, any>) {
  return {
    product: p.product || p.productName || '',
    productName: p.productName || p.product || '',
    class: p.class,
    category: p.category,
    productCategory: p.productCategory,
    specs: p.specs,
    subject: p.subject,
    level: p.level,
    term: p.term,
    quantity: p.quantity,
    strength: p.strength,
    availableQuantity: p.availableQuantity,
  }
}

async function loadStockRecords(): Promise<WarehouseItem[]> {
  const stockList = await apiRequest<WarehouseItem[]>('/warehouse/stock-list').catch(() => [])
  if (Array.isArray(stockList) && stockList.length > 0) {
    return stockList.map((row) => ({
      ...row,
      currentStock: Number(row.currentStock) || 0,
    }))
  }
  const inventory = await apiRequest<WarehouseItem[]>('/warehouse').catch(() => [])
  return consolidateStockRows(Array.isArray(inventory) ? inventory : []).map((row) => ({
    _id: row._id,
    productName: row.productName,
    category: row.category,
    level: row.level,
    specs: row.specs,
    subject: row.subject,
    currentStock: row.currentStock,
  }))
}

export default function WarehouseDcAtWarehouse() {
  const router = useRouter()
  const [rows, setRows] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [productRows, setProductRows] = useState<ProductDetail[]>([])
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [onHoldProcessing, setOnHoldProcessing] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [insufficientQuantity, setInsufficientQuantity] = useState(false)
  const [insufficientStockMessage, setInsufficientStockMessage] = useState('')
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseItem[]>([])
  
  const { productNames: availableProducts } = useProducts()
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'NA']
  const availableCategories = ['New Students', 'Existing Students', 'Both', 'Training-Material']

  // Get current user to check role
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
  const isWarehouseExecutive = currentUser?.role === 'Warehouse Executive'
  const isWarehouseManager = currentUser?.role === 'Warehouse Manager'
  const canAccessWarehouse = isManager || isAdmin || isWarehouseExecutive || isWarehouseManager

  async function load() {
    try {
      const data = await apiRequest<DC[]>(`/dc/pending-warehouse`)
      // Ensure data is an array before setting
      const dataArray = Array.isArray(data) ? data : []
      setRows(sortDcsNewestFirst(dataArray))
    } catch (err: any) {
      console.error('Failed to load DC list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openProcessDialog = async (dc: DC) => {
    try {
      setOpenDialog(true) // Open dialog first to show loading state
      // Fetch warehouse inventory first
      const inventoryArray = await loadStockRecords()
      setWarehouseInventory(inventoryArray)
      
      // Fetch full DC details to get productDetails and dcOrderId with delivery/address info
      const fullDC = await apiRequest<DC>(`/dc/${dc._id}`)

      // Also fetch the related Sale/DcOrder so school fields are available even if DC
      // document does not copy them (same pattern as Pending DC).
      let dcOrderData: NonNullable<Exclude<DC['dcOrderId'], string>> | null = null
      if (fullDC.dcOrderId) {
        try {
          const dcOrderId =
            typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId !== null && '_id' in fullDC.dcOrderId
              ? fullDC.dcOrderId._id
              : typeof fullDC.dcOrderId === 'string'
                ? fullDC.dcOrderId
                : null
          if (dcOrderId) {
            dcOrderData = await apiRequest<NonNullable<Exclude<DC['dcOrderId'], string>>>(
              `/dc-orders/${dcOrderId}`
            )
          }
        } catch (e) {
          console.warn('Failed to fetch DcOrder for warehouse DC form:', e)
        }
      }

      const populatedOrder =
        typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId !== null ? fullDC.dcOrderId : null
      const dcOrder = {
        ...(populatedOrder || {}),
        ...(dcOrderData || {}),
      } as NonNullable<Exclude<DC['dcOrderId'], string>>

      const mergedDC: DC = {
        ...fullDC,
        customerName: pickNonEmpty(fullDC.customerName, dcOrder.school_name),
        customerPhone: pickNonEmpty(fullDC.customerPhone, dcOrder.contact_mobile),
        customerAddress: pickNonEmpty(fullDC.customerAddress, dcOrder.address, dcOrder.location),
        dcOrderId: Object.keys(dcOrder).length > 0 ? dcOrder : fullDC.dcOrderId,
      }
      setSelectedDC(mergedDC)

      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        setProductRows(fullDC.productDetails.map((p) => {
          const subjectValue = (p.subject !== undefined && p.subject !== null && String(p.subject).trim() !== '')
            ? String(p.subject)
            : undefined
          const stockRow = toStockRow({
            ...p,
            specs: p.specs,
            subject: subjectValue,
            level: p.level || '',
          })
          const productName = stockRow.productName || stockRow.product
          const requestedQty = requiredQtyFromDcRow(stockRow)
          const mapped = mapInventoryIdentityOntoDcRow(stockRow, inventoryArray)
          const availableQty = mapped.availableQuantity
          const deliverableQty = (p.deliverableQuantity !== undefined && p.deliverableQuantity !== null)
            ? Number(p.deliverableQuantity)
            : requestedQty
          const remainingQty = Math.max(0, availableQty - deliverableQty)

          return {
            product: productName,
            productName,
            productCategory: mapped.productCategory,
            class: p.class || 'NA',
            category: p.category || 'Training-Material',
            specs: mapped.specs,
            subject: mapped.subject || undefined,
            quantity: requestedQty,
            availableQuantity: availableQty,
            deliverableQuantity: deliverableQty,
            remainingQuantity: remainingQty,
            strength: p.strength || 0,
            price: Number(p.unit_price) || Number(p.price) || 0,
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
            total:
              (Number(p.quantity) || Number(p.strength) || 0) *
              (Number(p.unit_price) || Number(p.price) || 0),
            level: mapped.level,
            term: (p as any).term,
          }
        }))
      } else {
        const productName = fullDC.product || ''
        const stockRow = toStockRow({
          product: productName,
          productName,
          category: 'Training-Material',
          quantity: fullDC.requestedQuantity || 0,
        })
        const requestedQty = requiredQtyFromDcRow(stockRow)
        const mapped = mapInventoryIdentityOntoDcRow(stockRow, inventoryArray)
        const availableQty = mapped.availableQuantity
        const deliverableQty = requestedQty
        const remainingQty = Math.max(0, availableQty - deliverableQty)

        setProductRows([{
          product: productName,
          productName,
          productCategory: mapped.productCategory,
          class: 'NA',
          category: 'Training-Material',
          specs: mapped.specs,
          subject: mapped.subject || undefined,
          quantity: requestedQty,
          availableQuantity: availableQty,
          deliverableQuantity: deliverableQty,
          remainingQuantity: remainingQty,
          strength: 0,
          level: mapped.level,
        }])
      }
      
      // Load DC + Sale/Lead school details (prefer non-empty existing values; never force blanks)
      const employee =
        typeof mergedDC.employeeId === 'object' && mergedDC.employeeId !== null
          ? mergedDC.employeeId
          : null
      const assignedTo =
        dcOrder.assigned_to && typeof dcOrder.assigned_to === 'object'
          ? dcOrder.assigned_to
          : null

      setDcDate(mergedDC.dcDate ? new Date(mergedDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(pickNonEmpty(mergedDC.dcRemarks))
      setDcCategory(pickNonEmpty(mergedDC.dcCategory))
      setDcNotes(pickNonEmpty(mergedDC.dcNotes))
      setContactPerson(
        pickNonEmpty(mergedDC.contactPerson, dcOrder.contact_person)
      )
      setContactMobile(
        pickNonEmpty(
          mergedDC.contactMobile,
          mergedDC.customerPhone,
          dcOrder.contact_mobile
        )
      )
      setSchoolType(pickNonEmpty(dcOrder.school_type))
      setSchoolAddress(
        pickNonEmpty(dcOrder.address, mergedDC.customerAddress, dcOrder.location)
      )
      setZone(pickNonEmpty(mergedDC.zone, dcOrder.zone))
      setCluster(
        pickNonEmpty(
          mergedDC.cluster,
          dcOrder.cluster_code,
          dcOrder.cluster,
          employee?.cluster,
          assignedTo?.cluster
        )
      )
      setRemarks(pickNonEmpty(mergedDC.remarks, dcOrder.remarks))
      setInsufficientQuantity(false)
      setInsufficientStockMessage('')
      setOpenDialog(true)
    } catch (e: any) {
      console.error('Failed to load DC details:', e)
      alert(`Error loading DC: ${e?.message || 'Unknown error'}`)
    }
  }

  // Check if quantities are sufficient when product rows change
  useEffect(() => {
    if (openDialog && selectedDC && productRows.length > 0) {
      const stockCheck = validateDcStockAgainstInventory(
        productRows.map(toStockRow),
        warehouseInventory
      )
      setInsufficientQuantity(!stockCheck.ok)
      setInsufficientStockMessage(stockCheck.ok ? '' : stockCheck.message)
    } else {
      setInsufficientQuantity(false)
      setInsufficientStockMessage('')
    }
  }, [productRows, openDialog, selectedDC, warehouseInventory])

  const processDC = async () => {
    if (!selectedDC) return

    if (!schoolType || schoolType.trim() === '') {
      alert('School Type is required. Please enter the school type before submitting.')
      return
    }

    setProcessing(true)
    try {
      const inventoryArray = await loadStockRecords()
      setWarehouseInventory(inventoryArray)

      const updatedProductRows = productRows.map(p => {
        const stockRow = toStockRow(p)
        const mapped = mapInventoryIdentityOntoDcRow(stockRow, inventoryArray)
        const availableQty = mapped.availableQuantity
        const requiredQty = requiredQtyFromDcRow(stockRow)
        const deliverableQty = p.deliverableQuantity != null ? Number(p.deliverableQuantity) : requiredQty
        const remainingQty = Math.max(0, availableQty - deliverableQty)
        return {
          ...p,
          productCategory: mapped.productCategory,
          specs: mapped.specs,
          subject: mapped.subject || undefined,
          level: mapped.level,
          quantity: requiredQty,
          availableQuantity: availableQty,
          remainingQuantity: remainingQty,
        }
      })
      setProductRows(updatedProductRows)

      const stockCheck = validateDcStockAgainstInventory(
        updatedProductRows.map(toStockRow),
        inventoryArray
      )
      if (!stockCheck.ok) {
        setInsufficientQuantity(true)
        setInsufficientStockMessage(stockCheck.message)
        alert(stockCheck.message)
        return
      }

      const totalRequestedQty = updatedProductRows.reduce((sum, p) => sum + requiredQtyFromDcRow(toStockRow(p)), 0)
      const totalAvailableQty = updatedProductRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
      const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)

      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            productName: p.productName || p.product,
            productCategory: p.productCategory,
            class: p.class,
            category: p.category,
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            quantity: p.quantity,
            availableQuantity: p.availableQuantity,
            deliverableQuantity: p.deliverableQuantity,
            remainingQuantity: p.remainingQuantity,
            strength: p.strength,
            price: Number(p.price) || Number(p.unit_price) || 0,
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
            total:
              (Number(p.quantity) || 0) *
              (Number(p.price) || Number(p.unit_price) || 0),
            level: p.level || '',
          })),
          requestedQuantity: totalRequestedQty,
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          dcDate: dcDate || undefined,
          dcRemarks: dcRemarks || undefined,
          dcCategory: dcCategory || undefined,
          dcNotes: dcNotes || undefined,
          contactPerson: contactPerson || undefined,
          contactMobile: contactMobile || undefined,
          zone: zone || undefined,
          cluster: cluster || undefined,
          remarks: remarks || undefined,
          dcOrderId: selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' 
            ? { ...selectedDC.dcOrderId, school_type: schoolType || undefined, address: schoolAddress || undefined }
            : selectedDC.dcOrderId,
        }),
      })

      await apiRequest(`/dc/${selectedDC._id}/warehouse-process`, {
        method: 'POST',
        body: JSON.stringify({
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          remarks,
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            productName: p.productName || p.product,
            productCategory: p.productCategory,
            class: p.class,
            category: p.category,
            specs: p.specs || '',
            subject: p.subject || undefined,
            quantity: p.quantity,
            availableQuantity: p.availableQuantity,
            deliverableQuantity: p.deliverableQuantity,
            remainingQuantity: p.remainingQuantity,
            strength: p.strength,
            price: Number(p.price) || Number(p.unit_price) || 0,
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
            total:
              (Number(p.quantity) || 0) *
              (Number(p.price) || Number(p.unit_price) || 0),
            level: p.level || '',
          })),
        }),
      })

      alert('DC processed successfully! It will appear in Completed DC page.')
      setOpenDialog(false)
      load()
    } catch (err: any) {
      const message = err?.message || 'Failed to process DC'
      if (/insufficient stock/i.test(message)) {
        setInsufficientQuantity(true)
        setInsufficientStockMessage(message)
      }
      alert(message)
    } finally {
      setProcessing(false)
    }
  }

  const putOnHold = async () => {
    if (!selectedDC) return

    // Validate required fields
    if (!schoolType || schoolType.trim() === '') {
      alert('School Type is required. Please enter the school type before putting the DC on hold.')
      return
    }

    // Validate that available quantities exist (they're auto-filled from inventory)
    const productsWithoutAvailableQty = productRows.filter(p => 
      p.availableQuantity === undefined || p.availableQuantity === null
    )
    
    if (productsWithoutAvailableQty.length > 0) {
      alert('Available quantities are being loaded from inventory. Please wait or refresh the page.')
      return
    }
    
    if (productRows.length === 0) {
      alert('No products found. Please refresh the page.')
      return
    }

    setOnHoldProcessing(true)
    try {
      const inventoryArray = await loadStockRecords()
      setWarehouseInventory(inventoryArray)

      const updatedProductRows = productRows.map((p) => {
        const stockRow = toStockRow(p)
        const mapped = mapInventoryIdentityOntoDcRow(stockRow, inventoryArray)
        const availableQty = mapped.availableQuantity
        const requiredQty = requiredQtyFromDcRow(stockRow)
        const deliverableQty = p.deliverableQuantity != null ? Number(p.deliverableQuantity) : requiredQty
        return {
          ...p,
          productCategory: mapped.productCategory,
          specs: mapped.specs,
          subject: mapped.subject || undefined,
          level: mapped.level,
          quantity: requiredQty,
          availableQuantity: availableQty,
          remainingQuantity: Math.max(0, availableQty - deliverableQty),
        }
      })
      setProductRows(updatedProductRows)

      const stockCheck = validateDcStockAgainstInventory(
        updatedProductRows.map(toStockRow),
        inventoryArray
      )
      setInsufficientQuantity(!stockCheck.ok)
      setInsufficientStockMessage(stockCheck.ok ? '' : stockCheck.message)

      const totalRequestedQty = updatedProductRows.reduce((sum, p) => sum + requiredQtyFromDcRow(toStockRow(p)), 0)
      const totalAvailableQty = updatedProductRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
      const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)

      const holdReason = stockCheck.ok
        ? (remarks ? `Hold requested. Remarks: ${remarks}` : 'Hold requested.')
        : (remarks ? `${stockCheck.message}. Remarks: ${remarks}` : stockCheck.message)
      
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            class: p.class,
            category: p.category,
            productCategory: p.productCategory,
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            quantity: p.quantity,
            availableQuantity: p.availableQuantity,
            deliverableQuantity: p.deliverableQuantity,
            remainingQuantity: p.remainingQuantity, // Save remaining qty to database
            strength: p.strength,
            price: Number(p.price) || Number(p.unit_price) || 0,
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
            total:
              (Number(p.quantity) || 0) *
              (Number(p.price) || Number(p.unit_price) || 0),
            level: p.level,
          })),
          requestedQuantity: totalRequestedQty,
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          status: 'hold',
          holdReason: holdReason,
          dcDate: dcDate || undefined,
          dcRemarks: dcRemarks || undefined,
          dcCategory: dcCategory || undefined,
          dcNotes: dcNotes || undefined,
          contactPerson: contactPerson || undefined,
          contactMobile: contactMobile || undefined,
          zone: zone || undefined,
          cluster: cluster || undefined,
          remarks: remarks || undefined,
          dcOrderId: selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' 
            ? { ...selectedDC.dcOrderId, school_type: schoolType || undefined, address: schoolAddress || undefined }
            : selectedDC.dcOrderId,
        }),
      })
      
      alert('DC has been put on hold. It will appear in Hold DC page.')
      setOpenDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to put DC on hold')
    } finally {
      setOnHoldProcessing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">DC Warehouse - Pending DCs</h1>
          <p className="text-sm text-neutral-600 mt-1">Review and process DCs requested by Manager</p>
        </div>
      </div>

      <Card className="p-6 rounded-lg border border-neutral-200">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>DC No</TableHead>
                <TableHead>Requested Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Customer Phone</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">No pending DCs</TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow key={r._id}>
                  <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">DC-{r._id.slice(-6)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.managerRequestedAt ? new Date(r.managerRequestedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[160px]">{r.customerName || r.saleId?.customerName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customerPhone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {(() => {
                      // Calculate requestedQuantity from productDetails if available, otherwise use requestedQuantity field
                      if (r.productDetails && Array.isArray(r.productDetails) && r.productDetails.length > 0) {
                        const calculatedQty = r.productDetails.reduce((sum, p) => {
                          const qty = p.quantity || 0
                          const str = p.strength || 0
                          return sum + Math.max(qty, str) // Use the larger value
                        }, 0)
                        return calculatedQty > 0 ? calculatedQty : (r.requestedQuantity || '-')
                      }
                      return r.requestedQuantity || '-'
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.managerId?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canAccessWarehouse && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => openProcessDialog(r)}>
                          Update & Submit
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">DC Form Update</DialogTitle>
            <DialogDescription>
              Update DC information and product quantities
            </DialogDescription>
          </DialogHeader>
          {selectedDC && (
            <div className="space-y-6 py-4">
              {/* School Information & More Information - Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* School Information - Left Column */}
                <Card className="p-4 border-t-4 border-t-blue-500">
                  <h3 className="font-semibold text-neutral-900 mb-4">School Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-neutral-600">Contact Person Name</Label>
                      <Input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Contact Person Name"
                        className="mt-1"
                      />
                    </div>
                <div>
                      <Label className="text-sm text-neutral-600">Contact Mobile</Label>
                      <Input
                        value={contactMobile}
                        onChange={(e) => setContactMobile(e.target.value)}
                        placeholder="Contact Mobile"
                        className="mt-1"
                      />
                </div>
                <div>
                      <Label className="text-sm text-neutral-600">School Type <span className="text-red-500">*</span></Label>
                      <Input
                        value={schoolType}
                        onChange={(e) => setSchoolType(e.target.value)}
                        placeholder="School Type"
                        className={`mt-1 ${!schoolType ? 'border-red-300' : ''}`}
                        required
                      />
                    </div>
                <div>
                      <Label className="text-sm text-neutral-600">Executive</Label>
                      <Input
                        value={
                          pickNonEmpty(
                            typeof selectedDC.employeeId === 'object'
                              ? selectedDC.employeeId?.name
                              : '',
                            typeof selectedDC.dcOrderId === 'object' &&
                              selectedDC.dcOrderId?.assigned_to &&
                              typeof selectedDC.dcOrderId.assigned_to === 'object'
                              ? selectedDC.dcOrderId.assigned_to.name
                              : '',
                            selectedDC.managerId?.name
                          )
                        }
                        disabled
                        className="mt-1 bg-neutral-50"
                      />
                    </div>
                  </div>
                </Card>

                {/* More Information - Right Column */}
                <Card className="p-4 border-t-4 border-t-blue-500">
                  <h3 className="font-semibold text-neutral-900 mb-4">More Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-neutral-600">School Address</Label>
                      <Textarea
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        placeholder="School Address"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-neutral-600">Zone</Label>
                      <Input
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="Zone"
                        className="mt-1"
                      />
                </div>
                <div>
                      <Label className="text-sm text-neutral-600">Cluster</Label>
                      <Input
                        value={cluster}
                        readOnly
                        disabled
                        className="mt-1 bg-neutral-50"
                        placeholder="Cluster"
                      />
                </div>
                </div>
                </Card>
              </div>
              
              {/* Delivery & Address Information - Full Width */}
              {(() => {
                const dcOrder = typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId : null
                // Get delivery and address information from database (saved in edit PO in executive)
                const transportName = dcOrder?.transport_name || selectedDC.transport || ''
                const transportLocation = dcOrder?.transport_location || selectedDC.transportArea || ''
                const transportLandmark = dcOrder?.transportation_landmark || ''
                const pincode = dcOrder?.pincode || ''
                
                return (
                  <Card className="p-4 border-t-4 border-t-green-500">
                    <h3 className="font-semibold text-neutral-900 mb-4">Delivery & Address Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Name</Label>
                        <Input
                          value={transportName}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Location</Label>
                        <Input
                          value={transportLocation}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Landmark</Label>
                        <Input
                          value={transportLandmark}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Pincode</Label>
                        <Input
                          value={pincode}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      {selectedDC.lrNo && (
                        <div>
                          <Label className="text-sm text-neutral-600">LR No</Label>
                          <Input
                            value={selectedDC.lrNo}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.lrDate && (
                        <div>
                          <Label className="text-sm text-neutral-600">LR Date</Label>
                          <Input
                            type="date"
                            value={selectedDC.lrDate ? new Date(selectedDC.lrDate).toISOString().split('T')[0] : ''}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.boxes && (
                        <div>
                          <Label className="text-sm text-neutral-600">Boxes</Label>
                          <Input
                            value={selectedDC.boxes}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.deliveryStatus && (
                        <div>
                          <Label className="text-sm text-neutral-600">Delivery Status</Label>
                          <Input
                            value={selectedDC.deliveryStatus}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })()}

              {/* DC Information Update - Full Width */}
              <Card className="p-4 border-t-4 border-t-blue-500">
                <h3 className="font-semibold text-neutral-900 mb-4">DC Information Update</h3>
                <div className="mb-4">
                  <div className="text-lg font-semibold text-neutral-900">DC No: DC-{selectedDC._id.slice(-6)}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-neutral-600">DC Date</Label>
                    <Input
                      type="date"
                      value={dcDate}
                      onChange={(e) => setDcDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-neutral-600">DC Category</Label>
                    <Select value={dcCategory} onValueChange={setDcCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select DC Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                        <SelectItem value="Full Year">Full Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-neutral-600">DC Notes</Label>
                    <Textarea
                      value={dcNotes}
                      onChange={(e) => setDcNotes(e.target.value)}
                      placeholder="Notes"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                <div>
                    <Label className="text-sm text-neutral-600">DC Remarks</Label>
                    <Textarea
                      value={dcRemarks}
                      onChange={(e) => setDcRemarks(e.target.value)}
                      placeholder="DC Remarks"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* Products Table — same layout as Warehouse → Stock */}
              <Card className="overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <h3 className="font-semibold text-neutral-900">Products</h3>
                  <p className="text-sm text-neutral-500 mt-1">Available quantity is mapped from Inventory / Stock and cannot be changed.</p>
                  {insufficientQuantity && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800">
                        {insufficientStockMessage || 'Insufficient stock. Please ensure sufficient stock before processing this DC.'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">S.No</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Product Category</TableHead>
                        <TableHead>Specs</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Required Qty</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Available Qty</TableHead>
                        <TableHead>Deliverable Qty</TableHead>
                        <TableHead>Remaining Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center text-neutral-500">No products added</TableCell>
                        </TableRow>
                      ) : (
                        productRows.map((row, idx) => {
                          const requiredQty = requiredQtyFromDcRow(row)
                          const availableQty = Number(row.availableQuantity) || 0
                          const highlightRed = availableQty <= 0 || requiredQty > availableQty
                          return (
                            <TableRow key={idx} className={highlightRed ? 'bg-red-50' : undefined}>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell className="font-medium text-neutral-900">{row.product}</TableCell>
                              <TableCell>{row.class || '-'}</TableCell>
                              <TableCell>{row.productCategory || '-'}</TableCell>
                              <TableCell>{row.specs || '-'}</TableCell>
                              <TableCell>{row.subject || '-'}</TableCell>
                              <TableCell>{row.quantity || 0}</TableCell>
                              <TableCell>{row.level || '-'}</TableCell>
                              <TableCell className={highlightRed ? 'font-medium text-red-800' : undefined}>
                                {row.availableQuantity !== undefined && row.availableQuantity !== null ? row.availableQuantity : 0}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  className={`h-8 w-24 text-sm ${
                                    availableQty < (row.deliverableQuantity || 0)
                                      ? 'bg-red-50 border-red-300 text-red-800'
                                      : ''
                                  }`}
                                  value={row.deliverableQuantity !== undefined && row.deliverableQuantity !== null ? String(row.deliverableQuantity) : '0'}
                                  onChange={(e) => {
                                    const updated = [...productRows]
                                    const newDeliverableQty = Number(e.target.value) || 0
                                    const liveAvailable = Number(updated[idx].availableQuantity) || 0
                                    updated[idx].deliverableQuantity = newDeliverableQty
                                    updated[idx].remainingQuantity = Math.max(0, liveAvailable - newDeliverableQty)
                                    setProductRows(updated)
                                  }}
                                  min="0"
                                  max={availableQty}
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell>
                                {row.remainingQuantity !== undefined && row.remainingQuantity !== null ? row.remainingQuantity : 0}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                      <TableRow>
                        <TableCell colSpan={7} className="text-right font-semibold text-neutral-700">Total:</TableCell>
                        <TableCell className="font-semibold">
                          {productRows.reduce((sum, row) => sum + requiredQtyFromDcRow(row), 0)}
                        </TableCell>
                        <TableCell colSpan={3} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button 
              onClick={putOnHold} 
              disabled={onHoldProcessing || processing || productRows.length === 0}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {onHoldProcessing ? 'Putting on Hold...' : 'Hold DC'}
            </Button>
            <Button 
              onClick={processDC} 
              disabled={processing || onHoldProcessing || productRows.length === 0 || insufficientQuantity}
            >
              {processing ? 'Processing...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
