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

type ProductDetail = {
  product: string
  class: string
  category: string
  productName: string
  quantity: number // Requested quantity (read-only)
  availableQuantity?: number // Available quantity in warehouse (from inventory, auto-filled)
  deliverableQuantity?: number // Final deliverable quantity (calculated)
  remainingQuantity?: number // Remaining in warehouse after delivery (Available - Deliverable)
  strength?: number
  price?: number
  total?: number
  level?: string
}

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  level?: string
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
  customerName?: string
  customerPhone?: string
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
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [onHoldProcessing, setOnHoldProcessing] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [insufficientQuantity, setInsufficientQuantity] = useState(false)
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseItem[]>([])
  
  const { productNames: availableProducts } = useProducts()
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'NA']
  const availableCategories = ['New Students', 'Existing Students', 'Both', 'Training-Material']

  // Get current user to check role
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  async function load() {
    try {
      const data = await apiRequest<DC[]>(`/dc/pending-warehouse`)
      // Ensure data is an array before setting
      const dataArray = Array.isArray(data) ? data : []
      setRows(dataArray)
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
      // Fetch warehouse inventory first
      const inventory = await apiRequest<WarehouseItem[]>('/warehouse')
      // Ensure inventory is an array before setting
      const inventoryArray = Array.isArray(inventory) ? inventory : []
      setWarehouseInventory(inventoryArray)
      
      // Fetch full DC details to get productDetails
      const fullDC = await apiRequest<DC>(`/dc/${dc._id}`)
      setSelectedDC(fullDC)
      
      // Helper function to find matching inventory item
      const findInventoryItem = (productName: string, category?: string, level?: string): WarehouseItem | null => {
        // Try exact match first (productName, category, level)
        let match = inventoryArray.find(item => 
          item.productName?.toLowerCase() === productName?.toLowerCase() &&
          item.category === category &&
          item.level === level
        )
        
        // If no exact match, try productName and category only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            item.category === category
          )
        }
        
        // If still no match, try productName only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase()
          )
        }
        
        return match || null
      }
      
      // Load product details
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        console.log('Loading productDetails for DC @ Warehouse:', fullDC.productDetails)
        setProductRows(fullDC.productDetails.map((p, idx) => {
          // Find matching inventory item
          const inventoryItem = findInventoryItem(
            p.productName || p.product || 'ABACUS',
            p.category,
            p.level
          )
          
          const requestedQty = p.quantity !== undefined && p.quantity !== null ? Number(p.quantity) : 0
          const availableQty = inventoryItem ? inventoryItem.currentStock : (p.availableQuantity !== undefined && p.availableQuantity !== null ? Number(p.availableQuantity) : 0)
          const deliverableQty = p.deliverableQuantity !== undefined && p.deliverableQuantity !== null ? Number(p.deliverableQuantity) : Math.min(requestedQty, availableQty)
          const remainingQty = availableQty - deliverableQty
          
          const productRow = {
            product: p.product || 'ABACUS',
            class: p.class || 'NA',
            category: p.category || 'Training-Material',
            productName: p.productName || p.product || 'ABACUS',
            quantity: requestedQty, // Requested quantity (read-only)
            availableQuantity: availableQty, // Available in warehouse (from inventory, auto-filled)
            deliverableQuantity: deliverableQty, // Deliverable (calculated)
            remainingQuantity: remainingQty, // Remaining in warehouse after delivery
            strength: p.strength || 0,
            price: p.price || 0,
            total: p.total || 0,
            level: p.level || 'L2',
          }
          console.log(`Product ${idx + 1} loaded:`, productRow, 'Inventory match:', inventoryItem)
          return productRow
        }))
      } else {
        // Fallback: create from product string
        const productName = fullDC.product || 'ABACUS'
        const inventoryItem = findInventoryItem(productName, 'Training-Material', undefined)
        const requestedQty = fullDC.requestedQuantity || 0
        const availableQty = inventoryItem ? inventoryItem.currentStock : 0
        const deliverableQty = Math.min(requestedQty, availableQty)
        const remainingQty = availableQty - deliverableQty
        
        setProductRows([{
          product: productName,
          class: 'NA',
          category: 'Training-Material',
          productName: productName,
          quantity: requestedQty, // Requested quantity
          availableQuantity: availableQty, // From inventory
          deliverableQuantity: deliverableQty, // Calculated
          remainingQuantity: remainingQty, // Remaining
          strength: 0,
        }])
      }
      
      // Load DC details
      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(fullDC.dcRemarks || '')
      setDcCategory(fullDC.dcCategory || '')
      setDcNotes(fullDC.dcNotes || '')
      setContactPerson(fullDC.contactPerson || '')
      setContactMobile(fullDC.contactMobile || fullDC.customerPhone || '')
      setZone(fullDC.zone || '')
      setCluster(fullDC.cluster || '')
      setRemarks(fullDC.remarks || '')
    setInsufficientQuantity(false)
    setOpenDialog(true)
    } catch (e: any) {
      console.error('Failed to load DC details:', e)
      alert(`Error loading DC: ${e?.message || 'Unknown error'}`)
    }
  }

  // Check if quantities are sufficient when product rows change
  useEffect(() => {
    if (openDialog && selectedDC && productRows.length > 0) {
      // Check if available quantities are entered and if any are insufficient
      const hasAllAvailableQty = productRows.every(p => 
        p.availableQuantity !== undefined && p.availableQuantity !== null && p.availableQuantity > 0
      )
      const hasInsufficientQty = productRows.some(p => 
        (p.availableQuantity || 0) < (p.quantity || 0)
      )
      
      if (!hasAllAvailableQty) {
        setInsufficientQuantity(false) // Still entering, don't show warning yet
      } else if (hasInsufficientQty) {
        setInsufficientQuantity(true) // Some products have insufficient quantity
        } else {
        setInsufficientQuantity(false) // All products have sufficient quantity
      }
    } else {
      setInsufficientQuantity(false)
    }
  }, [productRows, openDialog, selectedDC])

  const processDC = async () => {
    if (!selectedDC) return

    setProcessing(true)
    try {
      // Fetch latest warehouse inventory from database
      const inventory = await apiRequest<WarehouseItem[]>('/warehouse')
      // Ensure inventory is an array before using
      const inventoryArray = Array.isArray(inventory) ? inventory : []
      
      // Helper function to find matching inventory item
      const findInventoryItem = (productName: string, category?: string, level?: string): WarehouseItem | null => {
        // Try exact match first (productName, category, level)
        let match = inventoryArray.find(item => 
          item.productName?.toLowerCase() === productName?.toLowerCase() &&
          item.category === category &&
          item.level === level
        )
        
        // If no exact match, try productName and category only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            item.category === category
          )
        }
        
        // If still no match, try productName only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase()
          )
        }
        
        return match || null
      }

      // Auto-fill available quantities from database for each product
      const updatedProductRows = productRows.map(p => {
        const inventoryItem = findInventoryItem(
          p.productName || p.product || '',
          p.category,
          p.level
        )
        
        // Get available qty from database (currentStock)
        const availableQty = inventoryItem ? inventoryItem.currentStock : (p.availableQuantity || 0)
        
        // Calculate deliverable quantity and remaining quantity
        const deliverableQty = Math.min(p.quantity || 0, availableQty)
        const remainingQty = availableQty - deliverableQty
        
        return {
          ...p,
          availableQuantity: availableQty, // Auto-filled from database
          deliverableQuantity: deliverableQty,
          remainingQuantity: remainingQty,
        }
      })
      
      // Update the productRows state to reflect the auto-filled values
      setProductRows(updatedProductRows)

      // Calculate totals
      const totalRequestedQty = updatedProductRows.reduce((sum, p) => sum + (p.quantity || 0), 0)
      const totalAvailableQty = updatedProductRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
      const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)
      // Update DC with product details including available quantities
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            class: p.class,
            category: p.category,
            productName: p.productName,
            quantity: p.quantity, // Requested quantity (original)
            availableQuantity: p.availableQuantity, // Available in warehouse
            deliverableQuantity: p.deliverableQuantity, // Final deliverable
            remainingQuantity: p.remainingQuantity, // Remaining in warehouse after delivery
            strength: p.strength,
            price: p.price,
            total: p.total,
            level: p.level,
          })),
          requestedQuantity: totalRequestedQty,
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
        }),
      })
      
      // Process the DC in warehouse (this will set status to 'completed')
      await apiRequest(`/dc/${selectedDC._id}/warehouse-process`, {
        method: 'POST',
        body: JSON.stringify({
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          remarks,
        }),
      })
      
      alert('DC processed successfully! It will appear in Completed DC page.')
      setOpenDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to process DC')
    } finally {
      setProcessing(false)
    }
  }

  const putOnHold = async () => {
    if (!selectedDC) return

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

    // Calculate deliverable quantity for each product
    const updatedProductRows = productRows.map(p => ({
      ...p,
      deliverableQuantity: Math.min(p.quantity || 0, p.availableQuantity || 0),
    }))

    const totalRequestedQty = productRows.reduce((sum, p) => sum + (p.quantity || 0), 0)
    const totalAvailableQty = productRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
    const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)

    setOnHoldProcessing(true)
    try {
      // Update DC with product details and set status to 'hold'
      const holdReason = `Insufficient quantity available. ${remarks ? `Remarks: ${remarks}` : ''}`
      
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            class: p.class,
            category: p.category,
            productName: p.productName,
            quantity: p.quantity,
            availableQuantity: p.availableQuantity,
            deliverableQuantity: p.deliverableQuantity,
            strength: p.strength,
            price: p.price,
            total: p.total,
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
                <TableHead>Product</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">No pending DCs</TableCell>
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
                  <TableCell className="truncate max-w-[160px]">{r.product || r.saleId?.product || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.requestedQuantity || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.managerId?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(isManager || isAdmin) && (
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
                      <Label className="text-sm text-neutral-600">Executive</Label>
                      <Input
                        value={selectedDC.managerId?.name || ''}
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
                        onChange={(e) => setCluster(e.target.value)}
                        placeholder="Cluster"
                        className="mt-1"
                      />
                </div>
                <div>
                      <Label className="text-sm text-neutral-600">Remarks</Label>
                      <Textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Remarks"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                </div>
                </Card>
              </div>
              
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

              {/* Products Table */}
              <Card className="p-4 border-t-4 border-t-blue-500">
                <div className="mb-4">
                  <h3 className="font-semibold text-neutral-900">Products</h3>
                  <p className="text-sm text-neutral-600 mt-1">Available quantity is auto-filled from inventory and cannot be changed. Deliverable and remaining quantities are calculated automatically.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="py-2 px-3 text-left border-r text-gray-900">Product</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Class</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Category</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Product Name</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Requested Qty</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Available Qty</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Deliverable Qty</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Remaining Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-neutral-500 py-4">No products added</td>
                        </tr>
                      ) : (
                        productRows.map((row, idx) => (
                          <tr key={idx} className="border-b bg-white">
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.product}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.class}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.category}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.productName}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700 font-medium">
                                {row.quantity || 0}
              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                <Input
                  type="number"
                                className="h-8 text-xs bg-neutral-50 border-neutral-300 text-neutral-700 font-medium"
                                value={row.availableQuantity !== undefined && row.availableQuantity !== null ? String(row.availableQuantity) : ''}
                                readOnly
                                disabled
                                placeholder="Auto-filled from inventory"
                  min="0"
                />
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className={`h-8 text-xs px-2 py-1.5 rounded border font-medium ${
                                (row.deliverableQuantity || 0) < (row.quantity || 0)
                                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                                  : 'bg-green-50 border-green-300 text-green-800'
                              }`}>
                                {row.deliverableQuantity !== undefined && row.deliverableQuantity !== null ? row.deliverableQuantity : 0}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className={`h-8 text-xs px-2 py-1.5 rounded border font-medium ${
                                (row.remainingQuantity || 0) < 0
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : (row.remainingQuantity || 0) === 0
                                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                                  : 'bg-blue-50 border-blue-300 text-blue-800'
                              }`}>
                                {row.remainingQuantity !== undefined && row.remainingQuantity !== null ? row.remainingQuantity : 0}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
              disabled={processing || onHoldProcessing || productRows.length === 0}
            >
              {processing ? 'Processing...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}