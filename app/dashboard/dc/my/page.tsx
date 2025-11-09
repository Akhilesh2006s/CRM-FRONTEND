'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Pencil, Package, Plus, Upload, X } from 'lucide-react'

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
    contact_person?: string
    contact_mobile?: string
    email?: string
    products?: any
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
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
  }>>([])
  
  const availableProducts = ['ABACUS', 'VedicMath', 'EELL', 'IIT', 'CODING', 'MathLab', 'CodeChamp']
  const availableLevels = ['L1', 'L2', 'L3', 'L4', 'L5']

  const load = async () => {
    setLoading(true)
    try {
      // Load all DCs (clients) for the employee - including converted leads
      const data = await apiRequest<DC[]>(`/dc/employee/my`)
      console.log('Loaded clients:', data)
      // Show DCs with 'created' status (ready for PO submission) and 'po_submitted' status (PO already submitted)
      const clientDCs = data.filter(dc => dc.status === 'created' || dc.status === 'po_submitted')
      console.log('Filtered clients:', clientDCs)
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
          level: p.level || 'L2',
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
          level: 'L2',
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
        level: 'L2',
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

  const handleProductFieldChange = (productId: string, field: 'price' | 'strength' | 'level', value: string | number) => {
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

    // Validate that all checked products have price and strength
    const invalidProducts = checkedProducts.filter(p => !p.price || !p.strength)
    if (invalidProducts.length > 0) {
      alert('Please fill in Price and Strength for all selected products')
      return
    }

    setSubmitting(true)
    try {
      // Prepare product details in the format expected by backend
      // Include all fields that employees might have entered
      const productDetails = checkedProducts.map(row => ({
        product: row.product,
        class: '1', // Default class if not provided
        category: 'New Students', // Default category if not provided
        productName: '', // Product name can be empty initially
        quantity: row.strength || row.quantity || 0, // Using strength as quantity
        strength: row.strength || 0,
        price: Number(row.price) || 0, // Ensure it's a number
        total: Number(row.total) || (Number(row.price) || 0) * (Number(row.strength) || 0), // Calculate if missing
        level: row.level || 'L2',
      }))
      
      console.log('Saving productDetails from employee:', productDetails)

      // Update DC with product details and move to closed sales for verification
      await apiRequest(`/dc/${selectedDCForProducts._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails,
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
      // For po_submitted status, we need to update the PO
      // The backend submit-po endpoint only works for 'created' status
      // So we'll use the update endpoint for editing
      if (selectedDC.status === 'po_submitted') {
        // Update existing PO - we'll need to check if backend supports this
        // For now, we'll use the same endpoint but handle it differently
        await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify({ poPhotoUrl, poDocument: poPhotoUrl, deliveryNotes: remarks }),
        })
        alert('PO updated successfully!')
      } else {
      await apiRequest(`/dc/${selectedDC._id}/submit-po`, {
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
              <Card key={d._id} className="p-4 space-y-3">
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
                    <p><span className="font-medium">Product:</span> {d.product || d.saleId?.product || (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '-')}</p>
                    <p><span className="font-medium">Created:</span> {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}</p>
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
                      {d.poPhotoUrl.startsWith('data:') || d.poPhotoUrl.startsWith('http') ? (
                        <img 
                          src={d.poPhotoUrl} 
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
              {poPhotoUrl && (poPhotoUrl.startsWith('data:') || poPhotoUrl.startsWith('http')) && (
                <div className="mt-2">
                  <img src={poPhotoUrl} alt="PO Preview" className="max-w-full h-auto max-h-48 rounded border object-contain bg-neutral-50" />
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
                        <Label className="text-xs">Price</Label>
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
                        <Label className="text-xs">Strength</Label>
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
                      <div>
                        <Label className="text-xs">Level</Label>
                        <Select
                          value={row.level}
                          onValueChange={(v) => handleProductFieldChange(row.id, 'level', v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableLevels.map(level => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveProducts} disabled={submitting}>
              {submitting ? 'Saving...' : 'Add Products'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}