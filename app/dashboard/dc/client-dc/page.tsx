'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Package, Plus, Upload, X } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'

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
    status?: string // Status of the DcOrder (e.g., 'saved' for closed leads)
    school_type?: string // 'Existing' for renewal leads, otherwise 'New School'
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  createdAt?: string
  productDetails?: any[]
  _isConvertedLead?: boolean // Flag to indicate this is a converted lead (saved DcOrder)
}

export default function ClientDCPage() {
  const currentUser = getCurrentUser()
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  
  // Client DC Dialog (Full DC Management)
  const [clientDCDialogOpen, setClientDCDialogOpen] = useState(false)
  const [dcProductRows, setDcProductRows] = useState<Array<{
    id: string
    product: string
    class: string
    category: string
    quantity: number
    strength: number
    price: number
    total: number
    level: string
  }>>([])
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [dcPoPhotoUrl, setDcPoPhotoUrl] = useState('')
  const [savingClientDC, setSavingClientDC] = useState(false)
  
  const { productNames: availableProducts, getProductLevels, getDefaultLevel } = useProducts()
  
  // Get available levels for a specific product, default to L1 if product not found
  const getAvailableLevels = (product: string): string[] => {
    return getProductLevels(product)
  }
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const availableCategories = ['New Students', 'Existing Students', 'Both']
  const availableDCCategories = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

  const load = async () => {
    setLoading(true)
    try {
      // Load all DCs (clients) for the employee - including closed leads (saved DcOrders)
      const data = await apiRequest<DC[]>(`/dc/employee/my`)
      console.log('Loaded clients (all):', data)
      
      // Ensure data is an array before filtering
      const dataArray = Array.isArray(data) ? data : []
      
      // Filter: Show ALL closed leads (anything with dcOrderId) and clients with products
      // The backend already filters for this employee's clients, so we show:
      // 1. ALL items with dcOrderId (these are from closed leads) - show them all
      // 2. Clients with products added and submitted (for backward compatibility)
      const filteredClients = dataArray.filter((dc: DC) => {
        // If it has a dcOrderId (either as object or string ID), it's from a closed lead - show it
        const hasDcOrderId = dc.dcOrderId && (typeof dc.dcOrderId === 'object' || typeof dc.dcOrderId === 'string')
        
        if (hasDcOrderId) {
          const schoolName = typeof dc.dcOrderId === 'object' 
            ? dc.dcOrderId?.school_name 
            : dc.customerName
          console.log('Including closed lead:', schoolName || dc.customerName, {
            _isConvertedLead: dc._isConvertedLead,
            dcOrderIdStatus: typeof dc.dcOrderId === 'object' ? dc.dcOrderId?.status : 'unknown',
            dcStatus: dc.status,
            hasDcOrderId: true,
            dcOrderIdType: typeof dc.dcOrderId
          })
          return true
        }
        
        // For DCs without dcOrderId (from Sale), check if client has productDetails with at least one valid product
        // A valid product must have: product name, and either price or strength > 0
        const hasProducts = dc.productDetails && 
                           Array.isArray(dc.productDetails) && 
                           dc.productDetails.length > 0 &&
                           dc.productDetails.some((p: any) => {
                             return p && 
                                    p.product && 
                                    p.product.trim() !== '' && 
                                    (Number(p.price) > 0 || Number(p.strength) > 0)
                           })
        
        // Check if products have been submitted (status indicates submission after adding products)
        // Status 'created' means DC was just created (from closed lead) - show it if it has products
        // Status 'sent_to_manager' means products were added and submitted
        // Status 'po_submitted' means PO was submitted (products should already be added)
        // Other statuses like 'pending_dc', 'warehouse_processing', 'completed' also indicate submission
        const isSubmitted = dc.status === 'created' ||
                           dc.status === 'sent_to_manager' || 
                           dc.status === 'po_submitted' || 
                           dc.status === 'pending_dc' ||
                           dc.status === 'warehouse_processing' ||
                           dc.status === 'completed'
        
        // Show if products exist AND have been submitted (or just created with products)
        if (hasProducts && isSubmitted) {
          console.log('Including client with products:', dc.customerName, { status: dc.status, hasProducts })
        }
        return hasProducts && isSubmitted
      })
      
      console.log('Filtered clients (closed leads + with products):', filteredClients)
      
      // Check for newly converted DC from sessionStorage
      const newlyConvertedDCId = sessionStorage.getItem('newlyConvertedDCId');
      const newlyConvertedDC = sessionStorage.getItem('newlyConvertedDC');
      
      let finalClients = [...filteredClients];
      
      // If there's a newly converted DC that's not in the filtered list, add it
      if (newlyConvertedDCId && newlyConvertedDC) {
        const isAlreadyIncluded = filteredClients.some(dc => dc._id === newlyConvertedDCId);
        if (!isAlreadyIncluded) {
          try {
            const dc = JSON.parse(newlyConvertedDC);
            finalClients = [dc, ...filteredClients];
            console.log('Added newly converted DC from sessionStorage:', dc._id);
          } catch (e) {
            console.warn('Failed to parse newly converted DC from sessionStorage:', e);
          }
        }
        // Clear sessionStorage after using it
        sessionStorage.removeItem('newlyConvertedDCId');
        sessionStorage.removeItem('newlyConvertedDC');
      }
      
      setItems(finalClients)
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
      const errorMessage = e?.message || 'Unknown error'
      // Provide more context for database connection errors
      if (errorMessage.includes('Database connection') || 
          errorMessage.includes('MongoDB') ||
          (errorMessage.includes('connection') && errorMessage.includes('timed out')) ||
          errorMessage.includes('Service Unavailable')) {
        toast.error('Database connection failed. Please check your server connection and try again.')
      } else if (errorMessage.includes('filter is not a function')) {
        toast.error('The API returned invalid data format. Please check the server response.')
      } else {
        toast.error(`Error loading DCs: ${errorMessage}`)
      }
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // FIRST: Check sessionStorage and add the DC immediately (before load() clears items)
    console.log('🔍 Checking sessionStorage for newly converted DC...');
    const newlyConvertedDCId = sessionStorage.getItem('newlyConvertedDCId');
    const newlyConvertedDC = sessionStorage.getItem('newlyConvertedDC');
    
    console.log('📋 SessionStorage check result:', {
      hasId: !!newlyConvertedDCId,
      hasData: !!newlyConvertedDC,
      id: newlyConvertedDCId
    });
    
    if (newlyConvertedDCId && newlyConvertedDC) {
      (async () => {
        try {
          const dc = JSON.parse(newlyConvertedDC);
          console.log('📥 Found newly converted DC in sessionStorage:', {
            id: dc._id,
            hasDcOrderId: !!dc.dcOrderId,
            dcOrderIdType: typeof dc.dcOrderId,
            dcOrderIdValue: dc.dcOrderId
          });
          
          // Try to fetch the full DC from API first (with populated fields)
          // This ensures we have the correct structure even if sessionStorage data is incomplete
          try {
            const fullDC = await apiRequest<DC>(`/dc/${newlyConvertedDCId}`);
            console.log('✅ Fetched full DC from API:', {
              id: fullDC._id,
              hasDcOrderId: !!fullDC.dcOrderId,
              dcOrderIdType: typeof fullDC.dcOrderId,
              customerName: fullDC.customerName || fullDC.dcOrderId?.school_name
            });
            
            // Ensure the DC has the proper structure for the filter
            const dcWithStructure: DC = {
              ...fullDC,
              _isConvertedLead: true,
              // Ensure it has customerName for display
              customerName: fullDC.customerName || fullDC.dcOrderId?.school_name || 'Unknown Client'
            };
            
            // Add it to the list immediately
            setItems(prevItems => {
              const exists = prevItems.some(item => item._id === dcWithStructure._id);
              if (!exists) {
                console.log('➕ Adding newly converted DC to list (from API)');
                return [dcWithStructure, ...prevItems];
              }
              console.log('ℹ️ DC already in list');
              return prevItems;
            });
          } catch (apiErr) {
            // If API fetch fails (timeout), use sessionStorage data as fallback
            console.warn('⚠️ Could not fetch full DC from API, using sessionStorage data:', apiErr);
            
            // Ensure the DC has the proper structure for the filter
            const dcWithStructure: DC = {
              ...dc,
              // Ensure dcOrderId is an object (required by the filter)
              dcOrderId: dc.dcOrderId 
                ? (typeof dc.dcOrderId === 'object' ? dc.dcOrderId : { _id: dc.dcOrderId, school_name: dc.customerName || 'Unknown' })
                : undefined,
              _isConvertedLead: true,
              // Ensure it has customerName for display
              customerName: dc.customerName || dc.dcOrderId?.school_name || 'Unknown Client'
            };
            
            console.log('📦 Prepared DC for display (from sessionStorage):', {
              id: dcWithStructure._id,
              hasDcOrderId: !!dcWithStructure.dcOrderId,
              dcOrderIdType: typeof dcWithStructure.dcOrderId,
              customerName: dcWithStructure.customerName
            });
            
            // Add it to the list immediately (even if query timed out)
            setItems(prevItems => {
              const exists = prevItems.some(item => item._id === dcWithStructure._id);
              if (!exists) {
                console.log('➕ Adding newly converted DC to list (from sessionStorage)');
                return [dcWithStructure, ...prevItems];
              }
              console.log('ℹ️ DC already in list');
              return prevItems;
            });
          }
          
          // Clear sessionStorage AFTER adding to list
          sessionStorage.removeItem('newlyConvertedDCId');
          sessionStorage.removeItem('newlyConvertedDC');
        } catch (err) {
          console.error('Failed to parse newly converted DC:', err);
        }
      })();
    }
    
    // THEN: Load all DCs from API (this will merge with sessionStorage items if they exist)
    load()
  }, [])

  const openClientDCDialog = async (dc: DC) => {
    setSelectedDC(dc)
    
    // Determine category automatically based on school_type from dcOrderId
    // If school_type is 'Existing', it's a renewal/existing school, otherwise it's a new school
    const autoCategory = dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId.school_type === 'Existing'
      ? 'Existing School'
      : 'New School'
    
    // Load full DC details
    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      
      // Load existing product details - only show products that were added via "Add Products"
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        // Only show products that were actually added (have product name and details)
        const addedProducts = fullDC.productDetails.filter((p: any) => p.product && (p.price > 0 || p.strength > 0))
        if (addedProducts.length > 0) {
          console.log('Loading products for Client DC:', JSON.stringify(addedProducts, null, 2))
          setDcProductRows(addedProducts.map((p: any, idx: number) => {
            // Read values directly - preserve 0 values, only default if null/undefined
            const priceNum = p.price !== null && p.price !== undefined ? Number(p.price) : 0
            const strengthNum = p.strength !== null && p.strength !== undefined ? Number(p.strength) : 0
            const quantityNum = p.quantity !== null && p.quantity !== undefined ? Number(p.quantity) : strengthNum
            const totalNum = p.total !== null && p.total !== undefined && p.total !== 0
              ? Number(p.total)
              : (priceNum * strengthNum)
            
            const row = {
              id: String(idx + 1),
              product: p.product || '',
              class: p.class || '1',
              category: autoCategory, // Use auto-determined category
              quantity: quantityNum,
              strength: strengthNum,
              price: priceNum,
              total: totalNum,
              level: p.level || getDefaultLevel(p.product || 'Abacus'),
            }
            console.log(`Client DC Product ${idx + 1}:`, {
              raw: { price: p.price, total: p.total, strength: p.strength },
              converted: { price: priceNum, total: totalNum, strength: strengthNum },
            })
            return row
          }))
        } else {
          // No products added yet - show empty state
          setDcProductRows([])
        }
      } else {
        // No productDetails at all - show empty state
        setDcProductRows([])
      }
      
      // Load DC details
      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(fullDC.dcRemarks || '')
      setDcCategory(fullDC.dcCategory || '')
      setDcNotes(fullDC.dcNotes || '')
      setDcPoPhotoUrl(fullDC.poPhotoUrl || '')
    } catch (e) {
      console.error('Failed to load DC details:', e)
      // Initialize with empty state - no products until added via "Add Products"
      setDcProductRows([])
      setDcDate('')
      setDcRemarks('')
      setDcCategory('')
      setDcNotes('')
      setDcPoPhotoUrl(dc.poPhotoUrl || '')
    }
    
    setClientDCDialogOpen(true)
  }

  const saveClientRequest = async () => {
    // Save without submitting
    if (!selectedDC) return

    setSavingClientDC(true)
    try {
      // Prepare product details
      const productDetails = dcProductRows.length > 0 
        ? dcProductRows.map(row => ({
            product: row.product || '',
            class: row.class || '1',
            category: row.category || 'New School',
            quantity: Number(row.quantity) || 0,
            strength: Number(row.strength) || 0,
            price: Number(row.price) || 0,
            total: Number(row.total) || (Number(row.price) || 0) * (Number(row.strength) || 0),
            level: row.level || getDefaultLevel(row.product || 'Abacus'),
          }))
        : undefined

      const totalQuantity = dcProductRows.length > 0 
        ? dcProductRows.reduce((sum, p) => sum + (p.quantity || 0), 0)
        : undefined

      // Update DC without changing status
      const updatePayload: any = {}

      if (productDetails !== undefined) {
        updatePayload.productDetails = productDetails
      }
      if (totalQuantity !== undefined) {
        updatePayload.requestedQuantity = totalQuantity
      }

      // Update PO photo if provided
      if (dcPoPhotoUrl) {
        updatePayload.poPhotoUrl = dcPoPhotoUrl
        updatePayload.poDocument = dcPoPhotoUrl
      }

      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      })

      toast.success('Client Request saved successfully!')
      setClientDCDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save Client Request')
    } finally {
      setSavingClientDC(false)
    }
  }

  const requestClientDC = async () => {
    if (!selectedDC) return

    // Validate products - must have at least one product
    if (dcProductRows.length === 0) {
      toast.error('Please add at least one product before requesting')
      return
    }

    const invalidProducts = dcProductRows.filter(p => !p.product || !p.quantity || !p.strength)
    if (invalidProducts.length > 0) {
      toast.error('Please fill in Product, Quantity, and Strength for all products')
      return
    }

    setSavingClientDC(true)
    try {
      // Prepare product details
      const productDetails = dcProductRows.map(row => ({
        product: row.product || '',
        class: row.class || '1',
        category: row.category || 'New School',
        quantity: Number(row.quantity) || 0,
        strength: Number(row.strength) || 0,
        price: Number(row.price) || 0,
        total: Number(row.total) || (Number(row.price) || 0) * (Number(row.strength) || 0),
        level: row.level || getDefaultLevel(row.product || 'Abacus'),
      }))

      const totalQuantity = dcProductRows.reduce((sum, p) => sum + (p.quantity || 0), 0)

      // Update DC but keep status as 'created' (or 'po_submitted' if PO provided)
      // This keeps it in Closed Sales instead of going to Pending DC
      // Only the DcOrder status will be updated to 'dc_requested' to appear in Closed Sales
      const updatePayload: any = {
        productDetails: productDetails,
        requestedQuantity: totalQuantity,
        // Don't change DC status to 'sent_to_manager' - keep it as 'created' so it stays in Closed Sales
        // status: 'sent_to_manager', // Removed - this was sending it to Pending DC
      }

      // Update PO photo if provided
      if (dcPoPhotoUrl) {
        updatePayload.poPhotoUrl = dcPoPhotoUrl
        updatePayload.poDocument = dcPoPhotoUrl
        // If PO is provided, set status to 'po_submitted' instead of 'created'
        updatePayload.status = 'po_submitted'
      }

      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      })

      // Update the related DcOrder status to 'dc_requested' and store request data
      // This makes it appear in Closed Sales for Admin/Coordinator to review
      if (selectedDC.dcOrderId) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          
          const currentUser = getCurrentUser()
          
          console.log('🔄 Updating DcOrder status to dc_requested with request data:', dcOrderId)
          
          // Store the request data in DcOrder so Admin/Coordinator can see it in Closed Sales
          const updateResult = await apiRequest(`/dc-orders/${dcOrderId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
              status: 'dc_requested',
              dcRequestData: {
                // Store product details from the request
                productDetails: productDetails,
                requestedQuantity: totalQuantity,
                // Store employee ID who made the request
                employeeId: currentUser?._id || selectedDC.employeeId,
                // Store any PO photo URL if provided
                poPhotoUrl: dcPoPhotoUrl || undefined,
                // Store timestamp
                requestedAt: new Date().toISOString(),
              }
            }),
          })
          
          console.log('✅ Updated DcOrder status to dc_requested:', {
            dcOrderId,
            newStatus: updateResult?.status,
            schoolName: updateResult?.school_name
          })
        } catch (dcOrderErr: any) {
          console.error('❌ Failed to update DcOrder status:', {
            error: dcOrderErr?.message,
            dcOrderId: typeof selectedDC.dcOrderId === 'object' 
              ? selectedDC.dcOrderId._id 
              : selectedDC.dcOrderId
          })
          // Continue even if DcOrder update fails, but show warning
          toast.warning('DC updated but failed to update DcOrder status. Please check Closed Sales manually.')
        }
      } else {
        console.warn('⚠️ No dcOrderId found on DC, cannot update DcOrder status')
      }

      // If PO photo is provided and status is created, also submit PO
      if (dcPoPhotoUrl && selectedDC.status === 'created') {
        try {
          await apiRequest(`/dc/${selectedDC._id}/submit-po`, {
            method: 'POST',
            body: JSON.stringify({ 
              poPhotoUrl: dcPoPhotoUrl,
              remarks: 'PO submitted via Client Request'
            }),
          })
        } catch (poErr) {
          console.error('PO submission failed:', poErr)
          // Continue even if PO submission fails
        }
      }

      toast.success('Client Request submitted successfully! It will appear in Closed Sales for Admin/Coordinator to review and raise DC.')
      setClientDCDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit Client Request')
    } finally {
      setSavingClientDC(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Client Request</h1>
          <p className="text-sm text-neutral-600 mt-1">Manage products, PO photos, and request details for your clients</p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4">
            <p className="text-neutral-600">No clients found with products added.</p>
            <p className="text-sm text-neutral-500 mt-2">
              Closed leads and clients with products added and submitted will appear here.
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              Closed leads appear here automatically. You can add products and manage client details directly from this page.
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
                      d.status === 'sent_to_manager' ? 'bg-purple-100 text-purple-700' :
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
                
                {d.poPhotoUrl && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm text-neutral-900">PO</h4>
                    </div>
                    <div className="relative">
                      {d.poPhotoUrl.startsWith('data:') || d.poPhotoUrl.startsWith('http') ? (
                        <img 
                          src={d.poPhotoUrl} 
                          alt="PO Document" 
                          className="w-full h-auto rounded border max-h-32 object-contain bg-neutral-50"
                        />
                      ) : (
                        <div className="w-full h-24 rounded border bg-neutral-50 flex items-center justify-center text-sm text-neutral-500">
                          PO Document
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="pt-2 border-t">
                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => openClientDCDialog(d)}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Manage DC
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Client DC Dialog - Full DC Management */}
      <Dialog open={clientDCDialogOpen} onOpenChange={setClientDCDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Request - Manage Products & Details</DialogTitle>
            <DialogDescription>
              Manage products, PO photo, and request details for {selectedDC?.customerName || selectedDC?.dcOrderId?.school_name || 'this client'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            {/* PO Photo Section */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">PO Photo</Label>
                {dcPoPhotoUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDcPoPhotoUrl('')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
              {dcPoPhotoUrl ? (
                <div className="relative">
                  {dcPoPhotoUrl.toLowerCase().endsWith('.pdf') || 
                   dcPoPhotoUrl.includes('application/pdf') || 
                   dcPoPhotoUrl.includes('.pdf') ||
                   (dcPoPhotoUrl.startsWith('data:') && dcPoPhotoUrl.includes('application/pdf')) ||
                   (dcPoPhotoUrl.startsWith('http') && dcPoPhotoUrl.toLowerCase().includes('.pdf')) ? (
                    <div className="border rounded-lg p-4 bg-neutral-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">PO Document (PDF)</span>
                        <a 
                          href={dcPoPhotoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                          Open PDF in New Tab
                        </a>
                      </div>
                      {dcPoPhotoUrl.startsWith('data:') ? (
                        <iframe 
                          src={dcPoPhotoUrl} 
                          className="w-full h-96 rounded border"
                          title="PO Document"
                        />
                      ) : (
                        <iframe 
                          src={`${dcPoPhotoUrl}#toolbar=0`} 
                          className="w-full h-96 rounded border"
                          title="PO Document"
                        />
                      )}
                    </div>
                  ) : (
                    <img 
                      src={dcPoPhotoUrl} 
                      alt="PO Document" 
                      className="w-full h-auto rounded border max-h-64 object-contain bg-neutral-50"
                      onError={(e) => {
                        // If image fails to load, try as PDF
                        const target = e.target as HTMLImageElement
                        if (!target.src.includes('.pdf') && !target.src.includes('application/pdf')) {
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = `
                              <div class="border rounded-lg p-4 bg-neutral-50">
                                <div class="flex items-center justify-between mb-2">
                                  <span class="text-sm font-medium">PO Document</span>
                                  <a href="${target.src}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 text-sm underline">
                                    Open Document
                                  </a>
                                </div>
                                <iframe src="${target.src}" class="w-full h-96 rounded border" title="PO Document"></iframe>
                              </div>
                            `
                          }
                        }
                      }}
                    />
                  )}
                  <div className="mt-2">
                    <Input
                      type="text"
                      placeholder="PO Photo URL"
                      value={dcPoPhotoUrl}
                      onChange={(e) => setDcPoPhotoUrl(e.target.value)}
                      className="mb-2"
                    />
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setDcPoPhotoUrl(reader.result as string)
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                  <Input
                    type="text"
                    placeholder="PO Photo URL"
                    value={dcPoPhotoUrl}
                    onChange={(e) => setDcPoPhotoUrl(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setDcPoPhotoUrl(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Products Table */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Products & Quantities</Label>
                <div className="flex gap-2">
                  {dcProductRows.length === 0 && (
                    <p className="text-sm text-neutral-500 mr-2">Add products using the form below</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Determine category automatically based on selectedDC's school_type
                      const autoCategory = selectedDC?.dcOrderId && typeof selectedDC.dcOrderId === 'object' && selectedDC.dcOrderId.school_type === 'Existing'
                        ? 'Existing School'
                        : 'New School'
                      
                      setDcProductRows([...dcProductRows, {
                        id: Date.now().toString(),
                        product: 'Abacus',
                        class: '1',
                        category: autoCategory,
                        quantity: 0,
                        strength: 0,
                        price: 0,
                        total: 0,
                        level: getDefaultLevel('Abacus'),
                      }])
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Row
                  </Button>
                </div>
              </div>
              
              {dcProductRows.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm">No products added yet</p>
                  <p className="text-xs mt-1">Use the "Add Product" button below to add products to this client</p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-100 border-b">
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Class</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Category</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Qty</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Strength</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Price</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Total</th>
                      <th className="py-3 px-4 text-left text-sm font-semibold border-r">Level</th>
                      <th className="py-3 px-4 text-center text-sm font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcProductRows.map((row, idx) => (
                      <tr key={row.id} className="border-b">
                        <td className="py-3 px-4 border-r">
                          <Select value={row.product} onValueChange={(v) => {
                            const updated = [...dcProductRows]
                            updated[idx].product = v
                            // Update level to default for the selected product
                            updated[idx].level = getDefaultLevel(v)
                            setDcProductRows(updated)
                          }}>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProducts.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-2 px-3 border-r">
                          <Select value={row.class} onValueChange={(v) => {
                            const updated = [...dcProductRows]
                            updated[idx].class = v
                            setDcProductRows(updated)
                          }}>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableClasses.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Input
                            type="text"
                            className="h-10 text-sm bg-neutral-50"
                            value={row.category}
                            readOnly
                            disabled
                          />
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Input
                            type="number"
                            className="h-10 text-sm"
                            value={row.quantity || ''}
                            onChange={(e) => {
                              const updated = [...dcProductRows]
                              updated[idx].quantity = Number(e.target.value) || 0
                              setDcProductRows(updated)
                            }}
                            placeholder="0"
                            min="0"
                          />
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Input
                            type="number"
                            className="h-10 text-sm"
                            value={row.strength || ''}
                            onChange={(e) => {
                              const updated = [...dcProductRows]
                              updated[idx].strength = Number(e.target.value) || 0
                              updated[idx].total = updated[idx].price * updated[idx].strength
                              setDcProductRows(updated)
                            }}
                            placeholder="0"
                            min="0"
                          />
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Input
                            type="number"
                            className="h-10 text-sm"
                            value={row.price || ''}
                            onChange={(e) => {
                              const updated = [...dcProductRows]
                              updated[idx].price = Number(e.target.value) || 0
                              updated[idx].total = updated[idx].price * updated[idx].strength
                              setDcProductRows(updated)
                            }}
                            placeholder="0"
                            min="0"
                          />
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Input
                            type="number"
                            className="h-10 text-sm bg-neutral-50"
                            value={row.total || 0}
                            disabled
                            placeholder="Auto"
                          />
                        </td>
                        <td className="py-3 px-4 border-r">
                          <Select value={row.level} onValueChange={(v) => {
                            const updated = [...dcProductRows]
                            updated[idx].level = v
                            setDcProductRows(updated)
                          }}>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableLevels(row.product).map(level => (
                                <SelectItem key={level} value={level}>{level}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {dcProductRows.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 h-10 w-10 p-0"
                              onClick={() => {
                                setDcProductRows(dcProductRows.filter((_, i) => i !== idx))
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDCDialogOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={saveClientRequest} disabled={savingClientDC}>
              {savingClientDC ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={requestClientDC} disabled={savingClientDC}>
              {savingClientDC ? 'Submitting...' : 'Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

