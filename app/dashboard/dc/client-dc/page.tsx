'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import {
  STUDENT_TYPE_OPTIONS,
  STUDENT_TYPE_PLACEHOLDER,
  followUpStudentTypeSelectValue,
  parseFollowUpStudentTypeSelectValue,
  isShortageStudentType,
} from '@/lib/dcStudentTypeOptions'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Package, Plus, Upload, X, Search, CreditCard, FileText, PlusCircle, Filter, Calendar, RefreshCw } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import { applyPaymentDivisorsToBreakdown } from '@/lib/dcPaymentDivisors'
import { normalizeProductTerm, termFromLevelLabel } from '@/lib/productTerm'
import {
  buildClientDCProductRows,
  buildEditPOProductRows,
  computeEditPOTotalAmount,
  resolveProductSubject,
  type EditPOProductRow,
  type ResolveClientDCRowOpts,
} from '@/lib/clientDcProductRows'
import { isTransportComplete } from '@/lib/dcTransport'
import { useRouter } from 'next/navigation'

type DC = {
  _id: string
  parentDcId?: string | { _id: string; dc_code?: string }
  clusterId?: string
  dcType?: 'normal' | 'shortage'
  fulfillmentStatus?: 'full' | 'partial' | 'completed_via_shortage'
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  dcOrderId?: {
    _id: string
    school_name?: string
    school_code?: string
    dc_code?: string
    contact_person?: string
    contact_mobile?: string
    email?: string
    products?: any
    status?: string // Status of the DcOrder (e.g., 'saved' for closed leads)
    school_type?: string // 'Existing' for renewal leads, otherwise 'New School'
    createdAt?: string // Date when lead was turned to client
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
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedProduct, setSelectedProduct] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [viewingPoUrl, setViewingPoUrl] = useState<string | null>(null)
  const [viewingPoOpen, setViewingPoOpen] = useState(false)
  
  // Client DC Dialog (Full DC Management)
  const [clientDCDialogOpen, setClientDCDialogOpen] = useState(false)
  const [dcProductRows, setDcProductRows] = useState<Array<{
    id: string
    product: string
    class: string
    // Product category for the SKU (e.g. Risers+, Winners+), not "Existing/New School"
    productCategory?: string
    specs: string
    quantity: number
    strength: number
    level: string
    term: string
  }>>([])
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [dcPoPhotoUrl, setDcPoPhotoUrl] = useState('')
  /** Resolved API origin for PO preview (never raw :5000 /uploads URLs). */
  const dcPoDisplayUrl = dcPoPhotoUrl ? resolveUploadUrl(dcPoPhotoUrl) : ''
  const [savingClientDC, setSavingClientDC] = useState(false)
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false)
  const [shortageParentDC, setShortageParentDC] = useState<DC | null>(null)
  const [shortageNotes, setShortageNotes] = useState('')
  const [savingShortage, setSavingShortage] = useState(false)
  const [shortageRows, setShortageRows] = useState<Array<{
    id: string
    product: string
    class: string
    category: string
    term: string
    productCategory?: string
    orderedQuantity: number
    deliveredQuantity: number
    shortageQuantity: number
  }>>([])
  const [followUpStudentTypeByDcId, setFollowUpStudentTypeByDcId] = useState<Record<string, string>>({})
  // Invoice view state
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceData, setInvoiceData] = useState<{
    schoolInfo: any
    paymentBreakdown: any[]
    totalAmount: number
    dcDate?: string
    previousDue?: number
    totalPaidAsOn?: number
    totalReturnValue?: number
    totalDue?: number
    otherCharges?: number
    otherChargesRemarks?: string
    discount?: number
    discountRemarks?: string
    financialYear?: string
    invoicePending?: boolean
    invoicePendingMessage?: string
  } | null>(null)
  // Delivery and Address data (read-only)
  const [deliveryAddress, setDeliveryAddress] = useState({
    property_number: '',
    floor: '',
    tower_block: '',
    nearby_landmark: '',
    area: '',
    city: '',
    pincode: '',
  })
  // DcOrder data for display (read-only) - includes all fields from Edit PO
  const [dcOrderData, setDcOrderData] = useState<any>(null)
  
  // Edit PO Dialog state
  const [editPODialogOpen, setEditPODialogOpen] = useState(false)
  const [selectedDcOrder, setSelectedDcOrder] = useState<any>(null)
  const [editFormData, setEditFormData] = useState({
    school_name: '',
    contact_person: '',
    contact_mobile: '',
    contact_person2: '',
    contact_mobile2: '',
    email: '',
    address: '',
    school_type: '',
    zone: '',
    location: '',
    products: [] as any[],
    pod_proof_url: '',
    remarks: '',
    total_amount: 0,
    // Transport fields
    transport_name: '',
    transport_location: '',
    transportation_landmark: '',
    pincode: '',
  })
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [uploadingPO, setUploadingPO] = useState(false)
  const [editProductRows, setEditProductRows] = useState<EditPOProductRow[]>([])
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false)
  const [addNewProductDialogOpen, setAddNewProductDialogOpen] = useState(false)
  const [originalPOProducts, setOriginalPOProducts] = useState<string[]>([])
  // Track original state for change detection
  const [originalPDFUrl, setOriginalPDFUrl] = useState<string>('')
  const [originalProductNames, setOriginalProductNames] = useState<string[]>([])
  // Track which DCs have pending changes (PDF changed or new products added)
  const [dcsWithPendingChanges, setDcsWithPendingChanges] = useState<Set<string>>(new Set())
  // Track DCs with pending edit requests from backend
  const [dcsWithPendingEditRequests, setDcsWithPendingEditRequests] = useState<Set<string>>(new Set())
  const [dcsWithCompleteTransport, setDcsWithCompleteTransport] = useState<Set<string>>(new Set())
  // Track current DC being edited
  const [currentEditingDCId, setCurrentEditingDCId] = useState<string | null>(null)
  
  const {
    productNames: availableProducts,
    getProductLevels,
    getDefaultLevel,
    getProductSpecs,
    getProductSubjects,
    getProductCategories,
    hasProductCategories,
    getCalculationType,
    getCatalogFallbackCount,
  } = useProducts()
  
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
      
      // Check pending edit requests and transport readiness per DcOrder (in parallel)
      const dcOrderCheckPromises = finalClients.map(async (dc) => {
        let dcOrderId = null
        if (dc.dcOrderId) {
          if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId._id) {
            dcOrderId = dc.dcOrderId._id
          } else if (typeof dc.dcOrderId === 'string') {
            dcOrderId = dc.dcOrderId
          }
        }
        if (!dcOrderId) {
          return { dcId: dc._id, pendingEdit: false, transportComplete: false }
        }

        try {
          const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          const pendingEdit = !!(dcOrder.pendingEdit && dcOrder.pendingEdit.status === 'pending')
          if (pendingEdit) {
            console.log('DC has pending edit request:', dc._id, dcOrder.pendingEdit)
          }
          return {
            dcId: dc._id,
            pendingEdit,
            transportComplete: isTransportComplete(dcOrder),
          }
        } catch (e) {
          console.warn('Failed to check DcOrder for DC:', dc._id, e)
          return { dcId: dc._id, pendingEdit: false, transportComplete: false }
        }
      })

      const dcOrderCheckResults = await Promise.all(dcOrderCheckPromises)
      setDcsWithPendingEditRequests(
        new Set(dcOrderCheckResults.filter((r) => r.pendingEdit).map((r) => r.dcId))
      )
      setDcsWithCompleteTransport(
        new Set(dcOrderCheckResults.filter((r) => r.transportComplete).map((r) => r.dcId))
      )
      
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

  // Watch editProductRows for new products and mark DC as having changes
  useEffect(() => {
    if (!currentEditingDCId || editProductRows.length === 0) return
    
    const currentProductNames = editProductRows
      .map(row => row.product_name)
      .filter(name => name && name.trim() !== '')
    
    const hasNewProducts = currentProductNames.some(name => !originalProductNames.includes(name))
    
    if (hasNewProducts) {
      setDcsWithPendingChanges(prev => new Set(prev).add(currentEditingDCId))
    }
  }, [editProductRows, currentEditingDCId, originalProductNames])

  // Keep header total in sync with product rows while Edit PO is open
  useEffect(() => {
    if (!editPODialogOpen) return
    const total = computeEditPOTotalAmount(editProductRows)
    setEditFormData((prev) =>
      prev.total_amount === total ? prev : { ...prev, total_amount: total }
    )
  }, [editProductRows, editPODialogOpen])

  const getProgramInvoiceGate = async (
    dcOrderId?: string | null,
    productName?: string | null
  ): Promise<{ invoicePending: boolean; message?: string }> => {
    if (!dcOrderId || !productName) return { invoicePending: false }
    try {
      const status = await apiRequest<any>(
        `/program-billing/status/by-dc-order-product?dcOrderId=${encodeURIComponent(
          dcOrderId
        )}&product=${encodeURIComponent(productName)}`
      )
      if (status?.exists && status?.shouldGenerateInvoice === false) {
        return {
          invoicePending: true,
          message: `Invoice not generated yet. Delivered ${status.deliveredLevelsCount || 0} of ${status.totalLevels || 0} required terms.`,
        }
      }
      return { invoicePending: false }
    } catch {
      return { invoicePending: false }
    }
  }

  const openInvoiceView = async (dc: DC) => {
    try {
      // Get DC details
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      
      // Get school/client information
      let schoolInfo: any = {}
      let paymentBreakdown: any[] = []
      let totalAmount = 0
      let dcOrder: any = null
      
      if (dc.dcOrderId) {
        let dcOrderId = null
        if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId._id) {
          dcOrderId = dc.dcOrderId._id
        } else if (typeof dc.dcOrderId === 'string') {
          dcOrderId = dc.dcOrderId
        }
        if (dcOrderId) {
          dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          
          schoolInfo = {
            customerName: dcOrder.school_name || dc.customerName || '',
            schoolCode: dcOrder.school_code || '',
            contactName: dcOrder.contact_person || '',
            mobileNumber: dcOrder.contact_mobile || dc.customerPhone || '',
            location: dcOrder.location || dcOrder.area || '',
            zone: dcOrder.zone || '',
            email: dcOrder.email || dc.customerEmail || '',
          }
        } else {
          // If dcOrderId is null, use DC data directly
          schoolInfo = {
            customerName: dc.customerName || '',
            mobileNumber: dc.customerPhone || '',
          }
        }
      } else {
        schoolInfo = {
          customerName: dc.customerName || '',
          mobileNumber: dc.customerPhone || '',
        }
      }
      
      // Always recalculate from DcOrder products (most accurate) - don't rely on stored payment breakdown
      // This ensures prices are always correct even if DcOrder was updated after payment creation
      console.log('🔍 Invoice View - DcOrder products:', JSON.stringify(dcOrder?.products, null, 2))
      console.log('🔍 Invoice View - DC productDetails:', JSON.stringify(fullDC.productDetails, null, 2))
      
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        if (dcOrder && dcOrder.products && Array.isArray(dcOrder.products) && dcOrder.products.length > 0) {
          console.log('🔍 Matching - DcOrder has', dcOrder.products.length, 'products, DC has', fullDC.productDetails.length, 'productDetails')
          // Match DC productDetails with DcOrder products by INDEX/POSITION first (most accurate)
          // This ensures each row gets its corresponding price from Edit PO
          const usedIndices = new Set<number>()
          
          paymentBreakdown = fullDC.productDetails.map((pd: any, index: number) => {
            // First try to match by index/position (most accurate)
            let matchingProduct: any = null
            let matchingIndex = -1
            
            // Try exact index match first
            if (index < dcOrder.products.length && !usedIndices.has(index)) {
              matchingProduct = dcOrder.products[index]
              matchingIndex = index
              usedIndices.add(index)
              console.log(`Invoice Product[${index}]: Matched by exact index -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
            } else {
              // If exact index is used or out of bounds, find unused product with matching name
              const dcProductName = (pd.product || '').toLowerCase().trim()
              
              // First try to find unused product with exact name match
              for (let i = 0; i < dcOrder.products.length; i++) {
                if (usedIndices.has(i)) continue
                
                const p = dcOrder.products[i]
                const orderProductName = (p.product_name || '').toLowerCase().trim()
                
                if (dcProductName === orderProductName) {
                  matchingProduct = p
                  matchingIndex = i
                  usedIndices.add(i)
                  console.log(`Invoice Product[${index}]: Matched by name (exact) at index ${i} -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                  break
                }
              }
              
              // If still no match, try partial name match
              if (!matchingProduct) {
                for (let i = 0; i < dcOrder.products.length; i++) {
                  if (usedIndices.has(i)) continue
                  
                  const p = dcOrder.products[i]
                  const orderProductName = (p.product_name || '').toLowerCase().trim()
                  
                  if (dcProductName.includes(orderProductName) || orderProductName.includes(dcProductName)) {
                    matchingProduct = p
                    matchingIndex = i
                    usedIndices.add(i)
                    console.log(`Invoice Product[${index}]: Matched by name (partial) at index ${i} -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                    break
                  }
                }
              }
              
              // Last resort: use any matching product name (even if already used)
              if (!matchingProduct) {
                const dcProductName = (pd.product || '').toLowerCase().trim()
                matchingProduct = dcOrder.products.find((p: any) => {
                  const orderProductName = (p.product_name || '').toLowerCase().trim()
                  return dcProductName === orderProductName || 
                         dcProductName.includes(orderProductName) || 
                         orderProductName.includes(dcProductName)
                })
                if (matchingProduct) {
                  console.log(`Invoice Product[${index}]: Matched by name (fallback, may be duplicate) -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                }
              }
            }
            
            // Get unit price from database - prioritize DcOrder product price, then DC productDetails price
            // Both are from database, DcOrder is more up-to-date
            const unitPrice = matchingProduct && matchingProduct.unit_price !== undefined && matchingProduct.unit_price !== null
              ? Number(matchingProduct.unit_price)
              : (pd.price !== undefined && pd.price !== null
                  ? Number(pd.price)
                  : 0)
            
            const quantity = Number(pd.quantity) || 0
            const strength = Number(pd.strength) || 0
            // Total = strength * price (from database)
            const total = strength * unitPrice
            totalAmount += total
            
            // Prioritize term from DcOrder product if available (more up-to-date), otherwise use DC productDetails term
            const term = matchingProduct?.term || pd.term || 'Term 1'
            
            console.log(`Invoice Product[${index}]: ${pd.product}, UnitPrice: ₹${unitPrice}, Strength: ${strength}, Total: ₹${total}, MatchedIndex: ${matchingIndex}, Term: ${term}`)
            
            return {
              product: pd.product || '',
              class: pd.class || '1',
              category: pd.category || 'New School',
              specs: pd.specs || 'Regular',
              subject: pd.subject || undefined,
              quantity: quantity,
              strength: strength,
              level: pd.level || 'L2',
              unitPrice: unitPrice,
              total: total,
              term: term,
            }
          })
        } else {
          // Fallback: use DC productDetails with prices from database
          paymentBreakdown = fullDC.productDetails.map((p: any) => {
            // Get price from database (DC productDetails.price)
            const price = p.price !== undefined && p.price !== null ? Number(p.price) : 0
            const quantity = Number(p.quantity) || 0
            const strength = Number(p.strength) || 0
            // Total = strength * price (from database) - always recalculate, don't use stored total
            const total = strength * price
            totalAmount += total
            return {
              product: p.product || '',
              class: p.class || '1',
              category: p.category || 'New School',
              specs: p.specs || 'Regular',
              subject: p.subject || undefined,
              quantity: quantity,
              strength: strength,
              level: p.level || 'L2',
              unitPrice: price,
              total: total,
              term: p.term || 'Term 1',
            }
          })
        }
      }
      
      // If still no breakdown but we have DC productDetails, use prices from database
      if (paymentBreakdown.length === 0 && fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        // Recalculate totalAmount from database prices: sum of (strength * price) for each product
        paymentBreakdown = fullDC.productDetails.map((pd: any) => {
          // Get price from database (DC productDetails.price)
          const price = pd.price !== undefined && pd.price !== null ? Number(pd.price) : 0
          const quantity = Number(pd.quantity) || 0
          const strength = Number(pd.strength) || 0
          // Total = strength * price (from database)
          const total = strength * price
          totalAmount += total
          return {
            product: pd.product || '',
            class: pd.class || '1',
            category: pd.category || 'New School',
            specs: pd.specs || 'Regular',
            subject: pd.subject || undefined,
            quantity: quantity,
            strength: strength,
            level: pd.level || 'L2',
            unitPrice: price,
            total: total,
            term: pd.term || 'Term 1',
          }
        })
      }
      
      if (paymentBreakdown.length > 0) {
        const adj = applyPaymentDivisorsToBreakdown(
          paymentBreakdown.map((pb: any) => ({
            ...pb,
            product: pb.product || '',
            class: pb.class || '1',
            strength: Number(pb.strength) || 0,
            unitPrice: Number(pb.unitPrice) || 0,
            level: pb.level,
            subject: pb.subject,
          })),
          getCalculationType,
          getCatalogFallbackCount
        )
        paymentBreakdown = adj.paymentBreakdown
        totalAmount = adj.totalAmount
      }

      // Calculate payment and return totals
      let totalPaidAsOn = 0
      let totalReturnValue = 0
      let previousDue = 0

      try {
        // Get all approved payments for this DC
        const payments = await apiRequest<any[]>(`/payments?dcId=${dc._id}&status=Approved`).catch(() => [])
        
        // TotalPaidAsOn = advance or first payment only
        // Sort by paymentDate (earliest first) and take the first payment
        if (payments.length > 0) {
          const sortedPayments = payments.sort((a: any, b: any) => {
            const dateA = new Date(a.paymentDate || a.createdAt || 0).getTime()
            const dateB = new Date(b.paymentDate || b.createdAt || 0).getTime()
            return dateA - dateB
          })
          // Take the first payment (advance/first payment)
          totalPaidAsOn = Number(sortedPayments[0]?.amount) || 0
        }

        // Get all returns for this DC - fetch all executive returns and filter by dcOrderId
        let returns: any[] = []
        if (dcOrder?._id) {
          try {
            const allReturns = await apiRequest<any[]>(`/stock-returns/executive/list`).catch(() => [])
            returns = allReturns.filter((r: any) => {
              const returnDcOrderId = typeof r.dcOrderId === 'object' ? r.dcOrderId?._id : r.dcOrderId
              return returnDcOrderId === dcOrder._id
            })
          } catch (e) {
            console.error('Error fetching returns:', e)
          }
        }
        // Calculate return value from approved returns
        const approvedReturns = returns.filter((r: any) => ['Approved', 'Partially Approved', 'Stock Updated', 'Closed'].includes(r.status))
        totalReturnValue = approvedReturns.reduce((sum: number, r: any) => {
          // Calculate return value from products
          const returnValue = r.products?.reduce((productSum: number, product: any) => {
            const approvedQty = Number(product.approvedQty) || 0
            // Try to get price from matching product in paymentBreakdown
            const matchingProduct = paymentBreakdown.find((pb: any) => {
              const pbName = (pb.product || '').toLowerCase().trim()
              const returnName = (product.product || '').toLowerCase().trim()
              return pbName === returnName || pbName.includes(returnName) || returnName.includes(pbName)
            })
            const unitPrice = matchingProduct?.unitPrice || 0
            return productSum + (approvedQty * unitPrice)
          }, 0) || 0
          return sum + returnValue
        }, 0)

        // Get previous DCs for this customer to calculate previous due
        const customerName = schoolInfo.customerName || dc.customerName || ''
        if (customerName) {
          const allDCs = await apiRequest<any[]>(`/dc/employee/my`).catch(() => [])
          const previousDCs = allDCs.filter((prevDC: any) => {
            const prevCustomerName = prevDC.customerName || prevDC.dcOrderId?.school_name || ''
            return prevCustomerName === customerName && prevDC._id !== dc._id
          })
          
          // Calculate total from previous DCs
          let previousTotal = 0
          for (const prevDC of previousDCs) {
            if (prevDC.productDetails && Array.isArray(prevDC.productDetails)) {
              const prevTotal = prevDC.productDetails.reduce((sum: number, p: any) => 
                sum + (Number(p.total) || (Number(p.price) || 0) * (Number(p.strength) || 0)), 0
              )
              previousTotal += prevTotal
            }
          }
          
          // Get payments for previous DCs
          const previousDCIds = previousDCs.map((d: any) => d._id)
          let previousPaid = 0
          if (previousDCIds.length > 0) {
            // Fetch payments for each previous DC
            const paymentPromises = previousDCIds.map((dcId: string) => 
              apiRequest<any[]>(`/payments?dcId=${dcId}&status=Approved`).catch(() => [])
            )
            const paymentResults = await Promise.all(paymentPromises)
            const allPreviousPayments = paymentResults.flat()
            previousPaid = allPreviousPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
          }
          
          previousDue = Math.max(0, previousTotal - previousPaid)
        }
      } catch (e) {
        console.error('Error calculating payment/return totals:', e)
      }

      // Products will be displayed directly from paymentBreakdown
      // No need to group - show each product as it appears in the database

      // Get financial year (current year - next year format)
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const nextYear = currentYear + 1
      const financialYear = `${currentYear}-${nextYear.toString().slice(-2)}`

      // Calculate total due
      // Note: otherCharges and discount fields may need to be added to DcOrder model
      const otherCharges = Number((dcOrder as any)?.otherCharges) || 0
      const discount = Number((dcOrder as any)?.discount) || 0
      const currentTotalBill = totalAmount + otherCharges - discount
      // TotalDue = TotalPaid - ReturnValue (as per user requirement)
      const totalDue = Math.max(0, totalPaidAsOn - totalReturnValue)
      
      const resolvedDcOrderId =
        dcOrder?._id ||
        (typeof dc.dcOrderId === 'object' ? dc.dcOrderId?._id : dc.dcOrderId)
      const primaryProduct = paymentBreakdown[0]?.product || fullDC.product || ''
      const gate = await getProgramInvoiceGate(resolvedDcOrderId, primaryProduct)

      setInvoiceData({
        schoolInfo,
        paymentBreakdown: gate.invoicePending ? [] : paymentBreakdown,
        totalAmount: gate.invoicePending ? 0 : currentTotalBill,
        dcDate: fullDC.dcDate || undefined,
        previousDue,
        totalPaidAsOn,
        totalReturnValue,
        totalDue,
        otherCharges,
        otherChargesRemarks: (dcOrder as any)?.otherChargesRemarks || '',
        discount,
        discountRemarks: (dcOrder as any)?.discountRemarks || '',
        financialYear,
        invoicePending: gate.invoicePending,
        invoicePendingMessage: gate.message,
      })
      setInvoiceModalOpen(true)
    } catch (e: any) {
      console.error('Failed to load invoice:', e)
      toast.error('Failed to load invoice data: ' + (e?.message || 'Unknown error'))
    }
  }

  const openClientDCDialog = async (dc: DC) => {
    setSelectedDC(dc)
    
    // Determine category automatically based on school_type from dcOrderId
    // If school_type is 'Existing', it's a renewal/existing school, otherwise it's a new school
    const autoCategory = dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId.school_type === 'Existing'
      ? 'Existing School'
      : 'New School'
    
    // Load delivery address data from dcOrderId
    let deliveryData = {
      property_number: '',
      floor: '',
      tower_block: '',
      nearby_landmark: '',
      area: '',
      city: '',
      pincode: '',
    }
    
    // Get dcOrderId to fetch delivery address and all DcOrder data
    let dcOrderId = null
    if (dc.dcOrderId) {
      if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId._id) {
        dcOrderId = dc.dcOrderId._id
      } else if (typeof dc.dcOrderId === 'string') {
        dcOrderId = dc.dcOrderId
      }
    }
    if (dcOrderId) {
      try {
        const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
        
        // Store full DcOrder data for display (prioritize pendingEdit if exists, else use main fields)
        let displayData: any = {}
        if (dcOrder.pendingEdit && dcOrder.pendingEdit.status === 'pending') {
          // Show from pendingEdit if there's a pending edit request
          displayData = {
            school_name: dcOrder.pendingEdit.school_name || dcOrder.school_name || '',
            contact_person: dcOrder.pendingEdit.contact_person || dcOrder.contact_person || '',
            contact_mobile: dcOrder.pendingEdit.contact_mobile || dcOrder.contact_mobile || '',
            contact_person2: dcOrder.pendingEdit.contact_person2 || dcOrder.contact_person2 || '',
            contact_mobile2: dcOrder.pendingEdit.contact_mobile2 || dcOrder.contact_mobile2 || '',
            email: dcOrder.pendingEdit.email || dcOrder.email || '',
            address: dcOrder.pendingEdit.address || dcOrder.address || '',
            zone: dcOrder.pendingEdit.zone || dcOrder.zone || '',
            location: dcOrder.pendingEdit.location || dcOrder.location || '',
            remarks: dcOrder.pendingEdit.remarks || dcOrder.remarks || '',
            // Transport details from pendingEdit (fallback to main fields)
            transport_name: dcOrder.pendingEdit.transport_name || dcOrder.transport_name || '',
            transport_location: dcOrder.pendingEdit.transport_location || dcOrder.transport_location || '',
            transportation_landmark: dcOrder.pendingEdit.transportation_landmark || dcOrder.transportation_landmark || '',
            pincode: dcOrder.pendingEdit.pincode || dcOrder.pincode || '',
            // Delivery address
            property_number: dcOrder.pendingEdit.property_number || '',
            floor: dcOrder.pendingEdit.floor || '',
            tower_block: dcOrder.pendingEdit.tower_block || '',
            nearby_landmark: dcOrder.pendingEdit.nearby_landmark || '',
            area: dcOrder.pendingEdit.area || '',
            city: dcOrder.pendingEdit.city || '',
          }
        } else {
          // If no pending edit, show from approved/main fields
          displayData = {
            school_name: dcOrder.school_name || '',
            contact_person: dcOrder.contact_person || '',
            contact_mobile: dcOrder.contact_mobile || '',
            contact_person2: dcOrder.contact_person2 || '',
            contact_mobile2: dcOrder.contact_mobile2 || '',
            email: dcOrder.email || '',
            address: dcOrder.address || '',
            zone: dcOrder.zone || '',
            location: dcOrder.location || '',
            remarks: dcOrder.remarks || '',
            // Transport details from main DcOrder fields
            transport_name: dcOrder.transport_name || '',
            transport_location: dcOrder.transport_location || '',
            transportation_landmark: dcOrder.transportation_landmark || '',
            pincode: dcOrder.pincode || '',
            // Delivery address
            property_number: dcOrder.property_number || '',
            floor: dcOrder.floor || '',
            tower_block: dcOrder.tower_block || '',
            nearby_landmark: dcOrder.nearby_landmark || '',
            area: dcOrder.area || '',
            city: dcOrder.city || '',
          }
        }
        setDcOrderData(displayData)
        
        // Load delivery address from displayData
        deliveryData = {
          property_number: displayData.property_number || '',
          floor: displayData.floor || '',
          tower_block: displayData.tower_block || '',
          nearby_landmark: displayData.nearby_landmark || '',
          area: displayData.area || '',
          city: displayData.city || '',
          pincode: displayData.pincode || '',
        }
      } catch (e) {
        console.error('Failed to load delivery address:', e)
        setDcOrderData(null)
      }
    } else {
      setDcOrderData(null)
    }
    setDeliveryAddress(deliveryData)
    
    // Load products from DcOrder (includes products added/edited in Edit PO)
    let dcOrderProducts: any[] = []
    if (dcOrderId) {
      try {
        const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
        if (dcOrder.products && Array.isArray(dcOrder.products)) {
          dcOrderProducts = dcOrder.products
        }
      } catch (e) {
        console.error('Failed to load DcOrder products:', e)
      }
    }
    
    // Load full DC details
    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      
      const dcProductDetails = Array.isArray(fullDC.productDetails) ? fullDC.productDetails : []
      const rowOpts: ResolveClientDCRowOpts = { hasProductCategories, getProductCategories }
      const productsToShow = buildClientDCProductRows(
        dcProductDetails,
        dcOrderProducts,
        rowOpts,
        getDefaultLevel
      )

      // Set the products to display
      if (productsToShow.length > 0) {
        console.log('Setting products for Request DC:', JSON.stringify(productsToShow, null, 2))
        setDcProductRows(productsToShow)
      } else {
        // No products - show empty state
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

  const openRecordShortageDialog = (dc: DC) => {
    const dcOrderId = typeof dc.dcOrderId === 'object' ? dc.dcOrderId?._id : dc.dcOrderId
    const loadRows = async () => {
      const consumed = new Map<string, number>()
      if (dcOrderId) {
        const related = await apiRequest<any[]>(`/dc?dcOrderId=${encodeURIComponent(dcOrderId)}`)
        ;(Array.isArray(related) ? related : [])
          .filter((x: any) => x?.dcType === 'shortage')
          .filter((x: any) => {
            const parentId = typeof x?.parentDcId === 'object' ? x?.parentDcId?._id : x?.parentDcId
            return String(parentId || '') === String(dc._id)
          })
          .forEach((x: any) => {
            ;(x.productDetails || []).forEach((p: any) => {
              const key = `${(p.product || p.productName || '').toLowerCase()}::${(p.class || '').toLowerCase()}::${(p.category || '').toLowerCase()}::${(p.term || 'term 1').toLowerCase()}`
              const qty = Number(p.quantity || p.strength || 0)
              consumed.set(key, (consumed.get(key) || 0) + qty)
            })
          })
      }

      const rows = (Array.isArray(dc.productDetails) ? dc.productDetails : []).map((p: any, idx: number) => {
      const prodName = p.product || p.productName || ''
      const orderedQuantity = Number(p.quantity || p.strength || 0)
      const deliveredQuantity = Number(p.deliveredQuantity ?? orderedQuantity)
      const key = `${(p.product || p.productName || '').toLowerCase()}::${(p.class || '').toLowerCase()}::${(p.category || '').toLowerCase()}::${(p.term || 'term 1').toLowerCase()}`
      const alreadyRaised = Number(consumed.get(key) || 0)
      const calculatedShortage = Math.max(orderedQuantity - deliveredQuantity - alreadyRaised, 0)
      const skuCats = hasProductCategories(prodName) ? getProductCategories(prodName) : []
      const rawPc = typeof p.productCategory === 'string' ? p.productCategory.trim() : ''
      const resolvedProductCategory =
        rawPc && skuCats.some((c) => c.toLowerCase() === rawPc.toLowerCase())
          ? skuCats.find((c) => c.toLowerCase() === rawPc.toLowerCase()) || rawPc
          : skuCats[0] || ''
      return {
        id: `${idx}-${p.product || p.productName || 'product'}`,
        product: prodName,
        class: p.class || '1',
        category: p.category || 'new Students',
        term: p.term || 'Term 1',
        productCategory: resolvedProductCategory || undefined,
        orderedQuantity,
        deliveredQuantity,
        shortageQuantity: Number(p.shortageQuantity ?? calculatedShortage),
      }
    })
      setShortageParentDC(dc)
      setShortageRows(rows)
      setShortageNotes('')
      setShortageDialogOpen(true)
    }
    loadRows().catch((e: any) => {
      toast.error(e?.message || 'Failed to load shortage details')
    })
  }

  const handleFollowUpStudentTypeContinue = (dc: DC) => {
    const id = dc._id
    const sel = followUpStudentTypeByDcId[id]
    if (!sel) {
      toast.error('Select a student type first')
      return
    }
    if (isShortageStudentType(sel)) {
      openRecordShortageDialog(dc)
      return
    }
    toast.info('This student type is not available yet. Only Shortage is supported today.')
  }

  const handleCreateShortageDC = async () => {
    if (!shortageParentDC) return
    const rowsWithShortage = shortageRows.filter((r) => Number(r.shortageQuantity) > 0)
    const missingSku = rowsWithShortage.find(
      (r) => hasProductCategories(r.product) && !(r.productCategory && String(r.productCategory).trim())
    )
    if (missingSku) {
      toast.error(`Select a product category for ${missingSku.product || 'each product'} with shortage quantity.`)
      return
    }

    const payloadRows = rowsWithShortage.map((r) => ({
      product: r.product,
      class: r.class,
      category: r.category,
      term: r.term,
      productCategory:
        hasProductCategories(r.product) && r.productCategory?.trim()
          ? r.productCategory.trim()
          : undefined,
      quantity: Number(r.shortageQuantity),
      deliveredQuantity: Number(r.deliveredQuantity),
      shortageQuantity: Number(r.shortageQuantity),
      strength: Number(r.shortageQuantity),
    }))

    if (payloadRows.length === 0) {
      toast.error('Enter shortage quantity for at least one product')
      return
    }

    setSavingShortage(true)
    try {
      await apiRequest(`/dc/${shortageParentDC._id}/record-shortage`, {
        method: 'POST',
        body: JSON.stringify({
          productDetails: payloadRows,
          dcCategory: 'Shortage',
          dcRemarks: shortageNotes || undefined,
        }),
      })
      toast.success('Shortage DC created successfully')
      setShortageDialogOpen(false)
      const parentId = shortageParentDC._id
      setShortageParentDC(null)
      setFollowUpStudentTypeByDcId((p) => {
        if (!parentId) return p
        const next = { ...p }
        delete next[parentId]
        return next
      })
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create shortage DC')
    } finally {
      setSavingShortage(false)
    }
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
            // Save productCategory back into DC so warehouse view can use it
            productCategory: row.productCategory || undefined,
            specs: row.specs || 'Regular',
            quantity: Number(row.quantity) || 0,
            strength: Number(row.strength) || 0,
            level: row.level || getDefaultLevel(row.product || 'Abacus'),
            term: row.term || 'Term 1',
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

    if (!isTransportComplete(dcOrderData)) {
      toast.error('Please fill Transport Name, Transport Location, and Pincode in Edit PO before requesting DC.')
      return
    }

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
      const defaultStudentCategory =
        dcOrderData?.school_type === 'Existing' ? 'Existing Students' : 'New Students'

      const normalizeStudentCategory = (v: any) => {
        if (!v) return v
        if (v === 'New School') return 'New Students'
        if (v === 'Existing School') return 'Existing Students'
        return v
      }

      // Prepare product details
      const productDetails = dcProductRows.map(row => ({
        product: row.product || '',
        class: row.class || '1',
        category: normalizeStudentCategory(row.category) || defaultStudentCategory,
        productCategory: row.productCategory || undefined,
        specs: row.specs || 'Regular',
        subject: row.subject || undefined,
        quantity: Number(row.quantity) || 0,
        strength: Number(row.strength) || 0,
        level: row.level || getDefaultLevel(row.product || 'Abacus'),
        term: row.term || 'Term 1',
      }))

      const totalQuantity = dcProductRows.reduce((sum, p) => sum + (p.quantity || 0), 0)

      // Check product terms to determine routing
      const terms = productDetails.map(p => p.term || 'Term 1')
      const uniqueTerms = Array.from(new Set(terms))
      const hasBothTerm = uniqueTerms.includes('Both')
      const hasTerm1 = uniqueTerms.includes('Term 1')
      const hasTerm2 = uniqueTerms.includes('Term 2')
      // Split if there are Term 2 products AND (Term 1 products OR "Both" products)
      // "Both" products behave like Term 1 products - go to DC 1 (Closed Sales)
      const hasBothTerms = hasTerm2 && (hasTerm1 || hasBothTerm)

      // Split products by term
      const term1Products = productDetails.filter(p => {
        const term = p.term || 'Term 1'
        return term === 'Term 1' || term === 'Both'
      })
      const term2Products = productDetails.filter(p => (p.term || 'Term 1') === 'Term 2')

      // Update DC and set status based on terms
      let updatePayload: any = {
        productDetails: productDetails,
        requestedQuantity: totalQuantity,
      }

      // Update PO photo if provided
      if (dcPoPhotoUrl) {
        updatePayload.poPhotoUrl = dcPoPhotoUrl
        updatePayload.poDocument = dcPoPhotoUrl
      }

      let updatedDC: any
      let term2DC: any = null

      if (hasBothTerms) {
        // Case 3: Both Term 1 and Term 2 - Split into two DCs
        console.log('📦 Splitting DC into Term 1 and Term 2 DCs')
        
        // Create Term 1 DC (goes to Closed Sales)
        const term1Quantity = term1Products.reduce((sum, p) => sum + (p.quantity || 0), 0)
        const term1Payload: any = {
          productDetails: term1Products,
          requestedQuantity: term1Quantity,
          status: 'pending_dc', // Goes to Pending DC for Senior Coordinator
        }
        if (dcPoPhotoUrl) {
          term1Payload.poPhotoUrl = dcPoPhotoUrl
          term1Payload.poDocument = dcPoPhotoUrl
        }

        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(term1Payload),
        })

        // Create Term 2 DC (goes to Term-Wise DC)
        const term2Quantity = term2Products.reduce((sum, p) => sum + (p.quantity || 0), 0)
        let dcOrderId = null
        if (selectedDC.dcOrderId) {
          if (typeof selectedDC.dcOrderId === 'object' && selectedDC.dcOrderId !== null && selectedDC.dcOrderId._id) {
            dcOrderId = selectedDC.dcOrderId._id
          } else if (typeof selectedDC.dcOrderId === 'string') {
            dcOrderId = selectedDC.dcOrderId
          }
        }
        let employeeId = null
        if (selectedDC.employeeId) {
          if (typeof selectedDC.employeeId === 'object' && selectedDC.employeeId !== null && selectedDC.employeeId._id) {
            employeeId = selectedDC.employeeId._id
          } else if (typeof selectedDC.employeeId === 'string') {
            employeeId = selectedDC.employeeId
          }
        }
        
        const term2Payload: any = {
          dcOrderId: dcOrderId,
          employeeId: employeeId,
          productDetails: term2Products,
          requestedQuantity: term2Quantity,
          status: 'scheduled_for_later', // Goes to Term-Wise DC in Executive Dashboard
        }
        if (dcPoPhotoUrl) {
          term2Payload.poPhotoUrl = dcPoPhotoUrl
        }

        // Create new DC for Term 2 using the /raise endpoint
        term2DC = await apiRequest(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(term2Payload),
        })

        console.log('✅ DC split successfully:', {
          term1DC: updatedDC._id,
          term2DC: term2DC._id,
        })
      } else if (hasTerm1 || hasBothTerm) {
        // Case 1: Only Term 1 or "Both" - Goes to Closed Sales
        console.log('📦 DC has Term 1 or "Both" products - going to Closed Sales')
        updatePayload.status = 'pending_dc' // Will be updated to dc_requested via DcOrder
        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload),
      })
      } else if (hasTerm2 && !hasTerm1 && !hasBothTerm) {
        // Case 2: Only Term 2 (no Term 1, no "Both") - Goes to Term-Wise DC (NOT Closed Sales)
        console.log('📦 DC has only Term 2 products - going to Term-Wise DC (NOT Closed Sales)')
        updatePayload.status = 'scheduled_for_later' // Goes to Term-Wise DC
        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      } else {
        // Fallback: Default to pending_dc
        updatePayload.status = 'pending_dc'
        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      }

      // Calculate total amount from productDetails - ALWAYS get prices from DcOrder products
      let totalAmount = 0
      let paymentBreakdown: any[] = []
      
      // Always try to get prices from DcOrder products first (most accurate)
      if (selectedDC.dcOrderId) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          
          console.log('📦 DcOrder products:', JSON.stringify(dcOrder.products, null, 2))
          console.log('📦 DC productDetails:', JSON.stringify(productDetails, null, 2))
          console.log('📦 Matching products - DcOrder has', dcOrder.products.length, 'products, DC has', productDetails.length, 'productDetails')
          
          if (dcOrder.products && Array.isArray(dcOrder.products) && dcOrder.products.length > 0) {
            // Match products by INDEX/POSITION first (most accurate - each row matches to corresponding DcOrder product)
            // This ensures that if you have 5 rows of "Abacus" with different prices in Edit PO,
            // each row gets its own correct price
            const usedIndices = new Set<number>()
            
            paymentBreakdown = productDetails.map((pd: any, index: number) => {
              // First try to match by index/position (most accurate)
              let matchingProduct: any = null
              let matchingIndex = -1
              
              // Try exact index match first
              if (index < dcOrder.products.length && !usedIndices.has(index)) {
                matchingProduct = dcOrder.products[index]
                matchingIndex = index
                usedIndices.add(index)
                console.log(`Payment Creation Product[${index}]: Matched by exact index -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
              } else {
                // If exact index is used or out of bounds, find unused product with matching name
                const dcProductName = (pd.product || '').toLowerCase().trim()
                
                // First try to find unused product with exact name match
                for (let i = 0; i < dcOrder.products.length; i++) {
                  if (usedIndices.has(i)) continue
                  
                  const p = dcOrder.products[i]
                  const orderProductName = (p.product_name || '').toLowerCase().trim()
                  
                  if (dcProductName === orderProductName) {
                    matchingProduct = p
                    matchingIndex = i
                    usedIndices.add(i)
                    console.log(`Payment Creation Product[${index}]: Matched by name (exact) at index ${i} -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                    break
                  }
                }
                
                // If still no match, try partial name match
                if (!matchingProduct) {
                  for (let i = 0; i < dcOrder.products.length; i++) {
                    if (usedIndices.has(i)) continue
                    
                    const p = dcOrder.products[i]
                    const orderProductName = (p.product_name || '').toLowerCase().trim()
                    
                    if (dcProductName.includes(orderProductName) || orderProductName.includes(dcProductName)) {
                      matchingProduct = p
                      matchingIndex = i
                      usedIndices.add(i)
                      console.log(`Payment Creation Product[${index}]: Matched by name (partial) at index ${i} -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                      break
                    }
                  }
                }
                
                // Last resort: use any matching product name (even if already used)
                if (!matchingProduct) {
                  const dcProductName = (pd.product || '').toLowerCase().trim()
                  matchingProduct = dcOrder.products.find((p: any) => {
                    const orderProductName = (p.product_name || '').toLowerCase().trim()
                    return dcProductName === orderProductName || 
                           dcProductName.includes(orderProductName) || 
                           orderProductName.includes(dcProductName)
                  })
                  if (matchingProduct) {
                    console.log(`Payment Creation Product[${index}]: Matched by name (fallback, may be duplicate) -> ${matchingProduct?.product_name} (₹${matchingProduct?.unit_price})`)
                  }
                }
              }
              
              const unitPrice = matchingProduct ? (Number(matchingProduct.unit_price) || 0) : 0
              const quantity = Number(pd.quantity) || 0
              const strength = Number(pd.strength) || 0
              // Use strength for calculation (not quantity) - strength is the actual number of students/items
              const total = unitPrice * strength
              totalAmount += total
              
              console.log(`Payment Creation Product[${index}]: ${pd.product}, UnitPrice: ₹${unitPrice}, Quantity: ${quantity}, Strength: ${strength}, Total: ₹${total}, MatchedIndex: ${matchingIndex}`)
              
              return {
                product: pd.product || '',
                class: pd.class || '1',
                category: pd.category || 'New School',
                specs: pd.specs || 'Regular',
                subject: pd.subject || undefined,
                quantity: quantity,
                strength: strength,
                level: pd.level || 'L2',
                unitPrice: unitPrice,
                total: total,
              }
            })
            
            console.log('💰 Calculated totalAmount from DcOrder products:', totalAmount)
            console.log('💰 Payment breakdown:', paymentBreakdown)
          }
        } catch (e) {
          console.error('Failed to get prices from DcOrder:', e)
        }
      }
      
      // Fallback: If no prices from DcOrder, try to get from DC productDetails
      if (totalAmount === 0 && updatedDC.productDetails && Array.isArray(updatedDC.productDetails)) {
        paymentBreakdown = updatedDC.productDetails.map((p: any) => {
          const price = Number(p.price) || 0
          const quantity = Number(p.quantity) || 0
          const strength = Number(p.strength) || 0
          // Use strength for calculation (not quantity) - strength is the actual number of students/items
          const total = Number(p.total) || (price * strength)
          totalAmount += total
          return {
            product: p.product || '',
            class: p.class || '1',
            category: p.category || 'New School',
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            quantity: quantity,
            strength: strength,
            level: p.level || 'L2',
            unitPrice: price,
            total: total,
          }
        })
      }
      
      // If still no total, calculate from productDetails with default or use total_amount from DcOrder
      if (totalAmount === 0 && selectedDC.dcOrderId) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          
          if (dcOrder.total_amount && Number(dcOrder.total_amount) > 0) {
            totalAmount = Number(dcOrder.total_amount)
            // Create breakdown with estimated prices
            paymentBreakdown = productDetails.map((pd: any) => {
            const quantity = Number(pd.quantity) || 0
            const strength = Number(pd.strength) || 0
            // Use strength for calculation (not quantity)
            const totalStrength = productDetails.reduce((sum: number, p: any) => 
              sum + (Number(p.strength) || 0), 0
            )
            const estimatedUnitPrice = totalStrength > 0 ? totalAmount / totalStrength : 0
            const total = estimatedUnitPrice * strength
              return {
                product: pd.product || '',
                class: pd.class || '1',
                category: pd.category || 'New School',
                specs: pd.specs || 'Regular',
                subject: pd.subject || undefined,
                quantity: quantity,
                strength: strength,
                level: pd.level || 'L2',
                unitPrice: estimatedUnitPrice,
                total: total,
              }
            })
          }
        } catch (e) {
          console.error('Failed to get total_amount from DcOrder:', e)
        }
      }

      if (paymentBreakdown.length > 0) {
        const adj = applyPaymentDivisorsToBreakdown(
          paymentBreakdown.map((pb: any) => ({
            ...pb,
            product: pb.product || '',
            class: pb.class || '1',
            strength: Number(pb.strength) || 0,
            unitPrice: Number(pb.unitPrice) || 0,
            level: pb.level,
            subject: pb.subject,
          })),
          getCalculationType,
          getCatalogFallbackCount
        )
        paymentBreakdown = adj.paymentBreakdown
        totalAmount = adj.totalAmount
      }

      // Get school/client information for payment
      let schoolInfo: any = {}
      if (selectedDC.dcOrderId) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          schoolInfo = {
            customerName: dcOrder.school_name || selectedDC.customerName || '',
            schoolCode: dcOrder.school_code || '',
            contactName: dcOrder.contact_person || '',
            mobileNumber: dcOrder.contact_mobile || selectedDC.customerPhone || '',
            location: dcOrder.location || dcOrder.area || '',
            zone: dcOrder.zone || '',
            email: dcOrder.email || selectedDC.customerEmail || '',
          }
        } catch (e) {
          console.error('Failed to get school info:', e)
          schoolInfo = {
            customerName: selectedDC.customerName || '',
            mobileNumber: selectedDC.customerPhone || '',
          }
        }
      } else {
        schoolInfo = {
          customerName: selectedDC.customerName || '',
          mobileNumber: selectedDC.customerPhone || '',
        }
      }

      // Program billing is now owned by backend delivery completion flows.
      // Keep UI request flow billing-free to avoid stale or duplicated payable creation.
      if (totalAmount > 0 && (hasTerm1 || hasBothTerms || hasBothTerm)) {
        console.log('ℹ️ Payment creation skipped in frontend; backend program-billing handles payable recomputation.')
      } else if (hasTerm2 && !hasTerm1 && !hasBothTerm) {
        console.log('📦 Term 2 only DC - backend will handle cumulative billing at delivery completion')
      } else if (totalAmount === 0) {
        console.warn('⚠️ Total amount is 0; backend billing recompute will still run on delivery events')
      }

      // Update the related DcOrder status based on terms
      // Term 1 or "Both" DCs should update DcOrder to 'dc_requested' (appears in Closed Sales)
      // Term 2 only DCs don't need DcOrder update (they appear in Term-Wise DC via DC status, NOT Closed Sales)
      if (selectedDC.dcOrderId && (hasTerm1 || hasBothTerms || hasBothTerm)) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          
          const currentUser = getCurrentUser()
          
          // For split DCs, use Term 1 products for DcOrder update
          const productsForDcOrder = hasBothTerms ? term1Products : productDetails
          const quantityForDcOrder = hasBothTerms 
            ? term1Products.reduce((sum, p) => sum + (p.quantity || 0), 0)
            : totalQuantity
          
          console.log('🔄 Updating DcOrder status to dc_requested with request data:', dcOrderId)
          
          // Store the request data in DcOrder so Admin/Coordinator can see it in Closed Sales
          // Also update the main products array to only contain Term 1 products (for display in Closed Sales)
          const productsArrayForDcOrder = productsForDcOrder.map((p: any) => {
            const subject = resolveProductSubject(p)
            return {
              product_name: p.product || p.product_name || 'Unknown',
              quantity: p.quantity || p.strength || 0,
              unit_price: p.unit_price || 0,
              term: p.term || 'Term 1',
              class: p.class || '1',
              specs: p.specs || 'Regular',
              level: p.level || undefined,
              ...(subject ? { subject } : {}),
              ...(Array.isArray(p.selected_subjects) && p.selected_subjects.length > 0
                ? { selected_subjects: p.selected_subjects }
                : subject
                  ? {
                      selected_subjects: subject
                        .split(',')
                        .map((s: string) => s.trim())
                        .filter(Boolean),
                    }
                  : {}),
            }
          })
          
          const updateResult = await apiRequest(`/dc-orders/${dcOrderId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
              status: 'dc_requested',
              // Update main products array to only show Term 1 products (for display in Closed Sales)
              products: productsArrayForDcOrder,
              dcRequestData: {
                // Store product details from the request (Term 1 products if split)
                productDetails: productsForDcOrder,
                requestedQuantity: quantityForDcOrder,
                // Store employee ID who made the request
                employeeId: currentUser?._id || selectedDC.employeeId,
                // Store any PO photo URL if provided
                poPhotoUrl: dcPoPhotoUrl || undefined,
                // Store timestamp
                requestedAt: new Date().toISOString(),
                // Indicate if this was split (for reference)
                isSplit: hasBothTerms,
                term2DCId: hasBothTerms ? term2DC?._id : undefined,
              }
            }),
          })
          
          console.log('✅ Updated DcOrder status to dc_requested:', {
            dcOrderId,
            newStatus: updateResult?.status,
            schoolName: updateResult?.school_name,
            isSplit: hasBothTerms
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
      } else if (hasTerm2 && !hasTerm1 && !hasBothTerm) {
        // Term 2 only (no Term 1, no "Both") - no need to update DcOrder, DC will appear in Term-Wise DC (NOT Closed Sales)
        console.log('📦 Term 2 only DC - no DcOrder update needed, appears in Term-Wise DC (NOT Closed Sales)')
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

      // Store invoice data for viewing
      // For split DCs, show Term 1 products in invoice (since payment is for Term 1)
      const invoiceBreakdown = hasBothTerms 
        ? paymentBreakdown.filter((p: any) => {
            // Filter to show only Term 1 products
            const matchingProduct = term1Products.find(tp => 
              (tp.product || '').toLowerCase() === (p.product || '').toLowerCase()
            )
            return matchingProduct !== undefined
          })
        : paymentBreakdown
      
      const invoiceAmount = hasBothTerms 
        ? invoiceBreakdown.reduce((sum: number, p: any) => sum + (p.total || 0), 0)
        : totalAmount
      
      const resolvedDcOrderId =
        typeof selectedDC?.dcOrderId === 'object'
          ? selectedDC?.dcOrderId?._id
          : selectedDC?.dcOrderId
      const gate = await getProgramInvoiceGate(
        resolvedDcOrderId || null,
        invoiceBreakdown[0]?.product || null
      )

      setInvoiceData({
        schoolInfo,
        paymentBreakdown: gate.invoicePending ? [] : invoiceBreakdown,
        totalAmount: gate.invoicePending ? 0 : invoiceAmount,
        dcDate: dcDate || undefined,
        invoicePending: gate.invoicePending,
        invoicePendingMessage: gate.message,
      })
      
      // Show appropriate success message based on routing
      if (hasBothTerms) {
        toast.success(`DC split successfully! Term 1 DC will appear in Pending DC (Senior Coordinator), Term 2 DC will appear in Term-Wise DC (Executive Dashboard).`)
      } else if (hasTerm1 || hasBothTerm) {
      toast.success('Client Request submitted successfully! It will appear in Closed Sales for Admin/Coordinator to review and raise DC.')
      } else if (hasTerm2 && !hasTerm1 && !hasBothTerm) {
        toast.success('DC requested successfully! It will appear in Term-Wise DC page. Click "Request DC" there to send it to Closed Sales.')
      } else {
        toast.success('Client Request submitted successfully!')
      }
      setClientDCDialogOpen(false)
      // Open invoice modal after a short delay
      setTimeout(() => {
        setInvoiceModalOpen(true)
      }, 500)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit Client Request')
    } finally {
      setSavingClientDC(false)
    }
  }

  // Helper function to check if new products were added and mark DC as having changes
  const checkForNewProducts = (currentProducts: Array<{ product_name: string }>) => {
    if (!currentEditingDCId) return
    
    const currentProductNames = currentProducts.map(p => p.product_name).filter(Boolean)
    const hasNewProducts = currentProductNames.some(name => !originalProductNames.includes(name))
    
    if (hasNewProducts) {
      setDcsWithPendingChanges(prev => new Set(prev).add(currentEditingDCId))
    }
  }

  // Handle PO photo upload for Edit PO
  const handleEditPOPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.type.includes('pdf') && !file.type.includes('image')) {
      toast.error('Please upload a PDF or image file')
      return
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    
    setUploadingPO(true)
    
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append('poPhoto', file)
      
      // Upload to backend
      const response = await fetch(`${API_BASE_URL}/api/dc/upload-po`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: formData,
      })
      
      if (!response.ok) {
        throw new Error('Failed to upload PO document')
      }
      
      const data = await response.json()
      const newUrl = data.poPhotoUrl || data.url || ''
      setEditFormData({ ...editFormData, pod_proof_url: newUrl })
      
      // Check if PDF changed - if different from original, mark DC as having pending changes
      if (newUrl !== originalPDFUrl && currentEditingDCId) {
        setDcsWithPendingChanges(prev => new Set(prev).add(currentEditingDCId))
      }
      
      toast.success('PO document uploaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload PO document')
    } finally {
      setUploadingPO(false)
    }
  }

  const openEditPODialog = async (dc: DC) => {
    // Get the DcOrder ID from the DC
    let dcOrderId = null
    if (dc.dcOrderId) {
      if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId._id) {
        dcOrderId = dc.dcOrderId._id
      } else if (typeof dc.dcOrderId === 'string') {
        dcOrderId = dc.dcOrderId
      }
    }
    
    if (!dcOrderId) {
      toast.error('Cannot edit: DC Order not found')
      return
    }
    
    // Must match this DC when saving so productDetails sync and IDs stay correct
    setSelectedDC(dc)
    setCurrentEditingDCId(dc._id)

    try {
      const [dcOrder, fullDC] = await Promise.all([
        apiRequest<any>(`/dc-orders/${dcOrderId}`),
        apiRequest<any>(`/dc/${dc._id}`),
      ])
      setSelectedDcOrder(dcOrder)

      const pe = dcOrder.pendingEdit?.status === 'pending' ? dcOrder.pendingEdit : null
      const orderProducts = (pe?.products?.length ? pe.products : dcOrder.products) || []
      const dcDetails = Array.isArray(fullDC?.productDetails) ? fullDC.productDetails : []
      const rowOpts: ResolveClientDCRowOpts = { hasProductCategories, getProductCategories }

      // When a manager approval is pending, show that snapshot; otherwise last saved order
      const formData = {
        school_name: pe?.school_name ?? dcOrder.school_name ?? '',
        contact_person: pe?.contact_person ?? dcOrder.contact_person ?? '',
        contact_mobile: pe?.contact_mobile ?? dcOrder.contact_mobile ?? '',
        contact_person2: pe?.contact_person2 ?? dcOrder.contact_person2 ?? '',
        contact_mobile2: pe?.contact_mobile2 ?? dcOrder.contact_mobile2 ?? '',
        email: pe?.email ?? dcOrder.email ?? '',
        address: pe?.address ?? dcOrder.address ?? '',
        school_type: pe?.school_type ?? dcOrder.school_type ?? '',
        zone: pe?.zone ?? dcOrder.zone ?? '',
        location: pe?.location ?? dcOrder.location ?? '',
        products: orderProducts,
        pod_proof_url: pe?.pod_proof_url ?? dcOrder.pod_proof_url ?? dc.poPhotoUrl ?? '',
        remarks: pe?.remarks ?? dcOrder.remarks ?? '',
        total_amount: Number(pe?.total_amount ?? dcOrder.total_amount ?? 0) || 0,
        transport_name: pe?.transport_name ?? dcOrder.transport_name ?? '',
        transport_location: pe?.transport_location ?? dcOrder.transport_location ?? '',
        transportation_landmark: pe?.transportation_landmark ?? dcOrder.transportation_landmark ?? '',
        pincode: pe?.pincode ?? dcOrder.pincode ?? '',
      }

      console.log('📋 Edit PO Dialog opened - Form data initialized:', {
        transport_name: formData.transport_name,
        transport_location: formData.transport_location,
        transportation_landmark: formData.transportation_landmark,
        pincode: formData.pincode,
        hasPendingEdit: !!pe,
      })

      const editRows = buildEditPOProductRows(
        dcDetails,
        orderProducts,
        rowOpts,
        getDefaultLevel,
        getAvailableLevels
      )
      const computedTotal = computeEditPOTotalAmount(editRows)
      const total_amount =
        computedTotal > 0 ? computedTotal : Number(formData.total_amount) || 0

      setEditFormData({ ...formData, total_amount })
      setEditProductRows(editRows)

      // Original PO product names (committed on DcOrder) — for price lock + "new product" detection
      const originalProducts = Array.from(
        new Set((dcOrder.products || []).map((p: any) => p.product_name).filter(Boolean))
      )
      setOriginalPOProducts(originalProducts)

      const originalPDF = dcOrder.pod_proof_url || dc.poPhotoUrl || ''
      setOriginalPDFUrl(originalPDF)
      setOriginalProductNames(originalProducts)

      setEditPODialogOpen(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load DC Order details')
    }
  }

  const savePOChanges = async () => {
    console.log('🚀 savePOChanges called')
    if (!selectedDcOrder) {
      console.error('❌ No selectedDcOrder, cannot save')
      return
    }

    console.log('✅ selectedDcOrder exists:', selectedDcOrder._id)
    setSubmittingEdit(true)
    try {
      // Validate transport details (mandatory for saving PO changes)
      const transport_name = (editFormData.transport_name || '').trim()
      const transport_location = (editFormData.transport_location || '').trim()
      const transportation_landmark = (editFormData.transportation_landmark || '').trim()
      const pincode = (editFormData.pincode || '').trim()

      if (!transport_name || !transport_location || !pincode) {
        toast.error('Please fill Transport Name, Transport Location, and Pincode before saving PO changes.')
        setSubmittingEdit(false)
        return
      }

      // Log current editFormData state before preparing payload
      console.log('📝 Current editFormData state:', {
        transport_name,
        transport_location,
        transportation_landmark,
        pincode,
      })

      // Validate products - quantity and unit price are mandatory
      const invalidProducts = editProductRows.filter(row => {
        const hasProductName = row.product_name && row.product_name.trim() !== ''
        if (!hasProductName) return false // Skip empty rows
        return !row.quantity || row.quantity <= 0 || !row.unit_price || row.unit_price <= 0
      })
      
      if (invalidProducts.length > 0) {
        toast.error('Please fill in Quantity and Unit Price for all products')
        setSubmittingEdit(false)
        return
      }

      // Prepare products array
      const products = editProductRows
        .filter(row => row.product_name && row.product_name.trim() !== '') // Only include rows with product names
        .map(row => {
          const level =
            row.level ||
            getAvailableLevels(row.product_name || '')[0] ||
            getDefaultLevel(row.product_name || 'Abacus')
          return {
            product_name: row.product_name,
            quantity: row.quantity,
            unit_price: row.unit_price,
            class: row.class || '1',
            specs: row.specs || 'Regular',
            productCategory: row.productCategory || undefined,
            category: row.category || undefined,
            strength: Number(row.strength ?? row.quantity) || 0,
            // Keep term for backward compatibility in DcOrder schema, but UI uses level only
            term: normalizeProductTerm(
              (row.term != null && String(row.term).trim() !== '')
                ? row.term
                : (termFromLevelLabel(level) ?? 'Term 1')
            ),
            level,
          }
        })

      // Calculate total amount
      const totalAmount = computeEditPOTotalAmount(products)

      // Check if PDF changed or new products were added (compared to original Close Lead state)
      const pdfChanged = editFormData.pod_proof_url !== originalPDFUrl
      const currentProductNames = products.map(p => p.product_name).filter(Boolean)
      const hasNewProducts = currentProductNames.some(name => !originalProductNames.includes(name))
      
      console.log('🔍 Change Detection:', {
        pdfChanged,
        hasNewProducts,
        originalProductNames,
        currentProductNames,
        newProducts: currentProductNames.filter(name => !originalProductNames.includes(name))
      })
      
      // Prepare the payload with all fields including transport details
      // Get transport fields from editFormData, with fallback to empty string
      const transportFields = {
        transport_name: (editFormData.transport_name !== undefined && editFormData.transport_name !== null) ? String(editFormData.transport_name) : '',
        transport_location: (editFormData.transport_location !== undefined && editFormData.transport_location !== null) ? String(editFormData.transport_location) : '',
        transportation_landmark: (editFormData.transportation_landmark !== undefined && editFormData.transportation_landmark !== null) ? String(editFormData.transportation_landmark) : '',
        pincode: (editFormData.pincode !== undefined && editFormData.pincode !== null) ? String(editFormData.pincode) : '',
      }

      const payload = {
          ...editFormData,
          products,
          total_amount: totalAmount,
        // Explicitly include transport fields (overrides any from spread)
        ...transportFields,
      }
      const dcProductDetailsPayload = editProductRows
        .filter((row) => row.product_name && row.product_name.trim() !== '')
        .map((row) => {
          const level =
            row.level ||
            getAvailableLevels(row.product_name || '')[0] ||
            getDefaultLevel(row.product_name || 'Abacus')
          return {
            product: row.product_name,
            class: row.class || '1',
            specs: row.specs || 'Regular',
            quantity: Number(row.quantity) || 0,
            strength: Number(row.strength || row.quantity) || 0,
            level,
            term: normalizeProductTerm(
              (row.term != null && String(row.term).trim() !== '')
                ? row.term
                : (termFromLevelLabel(level) ?? 'Term 1')
            ),
            subject: row.subject || undefined,
            category: row.category || undefined,
            productCategory: row.productCategory || undefined,
            price: Number(row.unit_price) || 0,
            total: (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
          }
        })

      // If PDF changed or new products added, create pendingEdit request for Executive Manager approval
      if (pdfChanged || hasNewProducts) {
        console.log('📤 Creating pendingEdit request for Executive Manager approval:', {
          pdfChanged,
          hasNewProducts,
          dcOrderId: selectedDcOrder._id
        })
        
        try {
          const response = await apiRequest<any>(`/dc-orders/${selectedDcOrder._id}/submit-edit`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          console.log('✅ PendingEdit request created successfully:', response)
          if (response?._id) setSelectedDcOrder(response)
          
          // Mark DC as having pending changes and pending edit request
          if (currentEditingDCId) {
            setDcsWithPendingChanges(prev => new Set(prev).add(currentEditingDCId))
            setDcsWithPendingEditRequests(prev => new Set(prev).add(currentEditingDCId))
          }
          
          toast.success('PO edit request submitted! Executive Manager will review and approve.')
        } catch (e: any) {
          console.error('❌ Failed to create pendingEdit request:', e)
          // If there's already a pending edit, that's okay - just update the existing one
          if (e?.message?.includes('already a pending edit')) {
            toast.info('Edit request already pending. Executive Manager will review it.')
          } else {
            toast.error(e?.message || 'Failed to submit edit request. Please try again.')
            setSubmittingEdit(false)
            return
          }
        }
      } else {
        // No PDF or product changes - update directly (no approval needed)
        console.log('📤 Updating DC Order directly (no approval needed):', `/dc-orders/${selectedDcOrder._id}`)
      const response = await apiRequest<any>(`/dc-orders/${selectedDcOrder._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      console.log('✅ DC Order updated successfully:', response)
      if (response?._id) setSelectedDcOrder(response)

      // Keep DC productDetails in sync so Edit PO reopens with saved levels/terms.
      if (selectedDC?._id) {
        await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            productDetails: dcProductDetailsPayload,
            requestedQuantity: dcProductDetailsPayload.reduce(
              (sum: number, p: any) => sum + (Number(p.quantity) || 0),
              0
            ),
          }),
        })
      }
        
        // Remove from pending changes if no changes detected
        if (currentEditingDCId) {
          setDcsWithPendingChanges(prev => {
            const newSet = new Set(prev)
            newSet.delete(currentEditingDCId)
            return newSet
          })
        }

      toast.success('PO updated successfully!')
      }

      setEditPODialogOpen(false)
      // Reset editing state
      setCurrentEditingDCId(null)
      setOriginalPDFUrl('')
      setOriginalProductNames([])
      // Reload to refresh pending edit status
      load()
    } catch (e: any) {
      console.error('❌❌❌ ERROR UPDATING PO ❌❌❌')
      console.error('Error object:', e)
      console.error('Error message:', e?.message)
      console.error('Error status:', e?.status)
      console.error('Error response:', e?.response)
      
      toast.error(e?.message || 'Failed to update PO')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const getDcProductsText = (d: any) => {
    const fromDetails = Array.isArray(d.productDetails)
      ? Array.from(
          new Set(
            d.productDetails
              .map((p: any) => (p?.product || p?.productName || '').toString().trim())
              .filter(Boolean)
          )
        )
      : []
    if (fromDetails.length > 0) return fromDetails.join(', ')
    const fromOrder = d.dcOrderId?.products && Array.isArray(d.dcOrderId.products)
      ? d.dcOrderId.products
          .map((p: any) => (p.product_name || p.product || '').toString().trim())
          .filter(Boolean)
      : []
    if (fromOrder.length > 0) return Array.from(new Set(fromOrder)).join(', ')
    return d.product || d.saleId?.product || ''
  }

  // Filter and sort items based on search query
  // Get unique products and years from items
  const uniqueProducts = useMemo(() => {
    const products = new Set<string>()
    items.forEach(item => {
      const product = getDcProductsText(item)
      if (product && product !== '-') {
        products.add(product)
      }
    })
    return Array.from(products).sort()
  }, [items])

  // Get available years from items
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    const currentYear = new Date().getFullYear()
    years.add(currentYear)
    
    items.forEach(item => {
      const date = item.createdAt || (typeof item.dcOrderId === 'object' && item.dcOrderId?.createdAt 
        ? item.dcOrderId.createdAt 
        : null)
      if (date) {
        const year = new Date(date).getFullYear()
        years.add(year)
      }
    })
    
    // Add last 5 years for convenience
    for (let i = 1; i <= 5; i++) {
      years.add(currentYear - i)
    }
    
    return Array.from(years).sort((a, b) => b - a) // Descending order
  }, [items])

  const filteredItems = useMemo(() => {
    let filtered = items
    
    // Search query filter
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((d) => {
        const customerName = (d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || '').toLowerCase()
        const phone = (d.customerPhone || d.dcOrderId?.contact_mobile || '').toLowerCase()
        const product = getDcProductsText(d).toLowerCase()
        const status = (d.status || 'created').toLowerCase()
        
        return customerName.includes(query) || 
               phone.includes(query) || 
               product.includes(query) || 
               status.includes(query)
      })
    }
    
    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(d => (d.status || 'created') === selectedStatus)
    }
    
    // Product filter
    if (selectedProduct !== 'all') {
      filtered = filtered.filter(d => {
        const product = getDcProductsText(d)
        return product === selectedProduct
      })
    }
    
    // Year filter
    if (selectedYear !== 'all') {
      const year = parseInt(selectedYear)
      filtered = filtered.filter(d => {
        const date = d.createdAt || (typeof d.dcOrderId === 'object' && d.dcOrderId?.createdAt 
          ? d.dcOrderId.createdAt 
          : null)
        if (!date) return false
        return new Date(date).getFullYear() === year
      })
    }
    
    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(d => {
        const date = d.createdAt || (typeof d.dcOrderId === 'object' && d.dcOrderId?.createdAt 
          ? d.dcOrderId.createdAt 
          : null)
        if (!date) return false
        return new Date(date) >= new Date(dateFrom)
      })
    }
    
    if (dateTo) {
      filtered = filtered.filter(d => {
        const date = d.createdAt || (typeof d.dcOrderId === 'object' && d.dcOrderId?.createdAt 
          ? d.dcOrderId.createdAt 
          : null)
        if (!date) return false
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999) // Include entire end date
        return new Date(date) <= toDate
      })
    }
    
    // Sort by most recent turned date first
    return filtered.sort((a, b) => {
      // Get turned date: use dcOrderId.createdAt for converted leads, otherwise use createdAt
      const dateA = (typeof a.dcOrderId === 'object' && a.dcOrderId?.createdAt) 
        ? new Date(a.dcOrderId.createdAt).getTime()
        : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
      
      const dateB = (typeof b.dcOrderId === 'object' && b.dcOrderId?.createdAt)
        ? new Date(b.dcOrderId.createdAt).getTime()
        : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
      
      // Most recent first (descending order)
      return dateB - dateA
    })
  }, [items, searchQuery, selectedStatus, selectedProduct, selectedYear, dateFrom, dateTo])
  
  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (selectedStatus !== 'all') count++
    if (selectedProduct !== 'all') count++
    if (selectedYear !== 'all') count++
    if (dateFrom) count++
    if (dateTo) count++
    return count
  }, [selectedStatus, selectedProduct, selectedYear, dateFrom, dateTo])
  
  // Clear all filters
  const clearFilters = () => {
    setSelectedStatus('all')
    setSelectedProduct('all')
    setSelectedYear('all')
    setDateFrom('')
    setDateTo('')
    setSearchQuery('')
  }

  return (
    <div className="space-y-6 bg-gradient-to-br from-neutral-50 via-white to-neutral-50 min-h-screen w-full" style={{ overflowX: 'visible' }}>
      {/* Premium Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 bg-clip-text text-transparent">
            Client Request
          </h1>
          <p className="text-sm text-neutral-600 font-medium">
            Manage products, PO photos, and request details for your clients
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={load}
          className="shadow-md hover:shadow-lg transition-shadow border-neutral-200 bg-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Premium Filter Card */}
      <Card className="p-6 shadow-lg border-neutral-200 bg-white/80 backdrop-blur-sm w-full" style={{ maxWidth: '100%', overflow: 'visible' }}>
        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              placeholder="Search by client name, phone, product, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-10 h-11 border-neutral-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 hover:bg-neutral-100"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-11 px-4 border-neutral-200 ${showFilters ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-neutral-600 hover:text-neutral-900"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-neutral-200 space-y-4 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Year Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Year
                </Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-10 border-neutral-200 bg-white">
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700">Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="h-10 border-neutral-200 bg-white">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                    <SelectItem value="po_submitted">PO Submitted</SelectItem>
                    <SelectItem value="sent_to_manager">Sent to Manager</SelectItem>
                    <SelectItem value="pending_dc">Pending DC</SelectItem>
                    <SelectItem value="warehouse_processing">Warehouse Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="hold">Hold</SelectItem>
                    <SelectItem value="scheduled_for_later">Scheduled for Later</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Product Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700">Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger className="h-10 border-neutral-200 bg-white">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {uniqueProducts.map(product => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700">From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-10 border-neutral-200 bg-white"
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700">To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-10 border-neutral-200 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Chips */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-200 flex flex-wrap gap-2">
            {selectedStatus !== 'all' && (
              <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-2">
                Status: {selectedStatus}
                <button onClick={() => setSelectedStatus('all')} className="hover:text-blue-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedProduct !== 'all' && (
              <div className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-2">
                Product: {selectedProduct}
                <button onClick={() => setSelectedProduct('all')} className="hover:text-green-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {selectedYear !== 'all' && (
              <div className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium flex items-center gap-2">
                Year: {selectedYear}
                <button onClick={() => setSelectedYear('all')} className="hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {dateFrom && (
              <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-2">
                From: {new Date(dateFrom).toLocaleDateString()}
                <button onClick={() => setDateFrom('')} className="hover:text-orange-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {dateTo && (
              <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium flex items-center gap-2">
                To: {new Date(dateTo).toLocaleDateString()}
                <button onClick={() => setDateTo('')} className="hover:text-orange-900">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results Summary */}
        <div className="mb-4 flex items-center justify-between text-sm">
          <div className="text-neutral-600">
            Showing <span className="font-semibold text-neutral-900">{filteredItems.length}</span> of{' '}
            <span className="font-semibold text-neutral-900">{items.length}</span> clients
          </div>
        </div>

        {loading && (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-neutral-600">Loading clients...</p>
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="p-12 text-center bg-neutral-50 rounded-lg border border-neutral-200">
            <Package className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-700 font-medium">No clients found</p>
            <p className="text-sm text-neutral-500 mt-2">
              Closed leads and clients with products added and submitted will appear here.
            </p>
          </div>
        )}
        {!loading && items.length > 0 && filteredItems.length === 0 && (
          <div className="p-12 text-center bg-neutral-50 rounded-lg border border-neutral-200">
            <Search className="w-12 h-12 mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-700 font-medium">No clients match your filters</p>
            <p className="text-sm text-neutral-500 mt-2">
              Try adjusting your search or filter criteria
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                Clear Filters
              </Button>
            )}
          </div>
        )}
        {!loading && filteredItems.length > 0 && (
          <Card className="p-0 overflow-hidden shadow-2xl border-2 border-neutral-200/60 bg-white/95 backdrop-blur-sm">
            {/* Table Container Box */}
            <div className="relative group bg-white rounded-lg">
              {/* Decorative top border */}
              <div className="h-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20"></div>
              
              <div 
                className="overflow-x-auto w-full bg-white" 
                style={{ 
                  maxWidth: '100%',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  overflowX: 'auto',
                  overflowY: 'visible'
                }}
              >
                <Table className="min-w-[1200px] w-full">
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-neutral-50 via-neutral-50 to-neutral-100 border-b-2 border-neutral-200/80 sticky top-0 z-20">
                  <TableHead className="w-[50px] font-bold text-neutral-700 py-4">S.No</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">School Code</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Client Name</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Phone</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Product</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Status</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Created Date</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">Client Turned Date</TableHead>
                  <TableHead className="font-bold text-neutral-700 py-4">PO</TableHead>
                  <TableHead className="text-center font-bold text-neutral-700 py-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-neutral-500 py-4">
                      No clients found matching your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((d, idx) => {
                    const customerName = d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || 'Unknown Client'
                    const phone = d.customerPhone || d.dcOrderId?.contact_mobile || '-'
                    const product = getDcProductsText(d) || '-'
                    const status = d.status || 'created'
                    const createdDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'
                    // Client turned date: use dcOrderId.createdAt for converted leads, otherwise use createdAt
                    const turnedDate = (typeof d.dcOrderId === 'object' && d.dcOrderId?.createdAt)
                      ? new Date(d.dcOrderId.createdAt).toLocaleDateString()
                      : (d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-')
                    // Prefer school_code, fallback to dc_code for older records
                    const schoolCode = (typeof d.dcOrderId === 'object')
                      ? (d.dcOrderId?.school_code || d.dcOrderId?.dc_code || '-')
                      : '-'
                    
                    return (
                      <TableRow key={d._id} className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-neutral-50 transition-all duration-200 border-b border-neutral-100/80 hover:shadow-sm">
                        <TableCell className="font-medium text-neutral-600">{idx + 1}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{schoolCode}</TableCell>
                        <TableCell className="font-semibold text-neutral-900">{customerName}</TableCell>
                        <TableCell className="text-neutral-700">{phone}</TableCell>
                        <TableCell className="max-w-[320px] whitespace-normal break-words text-neutral-700" title={product}>{product}</TableCell>
                        <TableCell>
                          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm ${
                            status === 'created' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            status === 'po_submitted' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                            status === 'sent_to_manager' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                            status === 'warehouse_processing' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                            status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          {d.dcType === 'shortage' && (
                            <span className="ml-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">
                              Shortage DC
                            </span>
                          )}
                          {d.fulfillmentStatus === 'partial' && (
                            <span className="ml-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              Partial
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-neutral-600">{createdDate}</TableCell>
                        <TableCell className="text-neutral-600 font-medium">{turnedDate}</TableCell>
                        <TableCell>
                          {d.poPhotoUrl ? (
                            <Button
                              variant="link"
                              size="sm"
                              className="text-blue-600 hover:text-blue-800 p-0 h-auto font-medium"
                              onClick={() => {
                                setViewingPoUrl(d.poPhotoUrl || null)
                                setViewingPoOpen(true)
                              }}
                            >
                              View PO
                            </Button>
                          ) : (
                            <span className="text-sm text-neutral-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {status === 'created' || status === 'po_submitted' ? (
                          <div className="flex items-center gap-2 justify-center">
                            {d.poPhotoUrl && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openEditPODialog(d)}
                                className="border-neutral-200 hover:bg-neutral-50 shadow-sm"
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit PO
                              </Button>
                            )}
                              {/* Always show Edit PO button if dcOrderId exists, even without PO photo */}
                              {!d.poPhotoUrl && d.dcOrderId && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openEditPODialog(d)}
                                  className="border-neutral-200 hover:bg-neutral-50 shadow-sm"
                                >
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit PO
                                </Button>
                              )}
                              {/* Request DC: transport via Edit PO, no pending PO edits */}
                              {dcsWithCompleteTransport.has(d._id) &&
                                !dcsWithPendingChanges.has(d._id) &&
                                !dcsWithPendingEditRequests.has(d._id) && (
                            <Button 
                              size="sm" 
                              onClick={() => openClientDCDialog(d)}
                              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg"
                            >
                              <Package className="w-4 h-4 mr-2" />
                              Request DC
                            </Button>
                              )}
                              {!dcsWithCompleteTransport.has(d._id) &&
                                !dcsWithPendingChanges.has(d._id) &&
                                !dcsWithPendingEditRequests.has(d._id) && (
                                <span className="text-xs text-neutral-500 max-w-[140px] text-center">
                                  Complete transport in Edit PO to request DC
                                </span>
                              )}
                          </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => openInvoiceView(d)}
                                className="border-neutral-200 hover:bg-neutral-50 shadow-sm"
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                View Invoice
                              </Button>
                              {status === 'completed' && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <Select
                                    value={followUpStudentTypeSelectValue(followUpStudentTypeByDcId[d._id])}
                                    onValueChange={(v) =>
                                      setFollowUpStudentTypeByDcId((p) => ({
                                        ...p,
                                        [d._id]: parseFollowUpStudentTypeSelectValue(v),
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-full sm:w-[200px] text-xs border-orange-200">
                                      <SelectValue placeholder="Student type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value={STUDENT_TYPE_PLACEHOLDER}>Select student type</SelectItem>
                                      {STUDENT_TYPE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                          {opt}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleFollowUpStudentTypeContinue(d)}
                                    className="border-orange-200 text-orange-700 hover:bg-orange-50 shadow-sm shrink-0"
                                  >
                                    Continue
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
              </div>
              {/* Enhanced Scroll indicator hint */}
              <div className="absolute right-0 top-1 bottom-1 w-12 bg-gradient-to-l from-white via-white/90 to-transparent pointer-events-none flex items-center justify-end pr-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-r-lg">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xs text-neutral-500 font-bold animate-pulse">→</div>
                  <div className="text-[10px] text-neutral-400">Scroll</div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </Card>

      {/* PO View Modal */}
      <Dialog open={viewingPoOpen} onOpenChange={setViewingPoOpen}>
        <DialogContent className="sm:max-w-[90vw] lg:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Purchase Order (PO)</DialogTitle>
            <DialogDescription>
              View the purchase order document
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {viewingPoUrl && (() => {
              const displayPoUrl = resolveUploadUrl(viewingPoUrl)
              return (
              <div className="relative">
                {displayPoUrl.toLowerCase().endsWith('.pdf') || 
                 displayPoUrl.includes('application/pdf') || 
                 displayPoUrl.includes('.pdf') ||
                 (viewingPoUrl.startsWith('data:') && viewingPoUrl.includes('application/pdf')) ||
                 (displayPoUrl.startsWith('http') && displayPoUrl.toLowerCase().includes('.pdf')) ? (
                  <div className="border rounded-lg p-4 bg-neutral-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">PO Document (PDF)</span>
                      <a 
                        href={displayPoUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        Open PDF in New Tab
                      </a>
                    </div>
                    {viewingPoUrl.startsWith('data:') ? (
                      <iframe 
                        src={viewingPoUrl} 
                        className="w-full h-[70vh] rounded border"
                        title="PO Document"
                      />
                    ) : (
                      <iframe 
                        src={`${displayPoUrl}#toolbar=0`} 
                        className="w-full h-[70vh] rounded border"
                        title="PO Document"
                      />
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <img 
                      src={displayPoUrl} 
                      alt="PO Document" 
                      className="w-full h-auto rounded border max-h-[70vh] object-contain bg-neutral-50 mx-auto"
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
                                <iframe src="${target.src}" class="w-full h-[70vh] rounded border" title="PO Document"></iframe>
                              </div>
                            `
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            )})()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
        <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Shortage DC</DialogTitle>
            <DialogDescription>
              Original DC is read-only. Enter shortage quantities to create a linked shortage DC.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm bg-neutral-50">
              <div><span className="font-medium">Parent DC:</span> {shortageParentDC?._id || '-'}</div>
              <div><span className="font-medium">Client:</span> {shortageParentDC?.customerName || shortageParentDC?.dcOrderId?.school_name || '-'}</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Product Category</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Ordered</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortageRows.map((row, idx) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.product || '-'}</TableCell>
                    <TableCell className="min-w-[140px]">
                      {hasProductCategories(row.product) ? (
                        <Select
                          value={row.productCategory || getProductCategories(row.product)[0] || ''}
                          onValueChange={(v) => {
                            setShortageRows((prev) => {
                              const updated = [...prev]
                              updated[idx] = { ...updated[idx], productCategory: v }
                              return updated
                            })
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const opts = getProductCategories(row.product)
                              const cur = (row.productCategory || '').trim()
                              const list = cur && !opts.includes(cur) ? [...opts, cur] : opts
                              return list.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-neutral-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>{row.class}</TableCell>
                    <TableCell>{row.orderedQuantity}</TableCell>
                    <TableCell>{row.deliveredQuantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={Math.max(row.orderedQuantity, 0)}
                        value={row.shortageQuantity}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0)
                          const capped = Math.max(0, Math.min(value, row.orderedQuantity))
                          setShortageRows((prev) => {
                            const updated = [...prev]
                            updated[idx] = { ...updated[idx], shortageQuantity: capped }
                            return updated
                          })
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <Label className="mb-2 block">Remarks</Label>
              <Textarea
                value={shortageNotes}
                onChange={(e) => setShortageNotes(e.target.value)}
                placeholder="Optional shortage remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortageDialogOpen(false)} disabled={savingShortage}>Cancel</Button>
            <Button onClick={handleCreateShortageDC} disabled={savingShortage}>
              {savingShortage ? 'Creating...' : 'Create Shortage DC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              </div>
              {dcPoPhotoUrl ? (
                <div className="relative">
                  {dcPoDisplayUrl.toLowerCase().endsWith('.pdf') || 
                   dcPoDisplayUrl.includes('application/pdf') || 
                   dcPoDisplayUrl.includes('.pdf') ||
                   (dcPoPhotoUrl.startsWith('data:') && dcPoPhotoUrl.includes('application/pdf')) ||
                   (dcPoDisplayUrl.startsWith('http') && dcPoDisplayUrl.toLowerCase().includes('.pdf')) ? (
                    <div className="border rounded-lg p-4 bg-neutral-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">PO Document (PDF)</span>
                        <a 
                          href={dcPoDisplayUrl} 
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
                          src={`${dcPoDisplayUrl}#toolbar=0`} 
                          className="w-full h-96 rounded border"
                          title="PO Document"
                        />
                      )}
                    </div>
                  ) : (
                    <img 
                      src={dcPoDisplayUrl} 
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
                </div>
              ) : (
                <div className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-neutral-400" />
                  <p className="text-sm text-neutral-500">No PO photo uploaded</p>
                </div>
              )}
            </div>

            {/* School/Client Information (from Edit PO) */}
            {dcOrderData && (
              <div className="border rounded-lg p-6 space-y-4">
                <Label className="text-lg font-semibold mb-4 block">School/Client Information</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>School Name</Label>
                    <Input
                      value={dcOrderData.school_name || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Contact Person</Label>
                    <Input
                      value={dcOrderData.contact_person || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Contact Mobile</Label>
                    <Input
                      value={dcOrderData.contact_mobile || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                </div>
                  <div>
                    <Label>Email</Label>
                  <Input
                      value={dcOrderData.email || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Contact Person 2 (Decision Maker)</Label>
                  <Input
                      value={dcOrderData.contact_person2 || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Contact Mobile 2</Label>
                    <Input
                      value={dcOrderData.contact_mobile2 || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Textarea
                      value={dcOrderData.address || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={dcOrderData.location || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div>
                    <Label>Zone</Label>
                    <Input
                      value={dcOrderData.zone || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Remarks</Label>
                    <Textarea
                      value={dcOrderData.remarks || ''}
                      readOnly
                      disabled
                      className="bg-neutral-50"
                      rows={2}
                    />
                  </div>
                </div>
                </div>
              )}

            {/* Transport Details (from Edit PO / DcOrder) */}
            <div className="border rounded-lg p-6 space-y-4">
              <Label className="text-lg font-semibold mb-4 block">Transport Details</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Transport Name</Label>
                  <Input
                    value={
                      (dcOrderData?.pendingEdit?.transport_name as string) ??
                      (dcOrderData?.transport_name as string) ??
                      ''
                    }
                    readOnly
                    disabled
                    className="bg-neutral-50"
                  />
                </div>
                <div>
                  <Label>Transport Location</Label>
                  <Input
                    value={
                      (dcOrderData?.pendingEdit?.transport_location as string) ??
                      (dcOrderData?.transport_location as string) ??
                      ''
                    }
                    readOnly
                    disabled
                    className="bg-neutral-50"
                  />
                </div>
                <div>
                  <Label>Transportation Landmark</Label>
                  <Input
                    value={
                      (dcOrderData?.pendingEdit?.transportation_landmark as string) ??
                      (dcOrderData?.transportation_landmark as string) ??
                      ''
                    }
                    readOnly
                    disabled
                    className="bg-neutral-50"
                  />
                </div>
                <div>
                  <Label>Pincode</Label>
                  <Input
                    value={
                      (dcOrderData?.pendingEdit?.pincode as string) ??
                      (dcOrderData?.pincode as string) ??
                      ''
                    }
                    readOnly
                    disabled
                    className="bg-neutral-50"
                  />
                </div>
              </div>
            </div>

            {/* Products Table */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">Products & Quantities</Label>
              </div>
              
              {dcProductRows.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <Package className="w-12 h-12 mx-auto mb-2 text-neutral-300" />
                  <p className="text-sm">No products added yet</p>
                  <p className="text-xs mt-1">Use the "Add Product" button below to add products to this client</p>
                </div>
              ) : (() => {
                // Helper function to render a product row (no Term column in UI)
                const renderProductRow = (row: typeof dcProductRows[0]) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-3 px-4 border-r">
                      <Input
                        type="text"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.product}
                        readOnly
                        disabled
                      />
                    </td>
                    <td className="py-2 px-3 border-r">
                      <Input
                        type="text"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.class}
                        readOnly
                        disabled
                      />
                    </td>
                    <td className="py-3 px-4 border-r">
                      <Input
                        type="text"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.productCategory || ''}
                        readOnly
                        disabled
                      />
                    </td>
                    <td className="py-3 px-4 border-r">
                      <Input
                        type="text"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.specs || 'Regular'}
                        readOnly
                        disabled
                      />
                    </td>
                    <td className="py-3 px-4 border-r">
                      <Input
                        type="number"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.strength || ''}
                        readOnly
                        disabled
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="py-3 px-4 border-r">
                      <Input
                        type="text"
                        className="h-10 text-sm bg-neutral-50"
                        value={row.level}
                        readOnly
                        disabled
                      />
                    </td>
                  </tr>
                )

                // Check if all products have the same term
                // "Both" is treated as Term 1 for display purposes
                const terms = dcProductRows.map(row => {
                  const term = row.term || 'Term 1'
                  return term === 'Both' ? 'Term 1' : term
                })
                const uniqueTerms = Array.from(new Set(terms))
                const hasDifferentTerms = uniqueTerms.length > 1 || uniqueTerms.includes('Term 2')

                // If all products have the same term, show single table
                if (!hasDifferentTerms) {
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-neutral-100 border-b">
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Class</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product Category</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Specs</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Strength</th>
                            <th className="py-3 px-4 text-left text-sm font-semibold border-r">Level</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dcProductRows.map((row) => renderProductRow(row))}
                        {/* Total Row */}
                        <tr className="border-t-2 border-neutral-300 bg-neutral-100 font-semibold">
                          <td colSpan={4} className="px-3 py-3 text-right">
                            <span className="text-neutral-700">Total:</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {dcProductRows.reduce(
                              (sum, row) => sum + (Number(row.strength) || 0),
                              0
                            )}
                          </td>
                          <td className="px-3 py-3"></td>
                        </tr>
                  </tbody>
                </table>
                    </div>
                  )
                }

                // If products have different terms, show separate tables
                // "Both" term products should appear in Term 1 table (they behave like Term 1)
                const term1Products = dcProductRows.filter(row => {
                  const term = row.term || 'Term 1'
                  return term === 'Term 1' || term === 'Both'
                })
                const term2Products = dcProductRows.filter(row => (row.term || 'Term 1') === 'Term 2')

                return (
                  <div className="space-y-6">
                    {/* Term 1 Products Table */}
                    {term1Products.length > 0 && (
                      <div>
                        <Label className="text-md font-semibold mb-3 block text-blue-700">Term 1 Products</Label>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-neutral-100 border-b">
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Class</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product Category</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Specs</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Strength</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Level</th>
                              </tr>
                            </thead>
                            <tbody>
                              {term1Products.map((row) => renderProductRow(row))}
                              {/* Total Row for Term 1 */}
                              <tr className="border-t-2 border-neutral-300 bg-neutral-100 font-semibold">
                                <td colSpan={5} className="px-3 py-3 text-right">
                                  <span className="text-neutral-700">Total:</span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {term1Products.reduce(
                                    (sum, row) => sum + (Number(row.strength) || 0),
                                    0
                                  )}
                                </td>
                                <td className="px-3 py-3"></td>
                              </tr>
                  </tbody>
                </table>
                        </div>
              </div>
              )}

                    {/* Term 2 Products Table */}
                    {term2Products.length > 0 && (
                      <div>
                        <Label className="text-md font-semibold mb-3 block text-green-700">Term 2 Products</Label>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-neutral-100 border-b">
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Class</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Product Category</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Specs</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Strength</th>
                                <th className="py-3 px-4 text-left text-sm font-semibold border-r">Level</th>
                              </tr>
                            </thead>
                            <tbody>
                              {term2Products.map((row) => renderProductRow(row))}
                              {/* Total Row for Term 2 */}
                              <tr className="border-t-2 border-neutral-300 bg-neutral-100 font-semibold">
                                <td colSpan={5} className="px-3 py-3 text-right">
                                  <span className="text-neutral-700">Total:</span>
                                </td>
                                <td className="px-3 py-3 text-right">
                                  {term2Products.reduce(
                                    (sum, row) => sum + (Number(row.strength) || 0),
                                    0
                                  )}
                                </td>
                                <td className="px-3 py-3"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            {selectedDC &&
              !dcsWithCompleteTransport.has(selectedDC._id) &&
              !dcsWithPendingChanges.has(selectedDC._id) &&
              !dcsWithPendingEditRequests.has(selectedDC._id) && (
              <p className="text-xs text-neutral-500 sm:mr-auto w-full sm:w-auto text-left">
                Complete Transport Name, Location, and Pincode in Edit PO first.
              </p>
            )}
            <Button variant="outline" onClick={() => setClientDCDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={requestClientDC}
              disabled={
                savingClientDC ||
                !selectedDC ||
                !dcsWithCompleteTransport.has(selectedDC._id) ||
                dcsWithPendingChanges.has(selectedDC._id) ||
                dcsWithPendingEditRequests.has(selectedDC._id)
              }
            >
              {savingClientDC ? 'Submitting...' : 'Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit PO Dialog */}
      <Dialog open={editPODialogOpen} onOpenChange={(open) => {
        setEditPODialogOpen(open)
        if (!open) {
          // Reset editing state when dialog closes
          setCurrentEditingDCId(null)
          setOriginalPDFUrl('')
          setOriginalProductNames([])
        }
      }}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1000px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit PO - {editFormData.school_name || 'Client'}</DialogTitle>
            <DialogDescription>
              Make changes to the PO. Changes will be saved instantly.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDcOrder && (
            <div className="space-y-6 py-4">
              {/* PO Document Upload Section at Top */}
              <div className="p-4 bg-neutral-50 rounded-lg border">
                <Label className="text-sm font-semibold text-neutral-700">PO Document</Label>
                <div className="mt-2">
                  {editFormData.pod_proof_url ? (
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 flex items-center justify-center bg-red-100 rounded border">
                        <FileText className="w-6 h-6 text-red-700" />
                      </div>
                      <div className="flex flex-col gap-2">
                        <a
                          href={resolveUploadUrl(editFormData.pod_proof_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View Current Document
                        </a>
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              onChange={handleEditPOPhotoUpload}
                              disabled={uploadingPO}
                              className="hidden"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={uploadingPO}
                              asChild
                            >
                              <span>
                                <Upload className="w-4 h-4 mr-1" />
                                {uploadingPO ? 'Uploading...' : 'Change'}
                              </span>
                            </Button>
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditFormData({ ...editFormData, pod_proof_url: '' })}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={handleEditPOPhotoUpload}
                          disabled={uploadingPO}
                          className="hidden"
                        />
                        <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 text-center hover:border-neutral-400 transition-colors">
                          <Upload className="w-8 h-8 mx-auto text-neutral-400" />
                          <p className="text-sm text-neutral-600 mt-2">
                            {uploadingPO ? 'Uploading...' : 'Click to upload PO document'}
                          </p>
                          <p className="text-xs text-neutral-500 mt-1">PDF or Image (max 5MB)</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>School Name</Label>
                  <Input
                    value={editFormData.school_name}
                    onChange={(e) => setEditFormData({ ...editFormData, school_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>School Type</Label>
                  <Input
                    value={editFormData.school_type}
                    onChange={(e) => setEditFormData({ ...editFormData, school_type: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input
                    value={editFormData.contact_person}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input
                    value={editFormData.contact_mobile}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_mobile: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact Person 2</Label>
                  <Input
                    value={editFormData.contact_person2}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_person2: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Contact Mobile 2</Label>
                  <Input
                    value={editFormData.contact_mobile2}
                    onChange={(e) => setEditFormData({ ...editFormData, contact_mobile2: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input
                    value={editFormData.zone}
                    onChange={(e) => setEditFormData({ ...editFormData, zone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={editFormData.remarks}
                    onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input
                    type="number"
                    value={editFormData.total_amount}
                    onChange={(e) => setEditFormData({ ...editFormData, total_amount: Number(e.target.value) || 0 })}
                    readOnly
                  />
                </div>
              </div>

              {/* Transport Details Section */}
              <div className="border-t pt-4">
                <Label className="text-lg font-semibold mb-4 block">Transport Details</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Transport Name *</Label>
                    <Input
                      value={editFormData.transport_name}
                      onChange={(e) => setEditFormData({ ...editFormData, transport_name: e.target.value })}
                      placeholder="Enter transport name"
                    />
                  </div>
                  <div>
                    <Label>Transport Location *</Label>
                    <Input
                      value={editFormData.transport_location}
                      onChange={(e) => setEditFormData({ ...editFormData, transport_location: e.target.value })}
                      placeholder="Enter transport location"
                    />
                  </div>
                  <div>
                    <Label>Transportation Landmark</Label>
                    <Input
                      value={editFormData.transportation_landmark}
                      onChange={(e) => setEditFormData({ ...editFormData, transportation_landmark: e.target.value })}
                      placeholder="Enter transportation landmark"
                    />
                  </div>
                  <div>
                    <Label>Pincode *</Label>
                    <Input
                      value={editFormData.pincode}
                      onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                      placeholder="Enter pincode"
                    />
                  </div>
                </div>
              </div>

              {/* Products Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Products</Label>
                  <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                        setAddProductDialogOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Product
                  </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddNewProductDialogOpen(true)
                      }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add New Product
                  </Button>
                  </div>
                </div>
                
                {/* Helper function to render a product row */}
                {(() => {
                  const renderProductRow = (row: typeof editProductRows[0], idx: number) => {
                    const actualIdx = editProductRows.findIndex(r => r.id === row.id)
                    return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              value={row.product_name}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                              updated[actualIdx].product_name = e.target.value
                                setEditProductRows(updated)
                              }}
                            placeholder="Enter product name"
                            className={row.product_name && availableProducts.includes(row.product_name) ? "bg-neutral-50" : ""}
                          />
                        </TableCell>
                        <TableCell>
                          {/* Level selector based on Products master configuration */}
                          <Select
                            value={
                              row.level ||
                              getAvailableLevels(row.product_name || '')[0] ||
                              getDefaultLevel(row.product_name || 'Abacus')
                            }
                            onValueChange={(value) => {
                              const updated = [...editProductRows]
                              updated[actualIdx].level = value
                              const t = termFromLevelLabel(value)
                              if (t) updated[actualIdx].term = t
                              setEditProductRows(updated)
                              // Recalculate total after level change (total is still qty × price)
                              setEditFormData({
                                ...editFormData,
                                total_amount: computeEditPOTotalAmount(updated),
                              })
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const catalog = getAvailableLevels(row.product_name || '')
                                const cur =
                                  row.level ||
                                  catalog[0] ||
                                  getDefaultLevel(row.product_name || 'Abacus')
                                const levelOptions = [...new Set([cur, ...catalog].filter(Boolean))]
                                return levelOptions.map((lvl) => (
                                  <SelectItem key={lvl} value={lvl}>
                                    {lvl}
                                  </SelectItem>
                                ))
                              })()}
                            </SelectContent>
                          </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                              updated[actualIdx].quantity = Number(e.target.value) || 0
                                setEditProductRows(updated)
                                // Update total amount
                              setEditFormData({
                                ...editFormData,
                                total_amount: computeEditPOTotalAmount(updated),
                              })
                              }}
                              min="0"
                            required
                            className={row.product_name && (!row.quantity || row.quantity <= 0) ? "border-red-500" : ""}
                            placeholder="Required"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.unit_price}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                              updated[actualIdx].unit_price = Number(e.target.value) || 0
                                setEditProductRows(updated)
                                // Update total amount
                              setEditFormData({
                                ...editFormData,
                                total_amount: computeEditPOTotalAmount(updated),
                              })
                              }}
                              min="0"
                              step="0.01"
                            required
                            readOnly={originalProductNames.includes(row.product_name)}
                            className={`${row.product_name && (!row.unit_price || row.unit_price <= 0) ? "border-red-500" : ""} ${originalProductNames.includes(row.product_name) ? "bg-neutral-50 cursor-not-allowed" : ""}`}
                            placeholder="Required"
                            title={originalProductNames.includes(row.product_name) ? "Unit price cannot be changed for original PO products" : ""}
                            />
                          </TableCell>
                          <TableCell>
                            {(row.quantity * row.unit_price).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                              const updated = editProductRows.filter((_, i) => i !== actualIdx)
                                setEditProductRows(updated)
                                // Recalculate total
                                setEditFormData({
                                  ...editFormData,
                                  total_amount: computeEditPOTotalAmount(updated),
                                })
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                    )
                  }

                  // Check if all products have the same term (excluding "Both")
                  const terms = editProductRows.map(row => row.term || 'Term 1')
                  const uniqueTerms = Array.from(new Set(terms))
                  const hasBothTerm = terms.includes('Both')
                  const hasDifferentTerms = uniqueTerms.length > 1 || hasBothTerm

                  // If all products have the same term (and it's not "Both"), show single table.
                  // In UI we call this "Level" instead of "Term".
                  if (!hasDifferentTerms) {
                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Product Name</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editProductRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center text-neutral-500 py-4">
                                  No products added yet
                                </TableCell>
                              </TableRow>
                            ) : (
                              editProductRows.map((row, idx) => renderProductRow(row, idx))
                            )}
                    </TableBody>
                  </Table>
                </div>
                    )
                  }

                  // If products have different terms, show separate tables
                  // Products with term "Both" should only appear in Term 1 table, not Term 2
                  const term1Products = editProductRows.filter(row => {
                    const term = row.term || 'Term 1'
                    return term === 'Term 1' || term === 'Both'
                  })
                  const term2Products = editProductRows.filter(row => {
                    const term = row.term || 'Term 1'
                    return term === 'Term 2'
                  })

                  return (
                    <div className="space-y-6">
                      {/* Term 1 Products Table */}
                      <div>
                        <Label className="text-md font-semibold mb-3 block text-blue-700">Products</Label>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term1Products.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-neutral-500 py-4">
                                    No Level 1 products added yet
                                  </TableCell>
                                </TableRow>
                              ) : (
                                term1Products.map((row, idx) => renderProductRow(row, idx))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Term 2 Products Table */}
                      <div>
                        <Label className="text-md font-semibold mb-3 block text-green-700">Products (Different Levels)</Label>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Product Name</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term2Products.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center text-neutral-500 py-4">
                                    No Level 2 products added yet
                                  </TableCell>
                                </TableRow>
                              ) : (
                                term2Products.map((row, idx) => renderProductRow(row, idx))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditPODialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={savePOChanges}
              disabled={submittingEdit}
            >
              {submittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Products Dialog (for Edit PO) - Shows only original PO products */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Select from products in this PO (from Close Lead)</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">PO Products</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {originalPOProducts.length} products from original PO
              </p>
              {originalPOProducts.length === 0 ? (
                <div className="p-4 border rounded bg-yellow-50 text-yellow-800 text-sm">
                  No products in this PO. Use "Add New Product" to add products from the database.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded p-3">
                  {originalPOProducts.map((product, index) => {
                    const productSpecs = getProductSpecs(product)
                    const hasSpecs = productSpecs.length > 0
                    const specCount = hasSpecs ? productSpecs.length : 1
                    // Check if this product is already added
                    const isAlreadyAdded = editProductRows.some(row => row.product_name === product)
                    
                    return (
                      <div key={`${product}-${index}`} className={`flex items-center justify-between p-2 border rounded hover:bg-neutral-50 ${isAlreadyAdded ? 'bg-green-50 border-green-200' : ''}`}>
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-sm font-medium">{product}</span>
                          {hasSpecs && (
                            <span className="text-xs text-neutral-500">({specCount} specs - {productSpecs.join(', ')})</span>
                          )}
                          {isAlreadyAdded && (
                            <span className="text-xs text-green-600 font-medium">(Added)</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={isAlreadyAdded ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            // Add product to editProductRows
                            const newRow = {
                              id: Date.now().toString(),
                              product_name: product,
                              quantity: 0,
                              unit_price: 0,
                              level: getAvailableLevels(product)[0] || getDefaultLevel(product || 'Abacus'),
                              term: 'Term 1',
                            }
                            setEditProductRows([...editProductRows, newRow])
                            setAddProductDialogOpen(false)
                          }}
                          className="text-xs"
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          {isAlreadyAdded ? 'Add Another' : 'Add'}
                        </Button>
    </div>
  )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddProductDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog - Shows all products from database */}
      <Dialog open={addNewProductDialogOpen} onOpenChange={setAddNewProductDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>Select from all available products in the database</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">All Available Products</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {availableProducts.length} products available in database
              </p>
              {availableProducts.length === 0 ? (
                <div className="p-4 border rounded bg-yellow-50 text-yellow-800 text-sm">
                  No products available in database.
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded p-3">
                  {availableProducts.map((product, index) => {
                    const productSpecs = getProductSpecs(product)
                    const hasSpecs = productSpecs.length > 0
                    const specCount = hasSpecs ? productSpecs.length : 1
                    // Check if this product is already added
                    const isAlreadyAdded = editProductRows.some(row => row.product_name === product)
                    // Check if this product is from original PO
                    const isFromPO = originalPOProducts.includes(product)
                    
                    return (
                      <div key={`new-${product}-${index}`} className={`flex items-center justify-between p-2 border rounded hover:bg-neutral-50 ${isAlreadyAdded ? 'bg-green-50 border-green-200' : ''}`}>
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-sm font-medium">{product}</span>
                          {hasSpecs && (
                            <span className="text-xs text-neutral-500">({specCount} specs - {productSpecs.join(', ')})</span>
                          )}
                          {isFromPO && (
                            <span className="text-xs text-blue-600 font-medium">(In PO)</span>
                          )}
                          {isAlreadyAdded && (
                            <span className="text-xs text-green-600 font-medium">(Added)</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={isAlreadyAdded ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            // Add product to editProductRows
                            const newRow = {
                              id: Date.now().toString(),
                              product_name: product,
                              quantity: 0,
                              unit_price: 0,
                              level: getAvailableLevels(product)[0] || getDefaultLevel(product || 'Abacus'),
                              term: 'Term 1',
                            }
                            setEditProductRows([...editProductRows, newRow])
                            setAddNewProductDialogOpen(false)
                          }}
                          className="text-xs"
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          {isAlreadyAdded ? 'Add Another' : 'Add'}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNewProductDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice View Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="bg-green-600 text-white p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-green-700 p-0 h-auto"
                onClick={() => setInvoiceModalOpen(false)}
              >
                ←
              </Button>
              <DialogTitle className="text-white">Payments Info [{invoiceData?.financialYear || '2025-26'}]</DialogTitle>
            </div>
          </DialogHeader>
          
          {invoiceData && (
            <div className="bg-white">
              {/* Payment Information List */}
              <div className="divide-y divide-neutral-200">
                {/* School Name */}
                <div className="flex justify-between items-center p-4 bg-neutral-50">
                  <span className="text-teal-600 font-medium">School Name:</span>
                  <span className="text-black font-medium">{invoiceData.schoolInfo.customerName || '-'}</span>
                </div>

                {/* Previous Due */}
                <div className="flex justify-between items-center p-4 bg-white">
                  <span className="text-teal-600 font-medium">Previous Due:</span>
                  <span className="text-black">Rs.{invoiceData.previousDue?.toFixed(2) || '0.00'}</span>
                </div>

                {invoiceData.invoicePending && (
                  <div className="p-4 bg-amber-50 border-y border-amber-200 text-amber-800 text-sm">
                    {invoiceData.invoicePendingMessage || 'Invoice not generated yet'}
                  </div>
                )}

                {/* Current Total Bill */}
                <div className="flex justify-between items-center p-4 bg-neutral-50">
                  <span className="text-teal-600 font-medium">Current Total Bill:</span>
                  <span className="text-black">Rs.{invoiceData.totalAmount?.toFixed(2) || '0.00'}</span>
                </div>

                {/* TotalPaidAsOn */}
                <div className="flex justify-between items-center p-4 bg-white">
                  <span className="text-teal-600 font-medium">TotalPaidAsOn:</span>
                  <span className="text-black">Rs.{invoiceData.totalPaidAsOn?.toFixed(2) || '0.00'}</span>
                </div>

                {/* TotalReturnValue */}
                <div className="flex justify-between items-center p-4 bg-neutral-50">
                  <span className="text-teal-600 font-medium">TotalReturnValue:</span>
                  <span className="text-black">Rs.{invoiceData.totalReturnValue?.toFixed(2) || '0.00'}</span>
                </div>

                {/* TotalDue */}
                <div className="flex justify-between items-center p-4 bg-white">
                  <span className="text-teal-600 font-medium">TotalDue:</span>
                  <span className="text-black">Rs.{invoiceData.totalDue?.toFixed(2) || '0.00'}</span>
                </div>

                {/* Products from Database */}
                {invoiceData.paymentBreakdown && invoiceData.paymentBreakdown.length > 0 ? (
                  invoiceData.paymentBreakdown.map((product: any, index: number) => {
                    // Use strength as quantity (number of students/items), fallback to quantity field
                    const quantity = product.strength !== undefined ? product.strength : (product.quantity !== undefined ? product.quantity : 0)
                    // Get price from database - unitPrice comes from DcOrder or DC productDetails (both from database)
                    const price = product.unitPrice !== undefined && product.unitPrice !== null 
                      ? Number(product.unitPrice) 
                      : (product.price !== undefined && product.price !== null 
                          ? Number(product.price) 
                          : 0)
                    const productName = product.product || 'Product'
                    const bgColor1 = (index * 2) % 2 === 0 ? 'bg-neutral-50' : 'bg-white'
                    const bgColor2 = (index * 2 + 1) % 2 === 0 ? 'bg-neutral-50' : 'bg-white'
                    
                    return (
                      <div key={index}>
                        {/* Product Quantity - show 0 if quantity is 0 */}
                        <div className={`flex justify-between items-center p-4 ${bgColor1}`}>
                          <span className="text-teal-600 font-medium">{productName}:</span>
                          <span className="text-black">{quantity}</span>
                        </div>
                        {/* Product Price - from database (DcOrder.unit_price or DC.productDetails.price) */}
                        <div className={`flex justify-between items-center p-4 ${bgColor2}`}>
                          <span className="text-teal-600 font-medium">{productName}Price:</span>
                          <span className="text-black">{price > 0 ? `Rs.${price.toFixed(2)}` : '-'}</span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex justify-between items-center p-4 bg-neutral-50">
                    <span className="text-teal-600 font-medium">No products found</span>
                    <span className="text-black">-</span>
                  </div>
                )}

                {/* OtherCharges */}
                <div className="flex justify-between items-center p-4 bg-neutral-50">
                  <span className="text-teal-600 font-medium">OtherCharges:</span>
                  <span className="text-black">{invoiceData.otherCharges?.toFixed(2) || '0.00'}</span>
                </div>

                {/* OtherChargesRemarks */}
                <div className="flex justify-between items-center p-4 bg-white">
                  <span className="text-teal-600 font-medium">OtherChargesRemarks:</span>
                  <span className="text-black">{invoiceData.otherChargesRemarks || '-'}</span>
                </div>

                {/* Discount */}
                <div className="flex justify-between items-center p-4 bg-neutral-50">
                  <span className="text-teal-600 font-medium">Discount:</span>
                  <span className="text-black">{invoiceData.discount?.toFixed(2) || '0.00'}</span>
                </div>

                {/* DiscountRemarks */}
                <div className="flex justify-between items-center p-4 bg-white">
                  <span className="text-teal-600 font-medium">DiscountRemarks:</span>
                  <div className="flex-1 max-w-[200px] ml-4">
                    <Textarea
                      value={invoiceData.discountRemarks || ''}
                      readOnly
                      disabled
                      className="bg-neutral-100 rounded-lg text-sm min-h-[40px]"
                      placeholder=""
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="p-4 border-t">
            <Button variant="outline" onClick={() => setInvoiceModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

