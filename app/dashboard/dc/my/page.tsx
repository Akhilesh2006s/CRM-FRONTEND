'use client'

import { uniqueProductNames } from '@/lib/productNames'
import { useEffect, useState } from 'react'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Package, Plus, Upload, X } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { chainRowClass } from '@/lib/chainSchool'

type DC = {
  _id: string
  employeeId?: string | { _id: string }
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  dcOrderId?: string | {
    _id: string
    school_name?: string
    contact_person?: string
    contact_mobile?: string
    email?: string
    products?: any
    assigned_to?: string | { _id: string }
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  productDetails?: any[]
  createdAt?: string
}

export default function MyDCPage() {
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  
  // Add Products Dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [selectedDCForProducts, setSelectedDCForProducts] = useState<DC | null>(null)
  const [productRows, setProductRows] = useState<Array<{
    id: string
    product: string
    checked: boolean
    price: number
    strength: number
    total: number
    level: string
    klass: string
    productCategory: string
    specs: string
  }>>([])
  // PO for the Add Products dialog: products cannot be sent for verification without one.
  const [productPoUrl, setProductPoUrl] = useState('')
  
  const {
    productNames: availableProducts,
    products: catalogProducts,
    getProductLevels,
    getProductClasses,
    getProductSpecs,
  } = useProducts()
  const productCategories = (name: string): string[] => {
    const product = catalogProducts.find((p) => p.productName.trim().toLowerCase() === name.trim().toLowerCase())
    return product?.hasCategory !== false && Array.isArray(product?.categories)
      ? product!.categories!.map((c) => String(c).trim()).filter(Boolean)
      : []
  }

  const load = async () => {
    setLoading(true)
    try {
      // Load all DCs (clients) for the employee - including converted leads
      const data = await apiRequest<DC[]>(`/dc/employee/my`)
      console.log('Loaded clients (all):', data)
      // Ensure data is an array before using array methods
      const dataArray = Array.isArray(data) ? data : []
      console.log('Total clients loaded:', dataArray.length)
      // Show DCs with 'created' status (ready for PO submission) and 'po_submitted' status (PO already submitted)
      // Also include saved DcOrders (closed leads) that don't have a DC yet - these will have status 'created' from backend conversion
      const clientDCs = dataArray.filter(dc => {
        const status = dc.status
        const isCreated = status === 'created'
        const isPoSubmitted = status === 'po_submitted'
        // Also include items that are converted from saved DcOrders (they will have status 'created' from backend)
        const isConvertedLead = dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId.status === 'saved'
        return isCreated || isPoSubmitted || isConvertedLead
      })
      console.log('Filtered clients (created/po_submitted/converted leads):', clientDCs)
      console.log('Filtered count:', clientDCs.length)
      setItems(clientDCs)
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
      alert(`Error loading DCs: ${e?.message || 'Unknown error'}. Check console for details.`)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openSubmitDialog = (dc: DC, isEdit = false) => {
    setSelectedDC(dc)
    setPoPhotoUrl(dc.poPhotoUrl || '')
    setRemarks('')
    setOpenDialog(true)
  }


  const openAddProductsDialog = async (dc: DC) => {
    setSelectedDCForProducts(dc)
    setProductPoUrl(dc.poPhotoUrl || '')
    
    // Load existing product details from DC if available
    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        // Load existing products
        setProductRows(fullDC.productDetails.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product: p.product || 'ABACUS',
          checked: true,
          price: p.price || 0,
          strength: p.strength || 0,
          total: (p.price || 0) * (p.strength || 0),
          level: p.level || '',
          klass: String(p.class || ''),
          productCategory: String(p.productCategory || ''),
          specs: String(p.specs || ''),
        })))
      } else {
        // Initialize with all products unchecked
        setProductRows(availableProducts.map((product, idx) => ({
          id: String(idx + 1),
          product,
          checked: false,
          price: 0,
          strength: 0,
          total: 0,
          level: '',
          klass: '',
          productCategory: '',
          specs: '',
        })))
      }
    } catch (e) {
      // Initialize with all products unchecked
      setProductRows(availableProducts.map((product, idx) => ({
        id: String(idx + 1),
        product,
        checked: false,
        price: 0,
        strength: 0,
        total: 0,
        level: '',
        klass: '',
        productCategory: '',
        specs: '',
      })))
    }
    
    setProductDialogOpen(true)
  }

  const handleProductCheck = (productId: string, checked: boolean) => {
    setProductRows(productRows.map(row => {
      if (row.id === productId) {
        return { ...row, checked, total: checked ? row.price * row.strength : 0 }
      }
      return row
    }))
  }

  const handleProductFieldChange = (
    productId: string,
    field: 'price' | 'strength' | 'level' | 'klass' | 'productCategory' | 'specs',
    value: string | number,
  ) => {
    setProductRows(productRows.map(row => {
      if (row.id === productId) {
        const updated = { ...row, [field]: value }
        // Auto-calculate total when price or strength changes
        if (field === 'price' || field === 'strength') {
          updated.total = updated.price * updated.strength
        }
        return updated
      }
      return row
    }))
  }


  const saveProducts = async () => {
    if (!selectedDCForProducts) return

    const checkedProducts = productRows.filter(row => row.checked)
    if (checkedProducts.length === 0) {
      alert('Please select at least one product')
      return
    }

    // Every selected product needs the same details as Close Lead: class, category / specs / level
    // where the product has them, price and strength.
    const missing: string[] = []
    for (const p of checkedProducts) {
      const need: string[] = []
      if (!p.klass) need.push('Class')
      if (productCategories(p.product).length > 0 && !p.productCategory) need.push('Category')
      if (getProductSpecs(p.product).length > 0 && !p.specs) need.push('Specs')
      if (getProductLevels(p.product).length > 0 && !p.level) need.push('Level')
      if (!p.price) need.push('Price')
      if (!p.strength) need.push('Strength')
      if (need.length) missing.push(`${p.product}: ${need.join(', ')}`)
    }
    if (missing.length > 0) {
      alert(`Please fill in all required fields:\n${missing.join('\n')}`)
      return
    }
    if (!productPoUrl) {
      alert('Please upload the PO before adding products.')
      return
    }

    setSubmitting(true)
    try {
      // Prepare product details in the format expected by backend
      // Include all fields that employees might have entered
      const productDetails = checkedProducts.map(row => ({
        product: row.product,
        class: row.klass,
        category: 'New Students',
        productCategory: row.productCategory || undefined,
        specs: row.specs || undefined,
        productName: '', // Product name can be empty initially
        quantity: row.strength || row.quantity || 0, // Using strength as quantity
        strength: row.strength || 0,
        price: Number(row.price) || 0, // Ensure it's a number
        total: Number(row.total) || (Number(row.price) || 0) * (Number(row.strength) || 0), // Calculate if missing
        level: row.level || undefined,
      }))
      
      console.log('Saving productDetails from employee:', productDetails)

      // Update DC with product details and move to closed sales for verification
      await apiRequest(`/dc/${selectedDCForProducts._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails,
          poPhotoUrl: productPoUrl,
          requestedQuantity: checkedProducts.reduce((sum, p) => sum + p.strength, 0),
          status: 'sent_to_manager', // This will make it appear in closed sales for admin/coordinator verification
        }),
      })

      alert('Products added successfully! The client will be sent to closed sales for verification.')
      setProductDialogOpen(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to save products')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Convert to base64 data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setPoPhotoUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const submitPO = async () => {
    if (!selectedDC || !poPhotoUrl) {
      alert('Please provide a PO photo URL or upload a file')
      return
    }

    setSubmitting(true)
    try {
      // Check if this is a DcOrder that doesn't have a DC yet (converted lead)
      // If dcOrderId exists but no actual DC was created, create it first
      const isDcOrderOnly = selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' && !selectedDC._id?.startsWith('dc_');
      
      let dcId = selectedDC._id;
      
      // If this is a DcOrder without a DC, create the DC first
      if (isDcOrderOnly && selectedDC.dcOrderId) {
        const dcOrderId = typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId._id : selectedDC.dcOrderId;
        const dcPayload: any = {
          dcOrderId: dcOrderId,
          employeeId: selectedDC.employeeId || selectedDC.dcOrderId?.assigned_to?._id,
          productDetails: selectedDC.productDetails || [],
          status: 'created',
        };
        
        const newDC = await apiRequest(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(dcPayload),
        });
        dcId = newDC._id;
      }
      
      // For po_submitted status, we need to update the PO
      // The backend submit-po endpoint only works for 'created' status
      // So we'll use the update endpoint for editing
      if (selectedDC.status === 'po_submitted') {
        // Update existing PO - we'll need to check if backend supports this
        // For now, we'll use the same endpoint but handle it differently
        await apiRequest(`/dc/${dcId}`, {
          method: 'PUT',
          body: JSON.stringify({ poPhotoUrl, poDocument: poPhotoUrl, deliveryNotes: remarks }),
        })
        alert('PO updated successfully!')
      } else {
        await apiRequest(`/dc/${dcId}/submit-po`, {
        method: 'POST',
        body: JSON.stringify({ poPhotoUrl, remarks }),
      })
      alert('PO submitted successfully!')
      }
      setOpenDialog(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to submit/update PO')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My Clients - Submit PO</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4">
            <p className="text-neutral-600">No clients found.</p>
            <p className="text-sm text-neutral-500 mt-2">
              Clients are automatically created when you convert a lead to client or create a Deal and assign it to an employee. 
              Make sure the Deal has an "Assigned To" executive selected.
            </p>
          </div>
        )}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {items.map((d) => (
              <Card key={d._id} className={chainRowClass(d, 'p-4 space-y-3')}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900">
                      {d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || 'Unknown Client'}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs ${
                      d.status === 'created' ? 'bg-blue-100 text-blue-700' :
                      d.status === 'po_submitted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {d.status || 'created'}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-600 space-y-1">
                    <p><span className="font-medium">Phone:</span> {d.customerPhone || d.dcOrderId?.contact_mobile || '-'}</p>
                    <p><span className="font-medium">Product:</span> {d.product || d.saleId?.product || (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? uniqueProductNames(d.dcOrderId.products).join(', ') : '-')}</p>
                    <p><span className="font-medium">Created:</span> {d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</p>
                  </div>
                </div>
                
                {d.status === 'po_submitted' && d.poPhotoUrl && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-neutral-900">PO</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => openSubmitDialog(d, true)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="relative">
                      {d.poPhotoUrl.startsWith('data:') || d.poPhotoUrl.startsWith('http') || d.poPhotoUrl.startsWith('/uploads/') ? (
                        <img 
                          src={resolveUploadUrl(d.poPhotoUrl)} 
                          alt="PO Document" 
                          className="w-full h-auto rounded border max-h-48 object-contain bg-neutral-50"
                        />
                      ) : (
                        <div className="w-full h-32 rounded border bg-neutral-50 flex items-center justify-center text-sm text-neutral-500">
                          PO Document
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2 pt-2 border-t">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full"
                    onClick={() => openAddProductsDialog(d)}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Add Products
                  </Button>
                  {d.status === 'created' && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => openSubmitDialog(d)}
                    >
                      Submit PO
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedDC?.status === 'po_submitted' ? 'Update Purchase Order (PO)' : 'Submit Purchase Order (PO)'}
            </DialogTitle>
            <DialogDescription>
              {selectedDC?.status === 'po_submitted' ? 'Update' : 'Upload'} PO photo for {selectedDC?.customerName || selectedDC?.saleId?.customerName || selectedDC?.dcOrderId?.school_name || 'this client'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>PO Photo URL or Upload File</Label>
              <Input
                type="text"
                placeholder="https://example.com/po.jpg"
                value={poPhotoUrl}
                onChange={(e) => setPoPhotoUrl(e.target.value)}
                className="mb-2"
              />
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
              {poPhotoUrl && (poPhotoUrl.startsWith('data:') || poPhotoUrl.startsWith('http') || poPhotoUrl.startsWith('/uploads/')) && (
                <div className="mt-2">
                  <img src={resolveUploadUrl(poPhotoUrl)} alt="PO Preview" className="max-w-full h-auto max-h-48 rounded border object-contain bg-neutral-50" />
                </div>
              )}
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any remarks about the PO..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={submitPO} disabled={submitting || !poPhotoUrl}>
              {submitting 
                ? (selectedDC?.status === 'po_submitted' ? 'Updating...' : 'Submitting...') 
                : (selectedDC?.status === 'po_submitted' ? 'Update PO' : 'Submit PO')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Products Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products</DialogTitle>
            <DialogDescription>
              Select products and enter details for {selectedDCForProducts?.customerName || selectedDCForProducts?.dcOrderId?.school_name || 'this client'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {productRows.map((row) => (
                <div key={row.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`product-${row.id}`}
                      checked={row.checked}
                      onCheckedChange={(checked) => handleProductCheck(row.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`product-${row.id}`}
                      className="text-sm font-semibold cursor-pointer flex-1"
                    >
                      {row.product}
                    </label>
                  </div>
                  
                  {row.checked && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 ml-6">
                      <div>
                        <Label className="text-xs">Class *</Label>
                        <Select value={row.klass} onValueChange={(v) => handleProductFieldChange(row.id, 'klass', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {getProductClasses(row.product).map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {productCategories(row.product).length > 0 && (
                        <div>
                          <Label className="text-xs">Category *</Label>
                          <Select value={row.productCategory} onValueChange={(v) => handleProductFieldChange(row.id, 'productCategory', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {productCategories(row.product).map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {getProductSpecs(row.product).length > 0 && (
                        <div>
                          <Label className="text-xs">Specs *</Label>
                          <Select value={row.specs} onValueChange={(v) => handleProductFieldChange(row.id, 'specs', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {getProductSpecs(row.product).map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">Price *</Label>
                        <Input
                          type="number"
                          value={row.price || ''}
                          onChange={(e) => handleProductFieldChange(row.id, 'price', Number(e.target.value) || 0)}
                          placeholder="0"
                          min="0"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Strength *</Label>
                        <Input
                          type="number"
                          value={row.strength || ''}
                          onChange={(e) => handleProductFieldChange(row.id, 'strength', Number(e.target.value) || 0)}
                          placeholder="0"
                          min="0"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          type="number"
                          value={row.total || 0}
                          disabled
                          className="h-8 text-xs bg-neutral-50"
                        />
                      </div>
                      {getProductLevels(row.product).length > 0 && (
                        <div>
                          <Label className="text-xs">Level *</Label>
                          <Select
                            value={row.level}
                            onValueChange={(v) => handleProductFieldChange(row.id, 'level', v)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {getProductLevels(row.product).map(level => (
                                <SelectItem key={level} value={level}>{level}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <Label>Purchase Order (PO) *</Label>
              <p className="text-xs text-neutral-600">Upload the school&apos;s PO. Products are sent for verification only with a PO.</p>
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onloadend = () => setProductPoUrl(reader.result as string)
                  reader.readAsDataURL(file)
                }}
              />
              {productPoUrl && <p className="text-xs font-medium text-green-700">PO attached.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProducts} disabled={submitting || !productPoUrl}>
              {submitting ? 'Saving...' : 'Add Products'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}