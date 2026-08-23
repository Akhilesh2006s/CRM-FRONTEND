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
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Package, Plus, Upload, X, Search, CreditCard, FileText, PlusCircle, Filter, Calendar, RefreshCw } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import { applyPaymentDivisorsToBreakdown } from '@/lib/dcPaymentDivisors'
import { persistProductTerm, termFromLevelLabel } from '@/lib/productTerm'
import { shortageParentRowKey } from '@/lib/shortageDcRowKey'
import {
  buildClientDCProductRows,
  resolveClientDCRowTerm,
  findMatchingOrderProduct,
  findPricedOrderProduct,
  collectPoUnitPriceSources,
  resolvePersistedUnitPrice,
  resolveClientDCRowFields,
  dedupeProductDetailLines,
  lineMatchesTermWiseCompanion,
  displayProductLevel,
  collapseEmptyLevelDuplicateLines,
  keepMyClientsOwnedProductRows,
  orderProductToClientDcDetail,
  resolveAddEditPoProduct,
  expandEditPoRowsBySubject,
  editPoProductIdentity,
  ensureProductLineId,
  normalizeEditPoSubjectKey,
  normalizeEditPoCategoryKey,
  collectOriginalEditPoVariantKeys,
  isOriginalEditPoLine,
  editPoHasNewCommercialLines,
  dedupeSavedPoRows,
  requestDcRowQuantity,
  type ResolveClientDCRowOpts,
} from '@/lib/clientDcProductRows'
import {
  partitionRowsByTerm,
  shouldSplitTerm2ToTermWise,
  type RequestDcTermRouting,
} from '@/lib/clientDcTermPartition'
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
    pendingEdit?: { status?: string }
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
  const [requestDcTermRouting, setRequestDcTermRouting] = useState<RequestDcTermRouting | null>(
    null
  )
  const requestDcTermSplit = useMemo(
    () => partitionRowsByTerm(dcProductRows),
    [dcProductRows]
  )
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
  const [editProductRows, setEditProductRows] = useState<Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number | string
    class?: string
    specs?: string
    productCategory?: string
    category?: string
    strength?: number
    subject?: string
    selected_subjects?: string[]
    level?: string // Level configured on Products master; shown in Edit PO
    term?: string // Academic term (Term 1 / 2 / Both) for split tables
    lineId?: string
  }>>([])
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false)
  const [addNewProductDialogOpen, setAddNewProductDialogOpen] = useState(false)
  const [addProductSelectedSpec, setAddProductSelectedSpec] = useState<Record<string, string>>({})
  const [addProductSelectedCategory, setAddProductSelectedCategory] = useState<Record<string, string>>({})
  const [highlightedEditProductRowId, setHighlightedEditProductRowId] = useState<string | null>(null)
  const [originalPOProducts, setOriginalPOProducts] = useState<string[]>([])
  // Track original state for change detection
  const [originalPDFUrl, setOriginalPDFUrl] = useState<string>('')
  const [originalProductNames, setOriginalProductNames] = useState<string[]>([])
  const [originalProductVariantKeys, setOriginalProductVariantKeys] = useState<string[]>([])
  // Track which DCs have pending changes (PDF changed or new products added)
  const [dcsWithPendingChanges, setDcsWithPendingChanges] = useState<Set<string>>(new Set())
  // Track DCs with pending edit requests from backend
  const [dcsWithPendingEditRequests, setDcsWithPendingEditRequests] = useState<Set<string>>(new Set())
  // Track current DC being edited
  const [currentEditingDCId, setCurrentEditingDCId] = useState<string | null>(null)
  
  const {
    products: catalogProducts,
    productNames: availableProducts,
    getProductLevels,
    getDefaultLevel,
    getProductSpecs,
    getProductSubjects,
    hasProductSubjects,
    getProductCategories,
    hasProductCategories,
    getCalculationType,
    getProductId,
  } = useProducts()
  
  // Get available levels for a specific product, default to L1 if product not found
  const getAvailableLevels = (product: string): string[] => {
    return getProductLevels(product)
  }

  // Actual productLevels from Products master — empty means no level (not L1 / Term 1).
  const getConfiguredLevels = (productName: string): string[] => {
    const n = String(productName || '').trim().toLowerCase()
    const product = catalogProducts.find(
      (p) => String(p.productName || '').trim().toLowerCase() === n
    )
    if (!product || !Array.isArray(product.productLevels)) return []
    return product.productLevels.map((l) => String(l).trim()).filter(Boolean)
  }

  const resolveProductRowLevel = (productName: string, savedLevel?: string): string => {
    const configured = getConfiguredLevels(productName)
    if (configured.length === 0) return '-'
    const saved = String(savedLevel || '').trim()
    if (saved && saved !== '-' && configured.includes(saved)) return saved
    return configured[0]
  }

  const catalogSpecsForProduct = (productName: string): string[] => getProductSpecs(productName)

  const persistEditPoSpecs = (productName: string, savedSpec?: string): string => {
    const catalog = catalogSpecsForProduct(productName)
    if (catalog.length === 0) return ''
    const current = String(savedSpec || '').trim()
    if (current && catalog.includes(current)) return current
    return catalog[0] || ''
  }

  const initAddProductSpecs = (productNames: string[]) => {
    const next: Record<string, string> = {}
    productNames.forEach((name) => {
      const specs = catalogSpecsForProduct(name)
      if (specs.length > 0) next[name] = specs[0]
    })
    setAddProductSelectedSpec(next)
  }

  const resolveEditPoAdd = (
    product: string,
    rows = editProductRows,
    preferred?: { productCategory?: string; specs?: string }
  ) =>
    resolveAddEditPoProduct(
      product,
      rows,
      getConfiguredLevels(product),
      getProductId,
      resolveProductRowLevel,
      getProductSubjects(product),
      getProductCategories(product),
      {
        productCategory: preferred?.productCategory || addProductSelectedCategory[product],
        specs: preferred?.specs || addProductSelectedSpec[product],
      }
    )

  const initAddProductVariants = (productNames: string[]) => {
    initAddProductSpecs(productNames)
    const nextCats: Record<string, string> = {}
    productNames.forEach((name) => {
      const cats = getProductCategories(name)
      if (cats.length === 0) return
      const result = resolveAddEditPoProduct(
        name,
        editProductRows,
        getConfiguredLevels(name),
        getProductId,
        resolveProductRowLevel,
        getProductSubjects(name),
        cats,
        { specs: addProductSelectedSpec[name] || catalogSpecsForProduct(name)[0] }
      )
      nextCats[name] = result.productCategory || cats[0]
    })
    setAddProductSelectedCategory(nextCats)
  }

  const duplicateEditPoToast = (product: string) => {
    if (hasProductCategories(product) && !hasProductSubjects(product)) {
      return 'This product with this category is already added. Please edit the existing quantity.'
    }
    if (hasProductSubjects(product)) {
      return 'This product with this subject is already added. Please edit the existing quantity.'
    }
    return 'This product is already added. Please edit the existing quantity.'
  }

  const handleAddProductToEditPo = (product: string, closeDialog: () => void, selectedSpec?: string) => {
    const catalogSpecs = catalogSpecsForProduct(product)
    const specs = persistEditPoSpecs(
      product,
      selectedSpec || addProductSelectedSpec[product]
    )
    if (catalogSpecs.length > 0 && !specs) {
      toast.error(`Please select Specs for ${product}`)
      return
    }
    const { level, subject, productCategory, duplicateRow } = resolveEditPoAdd(product, editProductRows, {
      productCategory: addProductSelectedCategory[product],
      specs,
    })
    if (duplicateRow) {
      toast.error(duplicateEditPoToast(product))
      if (duplicateRow.id) setHighlightedEditProductRowId(String(duplicateRow.id))
      closeDialog()
      return
    }
    const term = termFromLevelLabel(level) ?? 'Term 1'
    const lineId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Date.now().toString()
    const nextRows = [
      ...editProductRows,
      {
        id: lineId,
        lineId,
        product_name: product,
        quantity: 0,
        unit_price: '' as const,
        class: '1',
        level,
        term,
        specs,
        productCategory: productCategory || undefined,
        subject: subject || undefined,
        selected_subjects: subject ? [subject] : [],
      },
    ]
    setEditProductRows(nextRows)
    const afterAdd = resolveEditPoAdd(product, nextRows, { specs })
    if (afterAdd.duplicateRow) closeDialog()
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
      // Exclude Term-Wise companion DCs (scheduled_for_later) — those belong on Term-Wise only.
      const filteredClients = dataArray.filter((dc: DC) => {
        if (dc.status === 'scheduled_for_later') return false

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
          // Drop Term-Wise companion rows if a mixed DC was saved incorrectly
          if (Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
            dc.productDetails = keepMyClientsOwnedProductRows(dc.productDetails)
          }
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
      
      // Check for pending edit requests in DcOrders (in parallel for better performance)
      const pendingEditCheckPromises = finalClients.map(async (dc) => {
        // Check if dcOrderId exists and is not null before accessing _id
        let dcOrderId = null
        if (dc.dcOrderId) {
          if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId._id) {
            dcOrderId = dc.dcOrderId._id
          } else if (typeof dc.dcOrderId === 'string') {
            dcOrderId = dc.dcOrderId
          }
        }
        if (!dcOrderId) return null
        
        // First check if dcOrderId object already has pendingEdit info
        if (typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null && dc.dcOrderId.pendingEdit) {
          if (dc.dcOrderId.pendingEdit.status === 'pending') {
            return dc._id
          }
          return null
        }
        
        // Otherwise, fetch the DcOrder to check
        try {
          const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
          if (dcOrder.pendingEdit && dcOrder.pendingEdit.status === 'pending') {
            console.log('DC has pending edit request:', dc._id, dcOrder.pendingEdit)
            return dc._id
          }
        } catch (e) {
          console.warn('Failed to check pending edit for DC:', dc._id, e)
        }
        return null
      })
      
      const pendingEditResults = await Promise.all(pendingEditCheckPromises)
      const pendingEditDCs = new Set<string>(pendingEditResults.filter((id): id is string => id !== null))
      setDcsWithPendingEditRequests(pendingEditDCs)
      
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

  // Keep Edit PO Total Amount in sync with sum of product row totals (qty × unit price)
  useEffect(() => {
    if (!editPODialogOpen) return
    const total = editProductRows.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
      0
    )
    setEditFormData((prev) =>
      prev.total_amount === total ? prev : { ...prev, total_amount: total }
    )
  }, [editProductRows, editPODialogOpen])

  useEffect(() => {
    if (!highlightedEditProductRowId) return
    const t = setTimeout(() => setHighlightedEditProductRowId(null), 4000)
    return () => clearTimeout(t)
  }, [highlightedEditProductRowId])

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
        const priceSources = collectPoUnitPriceSources(dcOrder)
        if (priceSources.length > 0) {
          const usedIndices = new Set<number>()

          paymentBreakdown = fullDC.productDetails.map((pd: any, index: number) => {
            const matchingProduct = findPricedOrderProduct(priceSources, pd, usedIndices)

            const unitPrice = resolvePersistedUnitPrice(
              matchingProduct?.unit_price,
              matchingProduct?.price,
              pd.unit_price,
              pd.price
            )
            const quantity = Number(pd.quantity) || Number(pd.strength) || 0
            const strength = Number(pd.strength) || quantity
            const total = quantity * unitPrice
            totalAmount += total

            const term = matchingProduct?.term || pd.term || 'Term 1'

            console.log(`Invoice Product[${index}]: ${pd.product}, UnitPrice: ₹${unitPrice}, Strength: ${strength}, Total: ₹${total}, Term: ${term}`)

            return {
              product: pd.product || '',
              class: pd.class || '1',
              category: pd.category || 'New School',
              specs: persistEditPoSpecs(pd.product, pd.specs),
              subject: pd.subject || undefined,
              quantity: quantity,
              strength: strength,
              level: displayProductLevel(pd.level),
              unitPrice: unitPrice,
              total: total,
              term: term,
            }
          })
        } else {
          paymentBreakdown = fullDC.productDetails.map((p: any) => {
            const price = resolvePersistedUnitPrice(p.unit_price, p.price)
            const quantity = Number(p.quantity) || Number(p.strength) || 0
            const strength = Number(p.strength) || quantity
            const total = quantity * price
            totalAmount += total
            return {
              product: p.product || '',
              class: p.class || '1',
              category: p.category || 'New School',
              specs: persistEditPoSpecs(p.product, p.specs),
              subject: p.subject || undefined,
              quantity: quantity,
              strength: strength,
              level: displayProductLevel(p.level),
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
          const price = resolvePersistedUnitPrice(pd.unit_price, pd.price)
          const quantity = Number(pd.quantity) || Number(pd.strength) || 0
          const strength = Number(pd.strength) || quantity
          const total = quantity * price
          totalAmount += total
          return {
            product: pd.product || '',
            class: pd.class || '1',
            category: pd.category || 'New School',
            specs: persistEditPoSpecs(pd.product, pd.specs),
            subject: pd.subject || undefined,
            quantity: quantity,
            strength: strength,
            level: displayProductLevel(pd.level),
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
            strength: Number(pb.strength) || Number(pb.quantity) || 0,
            unitPrice: Number(pb.unitPrice) || 0,
            level: pb.level,
            subject: pb.subject,
          })),
          getCalculationType,
          () => 0
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
      const totalDue = Math.max(
        0,
        previousDue + currentTotalBill - totalPaidAsOn - totalReturnValue
      )
      
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
    setRequestDcTermRouting(null)

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
    let dcOrderId: string | null = null
    const listOrder =
      dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId !== null
        ? (dc.dcOrderId as Record<string, any>)
        : null
    if (listOrder?._id) {
      dcOrderId = String(listOrder._id)
    } else if (typeof dc.dcOrderId === 'string') {
      dcOrderId = dc.dcOrderId
    }

    const buildTransportDisplay = (order: Record<string, any> | null | undefined) => {
      if (!order) {
        return {
          transport_name: '',
          transport_location: '',
          transportation_landmark: '',
          pincode: '',
        }
      }
      // Same source/priority as Edit PO: pending snapshot, then saved DcOrder fields
      const pe = order.pendingEdit?.status === 'pending' ? order.pendingEdit : null
      return {
        transport_name: String(pe?.transport_name ?? order.transport_name ?? '').trim(),
        transport_location: String(pe?.transport_location ?? order.transport_location ?? '').trim(),
        transportation_landmark: String(
          pe?.transportation_landmark ?? order.transportation_landmark ?? ''
        ).trim(),
        pincode: String(pe?.pincode ?? order.pincode ?? '').trim(),
      }
    }

    if (dcOrderId) {
      try {
        const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
        const pe = dcOrder.pendingEdit?.status === 'pending' ? dcOrder.pendingEdit : null
        const transport = buildTransportDisplay(dcOrder)
        // If API returned empty transport, fall back to already-loaded client/DC order data
        const listTransport = buildTransportDisplay(listOrder)
        
        // Store full DcOrder data for display (prioritize pendingEdit if exists, else use main fields)
        const displayData: any = {
          school_name: pe?.school_name || dcOrder.school_name || listOrder?.school_name || '',
          contact_person: pe?.contact_person || dcOrder.contact_person || listOrder?.contact_person || '',
          contact_mobile: pe?.contact_mobile || dcOrder.contact_mobile || listOrder?.contact_mobile || '',
          contact_person2: pe?.contact_person2 || dcOrder.contact_person2 || '',
          contact_mobile2: pe?.contact_mobile2 || dcOrder.contact_mobile2 || '',
          email: pe?.email || dcOrder.email || listOrder?.email || '',
          address: pe?.address || dcOrder.address || listOrder?.address || '',
          zone: pe?.zone || dcOrder.zone || listOrder?.zone || '',
          location: pe?.location || dcOrder.location || listOrder?.location || '',
          remarks: pe?.remarks || dcOrder.remarks || '',
          school_type: pe?.school_type || dcOrder.school_type || listOrder?.school_type || '',
          // Transport details — restored from DcOrder / pendingEdit (same as Edit PO)
          transport_name: transport.transport_name || listTransport.transport_name || '',
          transport_location: transport.transport_location || listTransport.transport_location || '',
          transportation_landmark:
            transport.transportation_landmark || listTransport.transportation_landmark || '',
          pincode: transport.pincode || listTransport.pincode || '',
          // Keep pendingEdit for any UI that still reads nested transport paths
          pendingEdit: pe || undefined,
          // Delivery address
          property_number: pe?.property_number || dcOrder.property_number || '',
          floor: pe?.floor || dcOrder.floor || '',
          tower_block: pe?.tower_block || dcOrder.tower_block || '',
          nearby_landmark: pe?.nearby_landmark || dcOrder.nearby_landmark || '',
          area: pe?.area || dcOrder.area || '',
          city: pe?.city || dcOrder.city || '',
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
        // Still populate transport/school from the selected client row when fetch fails
        if (listOrder) {
          const listTransport = buildTransportDisplay(listOrder)
          setDcOrderData({
            school_name: listOrder.school_name || '',
            contact_person: listOrder.contact_person || '',
            contact_mobile: listOrder.contact_mobile || '',
            email: listOrder.email || '',
            address: listOrder.address || '',
            zone: listOrder.zone || '',
            location: listOrder.location || '',
            school_type: listOrder.school_type || '',
            transport_name: listTransport.transport_name,
            transport_location: listTransport.transport_location,
            transportation_landmark: listTransport.transportation_landmark,
            pincode: listTransport.pincode,
          })
          deliveryData = { ...deliveryData, pincode: listTransport.pincode || '' }
        } else {
          setDcOrderData(null)
        }
      }
    } else {
      setDcOrderData(null)
    }
    setDeliveryAddress(deliveryData)
    
    // Load products from DcOrder (includes products added/edited in Edit PO)
    let dcOrderProducts: any[] = []
    let dcOrderDoc: any = null
    if (dcOrderId) {
      try {
        dcOrderDoc = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
        if (dcOrderDoc.products && Array.isArray(dcOrderDoc.products)) {
          dcOrderProducts = dcOrderDoc.products
        }
      } catch (e) {
        console.error('Failed to load DcOrder products:', e)
      }
    }
    
    // Load products belonging ONLY to this DC. Never merge sibling Term-Wise lines.
    let siblingRows: any[] = []
    if (dcOrderId) {
      try {
        const related = await apiRequest<any[]>(
          `/dc?dcOrderId=${encodeURIComponent(dcOrderId)}`
        )
        siblingRows = (Array.isArray(related) ? related : [])
          .filter((r: any) => r?.status === 'scheduled_for_later')
          .flatMap((r: any) => (Array.isArray(r.productDetails) ? r.productDetails : []))
      } catch (relErr) {
        console.warn('Could not load related DC lines for Request DC:', relErr)
      }
    }

    const pendingProducts =
      Array.isArray(dcOrderDoc?.pendingEdit?.products) && dcOrderDoc.pendingEdit.products.length > 0
        ? dcOrderDoc.pendingEdit.products
        : null
    const committedProducts =
      Array.isArray(dcOrderDoc?.products) && dcOrderDoc.products.length > 0
        ? dcOrderDoc.products
        : null
    const pendingSnapshot =
      dcOrderDoc?.pendingEdit?.status === 'pending' && pendingProducts ? pendingProducts : null
    // Same source Edit PO uses: last saved pending snapshot, else committed PO, else this DC.
    const savedPoProducts = pendingSnapshot || committedProducts || []
    if (savedPoProducts.length > 0) {
      dcOrderProducts = savedPoProducts
    }

    const rowOpts: ResolveClientDCRowOpts = { hasProductCategories, getProductCategories }
    const toRequestDcRows = (details: any[]) =>
      buildClientDCProductRows(
        dedupeSavedPoRows(
          keepMyClientsOwnedProductRows(
            collapseEmptyLevelDuplicateLines(details || []),
            siblingRows
          )
        ),
        dcOrderProducts,
        rowOpts,
        getDefaultLevel
      )

    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      let thisDetails: any[] = Array.isArray(fullDC.productDetails)
        ? [...fullDC.productDetails]
        : []

      thisDetails = keepMyClientsOwnedProductRows(thisDetails, siblingRows)
      const mappedSavedPo = keepMyClientsOwnedProductRows(
        (savedPoProducts || [])
          .map((p: any) => orderProductToClientDcDetail(p))
          .filter((p: any) => p.product),
        siblingRows
      )
      const poDeduped = dedupeSavedPoRows(mappedSavedPo)
      const dcDeduped = dedupeSavedPoRows(thisDetails)
      // Saved Edit PO rows win when they are at least as complete as this DC snapshot.
      // Close Lead still stores grouped P2 on the order (fewer rows) — keep the split DC lines.
      thisDetails =
        poDeduped.length > 0 && poDeduped.length >= dcDeduped.length
          ? poDeduped
          : dcDeduped.length > 0
            ? dcDeduped
            : poDeduped

      const productsToShow = toRequestDcRows(thisDetails)
      setDcProductRows(productsToShow)

      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(fullDC.dcRemarks || '')
      setDcCategory(fullDC.dcCategory || '')
      setDcNotes(fullDC.dcNotes || '')
      setDcPoPhotoUrl(fullDC.poPhotoUrl || '')
    } catch (e) {
      console.error('Failed to load DC details:', e)
      const fallbackDetails = (savedPoProducts || [])
        .map((p: any) => orderProductToClientDcDetail(p))
        .filter((p: any) => p.product)
      setDcProductRows(toRequestDcRows(keepMyClientsOwnedProductRows(fallbackDetails, siblingRows)))
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
              const key = shortageParentRowKey(p)
              const qty = Number(p.quantity || p.strength || 0)
              consumed.set(key, (consumed.get(key) || 0) + qty)
            })
          })
      }

      const rows = (Array.isArray(dc.productDetails) ? dc.productDetails : []).map((p: any, idx: number) => {
      const prodName = p.product || p.productName || ''
      const orderedQuantity = Number(p.quantity || p.strength || 0)
      const deliveredQuantity = Number(p.deliveredQuantity ?? orderedQuantity)
      const key = shortageParentRowKey(p)
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
            specs: persistEditPoSpecs(row.product_name || row.product, row.specs),
            quantity: Number(row.quantity) || 0,
            strength: Number(row.strength) || 0,
            level: row.level && row.level !== '-' ? row.level : '',
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

    // Validate transport details (must be filled via Edit PO first)
    const transportName =
      (dcOrderData?.transport_name as string) ||
      (dcOrderData?.pendingEdit?.transport_name as string) ||
      ''
    const transportLocation =
      (dcOrderData?.transport_location as string) ||
      (dcOrderData?.pendingEdit?.transport_location as string) ||
      ''
    const transportPincode =
      (dcOrderData?.pincode as string) ||
      (dcOrderData?.pendingEdit?.pincode as string) ||
      ''

    if (!transportName.trim() || !transportLocation.trim() || !transportPincode.trim()) {
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

      // Prepare product details owned by THIS My Clients DC only.
      const productDetails = keepMyClientsOwnedProductRows(
        dcProductRows.map((row) => ({
          lineId: ensureProductLineId(row),
          product: row.product || '',
          class: row.class || '1',
          category: normalizeStudentCategory(row.category) || defaultStudentCategory,
          productCategory: row.productCategory || undefined,
          specs: persistEditPoSpecs(row.product_name || row.product, row.specs),
          subject: row.subject || undefined,
          quantity: Number(row.quantity) || 0,
          strength: Number(row.strength) || 0,
          level: row.level && row.level !== '-' ? row.level : '',
          term: resolveClientDCRowTerm(row),
        }))
      )

      const totalQuantity = productDetails.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)

      const { term1Products, term2Products, hasMixedTerms, term2Only, term1Only } =
        partitionRowsByTerm(productDetails)

      if (hasMixedTerms && !requestDcTermRouting) {
        toast.error(
          'This DC has Term 1 and Term 2 products. Choose whether to send both terms to Closed Sales or only Term 1 (Term 2 goes to Term-Wise DC).'
        )
        setSavingClientDC(false)
        return
      }

      const splitTerm2 = shouldSplitTerm2ToTermWise(hasMixedTerms, requestDcTermRouting)
      const hasBothTerm = productDetails.some((p) => resolveClientDCRowTerm(p) === 'Both')
      const hasTerm1 = term1Products.length > 0
      const hasTerm2 = term2Products.length > 0

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

      if (splitTerm2) {
        console.log('📦 Request DC: Term 1 only to Closed Sales, Term 2 to Term-Wise DC')
        
        // Create Term 1 DC (goes to Closed Sales)
        const term1Quantity = term1Products.reduce((sum, p) => sum + (p.quantity || 0), 0)
        const term1Payload: any = {
          productDetails: term1Products,
          requestedQuantity: term1Quantity,
          // Stay po_submitted until admin/coordinator raises from Closed Sales → then pending_dc
          status: 'po_submitted',
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
      } else if (!term2Only) {
        console.log('📦 Request DC → Closed Sales queue (DcOrder dc_requested; not Pending DC yet)')
        updatePayload.status = 'po_submitted'
        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      } else if (term2Only) {
        // Term 2 only: still enter Closed Sales when Executive requests from My Clients.
        // (Previously parked only in Term-Wise and never set DcOrder dc_requested.)
        console.log('📦 Request DC (Term 2 only) → Closed Sales queue (DcOrder dc_requested)')
        updatePayload.status = 'po_submitted'
        updatedDC = await apiRequest(`/dc/${selectedDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(updatePayload),
        })
      } else {
        updatePayload.status = 'po_submitted'
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
          
          const priceSources = collectPoUnitPriceSources(dcOrder)
          if (priceSources.length > 0) {
            const usedIndices = new Set<number>()
            
            paymentBreakdown = productDetails.map((pd: any, index: number) => {
              const matchingProduct = findPricedOrderProduct(priceSources, pd, usedIndices)
              
              const unitPrice = resolvePersistedUnitPrice(
                matchingProduct?.unit_price,
                matchingProduct?.price,
                pd.unit_price,
                pd.price
              )
              const quantity = Number(pd.quantity) || Number(pd.strength) || 0
              const strength = Number(pd.strength) || quantity
              const total = unitPrice * quantity
              totalAmount += total
              
              console.log(`Payment Creation Product[${index}]: ${pd.product}, UnitPrice: ₹${unitPrice}, Quantity: ${quantity}, Strength: ${strength}, Total: ₹${total}`)
              
              return {
                product: pd.product || '',
                class: pd.class || '1',
                category: pd.category || 'New School',
                specs: persistEditPoSpecs(pd.product, pd.specs),
                subject: pd.subject || undefined,
                quantity: quantity,
                strength: strength,
                level: displayProductLevel(pd.level),
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
          const price = resolvePersistedUnitPrice(p.unit_price, p.price)
          const quantity = Number(p.quantity) || Number(p.strength) || 0
          const strength = Number(p.strength) || quantity
          const total = quantity * price
          totalAmount += total
          return {
            product: p.product || '',
            class: p.class || '1',
            category: p.category || 'New School',
            specs: persistEditPoSpecs(p.product, p.specs),
            subject: p.subject || undefined,
            quantity: quantity,
            strength: strength,
            level: displayProductLevel(p.level),
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
                specs: persistEditPoSpecs(pd.product, pd.specs),
                subject: pd.subject || undefined,
                quantity: quantity,
                strength: strength,
                level: displayProductLevel(pd.level),
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
            strength: Number(pb.strength) || Number(pb.quantity) || 0,
            unitPrice: Number(pb.unitPrice) || 0,
            level: pb.level,
            subject: pb.subject,
          })),
          getCalculationType,
          () => 0
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
      if (totalAmount > 0 && !term2Only) {
        console.log('ℹ️ Payment creation skipped in frontend; backend program-billing handles payable recomputation.')
      } else if (term2Only) {
        console.log('📦 Term 2 only DC - backend will handle cumulative billing at delivery completion')
      } else if (totalAmount === 0) {
        console.warn('⚠️ Total amount is 0; backend billing recompute will still run on delivery events')
      }

      // Update the related DcOrder status so Super Admin Closed Sales can find it.
      // Term 1, Both, and Term 2-only requests from My Clients all set dc_requested.
      // (Split Term 2 companion DCs still use scheduled_for_later on the Term 2 DC doc.)
      // Backend PUT /dc status=po_submitted already promotes the sale; this stores request details.
      if (selectedDC.dcOrderId) {
        try {
          const dcOrderId = typeof selectedDC.dcOrderId === 'object' 
            ? selectedDC.dcOrderId._id 
            : selectedDC.dcOrderId
          
          const currentUser = getCurrentUser()
          
          const productsForDcOrder = splitTerm2 ? term1Products : productDetails
          const quantityForDcOrder = splitTerm2
            ? term1Products.reduce((sum, p) => sum + (p.quantity || 0), 0)
            : totalQuantity
          console.log('[DC-ASSOC] Request DC persist payload', {
            dcId: selectedDC._id,
            splitTerm2,
            count: productsForDcOrder.length,
            total: quantityForDcOrder,
            lines: productsForDcOrder.map((p) => ({
              product: p.product,
              level: p.level,
              term: p.term,
              quantity: p.quantity,
            })),
          })
          
          console.log('🔄 Updating DcOrder status to dc_requested with request data:', dcOrderId)
          
          const updateResult = await apiRequest(`/dc-orders/${dcOrderId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
              status: 'dc_requested',
              dcRequestData: {
                productDetails: productsForDcOrder,
                requestedQuantity: quantityForDcOrder,
                employeeId: currentUser?._id || (
                  typeof selectedDC.employeeId === 'object'
                    ? selectedDC.employeeId?._id
                    : selectedDC.employeeId
                ),
                requestedAt: new Date().toISOString(),
                isSplit: splitTerm2,
                term2DCId: splitTerm2 ? term2DC?._id : undefined,
                requestDcTermRouting: requestDcTermRouting || undefined,
              }
            }),
          })
          
          console.log('✅ Updated DcOrder status to dc_requested:', {
            dcOrderId,
            newStatus: updateResult?.status,
            schoolName: updateResult?.school_name,
            isSplit: splitTerm2
          })
        } catch (dcOrderErr: any) {
          console.error('❌ Failed to update DcOrder status:', {
            error: dcOrderErr?.message,
            dcOrderId: typeof selectedDC.dcOrderId === 'object' 
              ? selectedDC.dcOrderId._id 
              : selectedDC.dcOrderId
          })
          throw new Error(
            dcOrderErr?.message ||
              'Request DC did not reach Closed Sales. Please try Request DC again.'
          )
        }
      } else {
        throw new Error('Cannot send to Closed Sales: this client has no linked sale.')
      }

      // Store invoice data for viewing
      // For split DCs, show Term 1 products in invoice (since payment is for Term 1)
      const invoiceBreakdown = splitTerm2
        ? paymentBreakdown.filter((p: any) => {
            const matchingProduct = term1Products.find(
              (tp) => (tp.product || '').toLowerCase() === (p.product || '').toLowerCase()
            )
            return matchingProduct !== undefined
          })
        : paymentBreakdown

      const invoiceAmount = splitTerm2
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
      if (splitTerm2) {
        toast.success(
          'Term 1 sent to Closed Sales. Term 2 DC will appear in Term-Wise DC (Executive Dashboard).'
        )
      } else if (hasMixedTerms && requestDcTermRouting === 'both_terms') {
        toast.success(
          'Term 1 and Term 2 sent together to Closed Sales for Admin/Coordinator review.'
        )
      } else if (term1Only || hasTerm1 || hasBothTerm || term2Only) {
        toast.success(
          'Request sent to Closed Sales. Admin/Coordinator will Raise DC; then it moves to Pending DC and warehouse.'
        )
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

  // Helper function to check if new products / subject variants were added
  const checkForNewProducts = (currentProducts: Array<{ product_name: string; subject?: string; selected_subjects?: string[] }>) => {
    if (!currentEditingDCId) return

    const hasNewProducts = editPoHasNewCommercialLines(
      currentProducts,
      originalProductVariantKeys,
      getProductId
    )

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
      const dcDetailsRaw = dedupeProductDetailLines(
        (Array.isArray(fullDC?.productDetails) ? fullDC.productDetails : []).filter((p: any) => {
          if (p?.closeLeadDestination === 'TERM_WISE_DC') return false
          return true
        })
      )
      // Last submitted Edit PO (pending) is what the user just saved. Do not reopen the older DC snapshot.
      const dcDetails =
        pe?.products?.length > 0
          ? pe.products.map((p: any) => orderProductToClientDcDetail(p)).filter((p: any) => p.product)
          : dcDetailsRaw
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

      setEditFormData(formData)

      const usedOrderIdx = new Set<number>()
      const rowsFromDetails =
        dcDetails.length > 0
          ? dcDetails.map((p: any, idx: number) => {
              const name = p.product || p.productName || ''
              const order = findMatchingOrderProduct(orderProducts, p, idx, usedOrderIdx)
              const merged = order
                ? {
                    ...p,
                    product: name,
                    class: p.class ?? order.class,
                    specs: p.specs ?? order.specs,
                    productCategory: p.productCategory ?? order.productCategory,
                    strength: Number(p.strength) || Number(p.quantity) || 0,
                    quantity: Number(p.quantity) || Number(p.strength) || 0,
                    price: p.price ?? order.unit_price,
                    level: p.level || order.level,
                    term: p.term ?? order.term,
                    subject: p.subject ?? order.subject,
                    selected_subjects: p.selected_subjects ?? order.selected_subjects,
                    lineId: p.lineId || order.lineId,
                  }
                : p
              const resolved = resolveClientDCRowFields(merged, name, rowOpts)
              const savedLevel = (merged.level && String(merged.level).trim()) || ''
              const level = savedLevel && savedLevel !== '-' ? savedLevel : '-'
              const term = persistProductTerm({
                term: merged.term,
                level: savedLevel || level,
              })
              const lineId = ensureProductLineId(merged, idx)
              return {
                id: lineId,
                lineId,
                product_name: name,
                quantity: Number(merged.quantity ?? merged.strength) || 0,
                unit_price: Number(merged.price ?? order?.unit_price) || 0,
                class: resolved.class,
                specs: persistEditPoSpecs(name, resolved.specs),
                productCategory: resolved.productCategory,
                category: merged.category,
                strength: Number(merged.strength ?? merged.quantity) || 0,
                subject: merged.subject,
                selected_subjects: Array.isArray(merged.selected_subjects) ? merged.selected_subjects : undefined,
                level,
                term,
              }
            })
          : []

      const expandedDetails = expandEditPoRowsBySubject(rowsFromDetails, getProductSubjects)
      // This DC's productDetails are the source of truth. Never substitute DcOrder.products —
      // that array still holds the unsplit lead (P3 L1+L2 summed to 14).
      setEditProductRows(expandedDetails)

      // Close Lead lines are the commercial original. If there is no pending EM request,
      // also snapshot whatever is already on this DC so empty-subject Close Lead rows
      // stay price-locked. Do not snapshot pendingEdit products — new P2+math / p6
      // must stay editable and keep going to the executive manager until approved.
      const originalProducts = Array.from(
        new Set((dcOrder.products || []).map((p: any) => p.product_name).filter(Boolean))
      )
      setOriginalPOProducts(originalProducts)

      const originalPDF = dcOrder.pod_proof_url || dc.poPhotoUrl || ''
      setOriginalPDFUrl(originalPDF)
      setOriginalProductNames(originalProducts)
      setOriginalProductVariantKeys(
        Array.from(
          new Set([
            ...collectOriginalEditPoVariantKeys(dcOrder.products || [], getProductId, getProductCategories),
            ...(pe ? [] : collectOriginalEditPoVariantKeys(expandedDetails, getProductId, getProductCategories)),
          ])
        )
      )

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
        return !row.quantity || row.quantity <= 0 || !row.unit_price || Number(row.unit_price) <= 0
      })
      
      if (invalidProducts.length > 0) {
        toast.error('Please fill in Quantity and Unit Price for all products')
        setSubmittingEdit(false)
        return
      }

      const missingSpecs = editProductRows.filter((row) => {
        const hasProductName = row.product_name && row.product_name.trim() !== ''
        if (!hasProductName) return false
        const catalog = catalogSpecsForProduct(row.product_name)
        if (catalog.length === 0) return false
        const spec = persistEditPoSpecs(row.product_name, row.specs)
        return !spec
      })
      if (missingSpecs.length > 0) {
        toast.error('Please select Specs for all products that require it')
        setSubmittingEdit(false)
        return
      }

      // Prepare products array
      const products = editProductRows
        .filter(row => row.product_name && row.product_name.trim() !== '') // Only include rows with product names
        .map(row => {
          const rawLevel = String(row.level || '').trim()
          const level = !rawLevel || rawLevel === '-' ? '' : rawLevel
          const qty = Number(row.quantity) || 0
          return {
            lineId: ensureProductLineId(row),
            product_name: row.product_name,
            quantity: qty,
            unit_price: Number(row.unit_price) || 0,
            total: qty * (Number(row.unit_price) || 0),
            class: row.class && String(row.class).trim() !== '' ? String(row.class).trim() : '1',
            specs: persistEditPoSpecs(row.product_name || row.product, row.specs),
            productCategory: hasProductCategories(row.product_name)
              ? (String(row.productCategory || '').trim() || getProductCategories(row.product_name)[0] || undefined)
              : undefined,
            category: row.category || undefined,
            strength: qty,
            term: persistProductTerm({ term: row.term, level }),
            level,
            subject: row.subject && String(row.subject).trim() !== '-' ? String(row.subject).trim() : undefined,
            selected_subjects:
              row.subject && String(row.subject).trim() !== '-'
                ? [String(row.subject).trim()]
                : [],
            closeLeadDestination: 'MY_CLIENT',
          }
        })

      // Calculate total amount
      const totalAmount = products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0)

      // Check if PDF changed or new products were added (compared to original Close Lead state)
      const pdfChanged = editFormData.pod_proof_url !== originalPDFUrl
      const hasNewProducts = editPoHasNewCommercialLines(
        products,
        originalProductVariantKeys,
        getProductId
      )
      
      console.log('🔍 Change Detection:', {
        pdfChanged,
        hasNewProducts,
        originalProductVariantKeys,
        newLines: products.filter((p) => !isOriginalEditPoLine(p, originalProductVariantKeys, getProductId))
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
        originatingDcId: selectedDC?._id || currentEditingDCId || undefined,
      }
      delete (payload as { status?: string }).status
      const dcProductDetailsPayload = editProductRows
        .filter((row) => row.product_name && row.product_name.trim() !== '')
        .map((row) => {
          const rawLevel = String(row.level || '').trim()
          const level = !rawLevel || rawLevel === '-' ? '' : rawLevel
          const qty = Number(row.quantity) || 0
          return {
            lineId: ensureProductLineId(row),
            product: row.product_name,
            class: row.class && String(row.class).trim() !== '' ? String(row.class).trim() : '1',
            specs: persistEditPoSpecs(row.product_name || row.product, row.specs),
            quantity: qty,
            strength: qty,
            level,
            term: persistProductTerm({ term: row.term, level }),
            subject: row.subject && String(row.subject).trim() !== '-' ? String(row.subject).trim() : undefined,
            selected_subjects:
              row.subject && String(row.subject).trim() !== '-'
                ? [String(row.subject).trim()]
                : [],
            category: row.category || undefined,
            productCategory: hasProductCategories(row.product_name)
              ? (String(row.productCategory || '').trim() || getProductCategories(row.product_name)[0] || undefined)
              : undefined,
            price: Number(row.unit_price) || 0,
            unit_price: Number(row.unit_price) || 0,
            total: qty * (Number(row.unit_price) || 0),
            closeLeadDestination: 'MY_CLIENT',
          }
        })

      const syncThisDcProducts = async () => {
        if (!selectedDC?._id) return
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
          
          if (currentEditingDCId) {
            setDcsWithPendingChanges(prev => new Set(prev).add(currentEditingDCId))
            setDcsWithPendingEditRequests(prev => new Set(prev).add(currentEditingDCId))
          }
          
          toast.success('PO edit request submitted! Executive Manager will review and approve.')
        } catch (e: any) {
          console.error('❌ Failed to create pendingEdit request:', e)
          toast.error(e?.message || 'Failed to submit edit request. Please try again.')
          setSubmittingEdit(false)
          return
        }
      } else {
        console.log('📤 Updating DC Order directly (no approval needed):', `/dc-orders/${selectedDcOrder._id}`)
      const response = await apiRequest<any>(`/dc-orders/${selectedDcOrder._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      console.log('✅ DC Order updated successfully:', response)
      if (response?._id) setSelectedDcOrder(response)
        
        if (currentEditingDCId) {
          setDcsWithPendingChanges(prev => {
            const newSet = new Set(prev)
            newSet.delete(currentEditingDCId)
            return newSet
          })
        }

      toast.success('PO updated successfully!')
      }

      await syncThisDcProducts()

      setEditPODialogOpen(false)
      // Reset editing state
      setCurrentEditingDCId(null)
      setOriginalPDFUrl('')
      setOriginalProductNames([])
      setOriginalProductVariantKeys([])
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
                  allowPastDates
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
                  allowPastDates
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
                    const dcOrderStatus =
                      typeof d.dcOrderId === 'object' ? d.dcOrderId?.status : undefined
                    const rawStatus =
                      dcOrderStatus === 'dc_requested' || dcOrderStatus === 'dc_accepted'
                        ? dcOrderStatus
                        : d.status || 'created'
                    const awaitingManagerApproval = dcsWithPendingEditRequests.has(d._id)
                    const status = awaitingManagerApproval ? 'sent_to_manager' : rawStatus
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
                            status === 'dc_requested' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            status === 'pending_dc' ? 'bg-slate-100 text-slate-800 border border-slate-200' :
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
                              View DC
                            </Button>
                          ) : (
                            <span className="text-sm text-neutral-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {rawStatus === 'created' || rawStatus === 'po_submitted' || rawStatus === 'dc_requested' ? (
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
                              {/* Hide Request DC while a new product / new subject PO edit awaits EM approval */}
                              {rawStatus !== 'dc_requested' && !awaitingManagerApproval && (
                            <Button 
                              size="sm" 
                              onClick={() => openClientDCDialog(d)}
                              className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg"
                            >
                              <Package className="w-4 h-4 mr-2" />
                              Request DC
                            </Button>
                              )}
                              {awaitingManagerApproval && (
                                <span className="text-xs text-purple-700 max-w-[140px]">
                                  Awaiting executive manager approval
                                </span>
                              )}
                              {rawStatus === 'dc_requested' && (
                                <span className="text-xs text-amber-700 max-w-[140px]">
                                  Awaiting Closed Sales review
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
      <Dialog
        open={clientDCDialogOpen}
        onOpenChange={(open) => {
          setClientDCDialogOpen(open)
          if (!open) setRequestDcTermRouting(null)
        }}
      >
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
                      dcOrderData?.transport_name ||
                      (dcOrderData?.pendingEdit?.transport_name as string) ||
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
                      dcOrderData?.transport_location ||
                      (dcOrderData?.pendingEdit?.transport_location as string) ||
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
                      dcOrderData?.transportation_landmark ||
                      (dcOrderData?.pendingEdit?.transportation_landmark as string) ||
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
                      dcOrderData?.pincode ||
                      (dcOrderData?.pendingEdit?.pincode as string) ||
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
                        value={
                          catalogSpecsForProduct(row.product).length === 0
                            ? ''
                            : persistEditPoSpecs(row.product, row.specs)
                        }
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
                const terms = dcProductRows.map((row) => resolveClientDCRowTerm(row))
                const uniqueTerms = Array.from(new Set(terms))
                const hasDifferentTerms =
                  uniqueTerms.includes('Term 2') &&
                  (uniqueTerms.includes('Term 1') || uniqueTerms.includes('Both'))

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
                              (sum, row) => sum + requestDcRowQuantity(row),
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
                const term1Products = dcProductRows.filter((row) => {
                  const term = resolveClientDCRowTerm(row)
                  return term === 'Term 1' || term === 'Both'
                })
                const term2Products = dcProductRows.filter(
                  (row) => resolveClientDCRowTerm(row) === 'Term 2'
                )

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
                                    (sum, row) => sum + requestDcRowQuantity(row),
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
                                    (sum, row) => sum + requestDcRowQuantity(row),
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

            {requestDcTermSplit.hasMixedTerms && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                <Label className="text-base font-semibold text-amber-950">
                  This DC has Term 1 and Term 2 products
                </Label>
                <p className="text-sm text-amber-900/90">
                  Choose how to request DC (same as Edit PO term split). Term 1 only keeps the
                  previous flow: Term 1 → Closed Sales, Term 2 → Term-Wise DC. If both terms are
                  selected, the full DC goes to Closed Sales together.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant={requestDcTermRouting === 'both_terms' ? 'default' : 'outline'}
                    className={
                      requestDcTermRouting === 'both_terms'
                        ? 'bg-blue-700 hover:bg-blue-800'
                        : 'border-blue-300'
                    }
                    onClick={() => setRequestDcTermRouting('both_terms')}
                  >
                    Both Term 1 &amp; Term 2 → Closed Sales
                  </Button>
                  <Button
                    type="button"
                    variant={requestDcTermRouting === 'term1_only' ? 'default' : 'outline'}
                    className={
                      requestDcTermRouting === 'term1_only'
                        ? 'bg-orange-600 hover:bg-orange-700'
                        : 'border-orange-300'
                    }
                    onClick={() => setRequestDcTermRouting('term1_only')}
                  >
                    Only Term 1 → Closed Sales (Term 2 → Term-Wise DC)
                  </Button>
                </div>
                {requestDcTermRouting === 'both_terms' && (
                  <p className="text-xs text-blue-800">
                    All products above will be requested as one DC in Closed Sales.
                  </p>
                )}
                {requestDcTermRouting === 'term1_only' && (
                  <p className="text-xs text-orange-800">
                    Only Term 1 products go to Closed Sales now; Term 2 will appear under Term-Wise
                    DC for a later request.
                  </p>
                )}
              </div>
            )}

          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClientDCDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={requestClientDC}
              disabled={
                savingClientDC ||
                (requestDcTermSplit.hasMixedTerms && !requestDcTermRouting)
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
                    const isOriginalLine = isOriginalEditPoLine(
                      row,
                      originalProductVariantKeys,
                      getProductId
                    )
                    return (
                        <TableRow
                          key={row.id}
                          className={
                            highlightedEditProductRowId === row.id
                              ? 'bg-amber-50'
                              : undefined
                          }
                        >
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
                          {(() => {
                            const productName = row.product_name || ''
                            if (!hasProductCategories(productName)) {
                              return <span className="text-sm text-neutral-500">-</span>
                            }
                            const catalogCats = getProductCategories(productName)
                            const current = String(row.productCategory || '').trim()
                            const options =
                              current && !catalogCats.includes(current)
                                ? [current, ...catalogCats]
                                : catalogCats
                            const value = current && options.includes(current)
                              ? current
                              : (catalogCats[0] || undefined)
                            return (
                              <Select
                                value={value}
                                onValueChange={(next) => {
                                  const thisSubject = normalizeEditPoSubjectKey(row.subject)
                                  const thisSpecs = normalizeEditPoSubjectKey(row.specs)
                                  const dup = editProductRows.some((other) => {
                                    if (other.id === row.id) return false
                                    if (
                                      editPoProductIdentity(other.product_name || '', getProductId) !==
                                      editPoProductIdentity(row.product_name || '', getProductId)
                                    ) {
                                      return false
                                    }
                                    const otherClass = String(other.class || '1').trim() || '1'
                                    const thisClass = String(row.class || '1').trim() || '1'
                                    if (otherClass !== thisClass) return false
                                    if (normalizeEditPoSubjectKey(other.subject) !== thisSubject) return false
                                    if (normalizeEditPoSubjectKey(other.specs) !== thisSpecs) return false
                                    return (
                                      normalizeEditPoCategoryKey(other.productCategory) ===
                                      normalizeEditPoCategoryKey(next)
                                    )
                                  })
                                  if (dup) {
                                    toast.error(duplicateEditPoToast(productName))
                                    return
                                  }
                                  const updated = [...editProductRows]
                                  updated[actualIdx].productCategory = next
                                  setEditProductRows(updated)
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                      {cat}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={String(row.class || '1')}
                            onValueChange={(value) => {
                              const updated = [...editProductRows]
                              updated[actualIdx].class = value
                              setEditProductRows(updated)
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Class" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableClasses.map((cls) => (
                                <SelectItem key={cls} value={cls}>
                                  {cls}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const catalogSubjects = getProductSubjects(row.product_name || '')
                            const hasSubjects = catalogSubjects.length > 0 || hasProductSubjects(row.product_name || '')
                            const current = String(row.subject || '').trim()
                            const options = hasSubjects
                              ? (current && !catalogSubjects.includes(current)
                                  ? [current, ...catalogSubjects]
                                  : catalogSubjects)
                              : ['-']
                            const value = hasSubjects
                              ? (current && options.includes(current) ? current : (current || undefined))
                              : '-'
                            if (!hasSubjects) {
                              return <span className="text-sm text-neutral-500">-</span>
                            }
                            return (
                              <Select
                                value={value || undefined}
                                onValueChange={(next) => {
                                  const thisCat = normalizeEditPoCategoryKey(
                                    row.productCategory || getProductCategories(row.product_name || '')[0]
                                  )
                                  const thisSpecs = normalizeEditPoSubjectKey(row.specs)
                                  const dup = editProductRows.some((other) => {
                                    if (other.id === row.id) return false
                                    if (
                                      editPoProductIdentity(other.product_name || '', getProductId) !==
                                      editPoProductIdentity(row.product_name || '', getProductId)
                                    ) {
                                      return false
                                    }
                                    const otherClass = String(other.class || '1').trim() || '1'
                                    const thisClass = String(row.class || '1').trim() || '1'
                                    if (otherClass !== thisClass) return false
                                    const otherCat = normalizeEditPoCategoryKey(
                                      other.productCategory || getProductCategories(other.product_name || '')[0]
                                    )
                                    if (otherCat !== thisCat) return false
                                    if (normalizeEditPoSubjectKey(other.specs) !== thisSpecs) return false
                                    return normalizeEditPoSubjectKey(other.subject) === normalizeEditPoSubjectKey(next)
                                  })
                                  if (dup) {
                                    toast.error(duplicateEditPoToast(row.product_name || ''))
                                    return
                                  }
                                  const updated = [...editProductRows]
                                  updated[actualIdx].subject = next
                                  updated[actualIdx].selected_subjects = next ? [next] : []
                                  setEditProductRows(updated)
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {options.map((subj) => (
                                    <SelectItem key={subj} value={subj}>
                                      {subj}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )
                          })()}
                        </TableCell>
                        <TableCell>
                          {/* Level from Products master only — no L1/Term 1 default when unconfigured */}
                          {(() => {
                            const configuredLevels = getConfiguredLevels(row.product_name || '')
                            const hasConfiguredLevels = configuredLevels.length > 0
                            const levelValue = resolveProductRowLevel(row.product_name || '', row.level)
                            return (
                          <Select
                            value={levelValue}
                            disabled={!hasConfiguredLevels}
                            onValueChange={(value) => {
                              const updated = [...editProductRows]
                              updated[actualIdx].level = value
                              const t = termFromLevelLabel(value)
                              if (t) updated[actualIdx].term = t
                              setEditProductRows(updated)
                              // Recalculate total after level change (total is still qty × price)
                              const total = updated.reduce(
                                (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
                                0
                              )
                              setEditFormData({ ...editFormData, total_amount: total })
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              {(hasConfiguredLevels ? configuredLevels : ['-']).map((lvl) => (
                                <SelectItem key={lvl} value={lvl}>
                                  {lvl}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                            )
                          })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const catalogSpecs = catalogSpecsForProduct(row.product_name || '')
                              if (catalogSpecs.length === 0) {
                                return <span className="text-sm text-neutral-500">-</span>
                              }
                              const specValue = persistEditPoSpecs(row.product_name || '', row.specs)
                              const options =
                                specValue && !catalogSpecs.includes(specValue)
                                  ? [specValue, ...catalogSpecs]
                                  : catalogSpecs
                              return (
                                <Select
                                  value={specValue || undefined}
                                  onValueChange={(next) => {
                                    const updated = [...editProductRows]
                                    updated[actualIdx].specs = next
                                    setEditProductRows(updated)
                                  }}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select specs" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {options.map((spec) => (
                                      <SelectItem key={spec} value={spec}>
                                        {spec}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )
                            })()}
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
                              const total = updated.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)), 0)
                                setEditFormData({ ...editFormData, total_amount: total })
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
                              value={row.unit_price === '' || row.unit_price === undefined || row.unit_price === null ? '' : row.unit_price}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                              updated[actualIdx].unit_price = e.target.value === '' ? '' : e.target.value
                                setEditProductRows(updated)
                                // Update total amount
                              const total = updated.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)), 0)
                                setEditFormData({ ...editFormData, total_amount: total })
                              }}
                              min="0"
                              step="0.01"
                            required
                            readOnly={isOriginalLine}
                            className={`${row.product_name && (!row.unit_price || Number(row.unit_price) <= 0) ? "border-red-500" : ""} ${isOriginalLine ? "bg-neutral-50 cursor-not-allowed" : ""} [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0`}
                            placeholder=""
                            title={isOriginalLine ? "Unit price cannot be changed for original PO products" : ""}
                            />
                          </TableCell>
                          <TableCell>
                            {((Number(row.quantity) || 0) * (Number(row.unit_price) || 0)).toFixed(2)}
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
                                const total = updated.reduce((sum, p) => sum + ((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)), 0)
                                setEditFormData({ ...editFormData, total_amount: total })
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
                              <TableHead>Product Category</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead>Subject</TableHead>
                              <TableHead>Level</TableHead>
                              <TableHead>Specs</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Price</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editProductRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={10} className="text-center text-neutral-500 py-4">
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
                                <TableHead>Product Category</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Specs</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term1Products.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center text-neutral-500 py-4">
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
                                <TableHead>Product Category</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Subject</TableHead>
                                <TableHead>Level</TableHead>
                                <TableHead>Specs</TableHead>
                                <TableHead>Quantity</TableHead>
                                <TableHead>Unit Price</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Action</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {term2Products.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={10} className="text-center text-neutral-500 py-4">
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
                <div className="flex justify-end gap-8 mt-3 text-sm font-semibold text-slate-800">
                  <span>
                    Total Quantity ={' '}
                    {editProductRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}
                  </span>
                  <span>
                    Total Amount ={' '}
                    {editProductRows
                      .reduce(
                        (sum, row) =>
                          sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
                        0
                      )
                      .toFixed(2)}
                  </span>
                </div>
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
      <Dialog
        open={addProductDialogOpen}
        onOpenChange={(open) => {
          setAddProductDialogOpen(open)
          if (open) initAddProductVariants(originalPOProducts)
        }}
      >
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
                    const productCategories = getProductCategories(product)
                    const hasCategories = productCategories.length > 0
                    const addResult = resolveEditPoAdd(product)
                    const isAlreadyAdded = Boolean(addResult.duplicateRow)
                    
                    return (
                      <div key={`${product}-${index}`} className={`p-2 border rounded hover:bg-neutral-50 ${isAlreadyAdded ? 'bg-green-50 border-green-200' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-sm font-medium">{product}</span>
                          {getProductSubjects(product).length > 0 && (
                            <span className="text-xs text-neutral-500">
                              ({getProductSubjects(product).join(', ')})
                            </span>
                          )}
                          {hasCategories && (
                            <span className="text-xs text-neutral-500">
                              ({productCategories.join(', ')})
                            </span>
                          )}
                          {isAlreadyAdded && (
                            <span className="text-xs text-green-600 font-medium">(Added)</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={isAlreadyAdded ? "secondary" : "outline"}
                          size="sm"
                          onClick={() =>
                            handleAddProductToEditPo(
                              product,
                              () => setAddProductDialogOpen(false),
                              addProductSelectedSpec[product]
                            )
                          }
                          className="text-xs"
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                        </div>
                        {hasCategories && (
                          <div className="mt-2 pt-2 border-t">
                            <Label className="text-xs font-semibold mb-2 block">
                              Select Product Category: *
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {productCategories.map((cat) => {
                                const selected = (addProductSelectedCategory[product] || addResult.productCategory || productCategories[0]) === cat
                                return (
                                  <div key={cat} className="flex items-center space-x-1">
                                    <Checkbox
                                      className="border-neutral-400"
                                      id={`po-cat-${product}-${cat}`}
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        setAddProductSelectedCategory((prev) => ({
                                          ...prev,
                                          [product]: checked ? cat : prev[product] || cat,
                                        }))
                                      }}
                                    />
                                    <Label
                                      htmlFor={`po-cat-${product}-${cat}`}
                                      className="text-xs cursor-pointer"
                                    >
                                      {cat}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {hasSpecs && (
                          <div className="mt-2 pt-2 border-t">
                            <Label className="text-xs font-semibold mb-2 block">
                              Select Specs: *
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {productSpecs.map((spec) => {
                                const selected = (addProductSelectedSpec[product] || productSpecs[0]) === spec
                                return (
                                  <div key={spec} className="flex items-center space-x-1">
                                    <Checkbox
                                      className="border-neutral-400"
                                      id={`po-spec-${product}-${spec}`}
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        setAddProductSelectedSpec((prev) => ({
                                          ...prev,
                                          [product]: checked ? spec : prev[product] || spec,
                                        }))
                                      }}
                                    />
                                    <Label
                                      htmlFor={`po-spec-${product}-${spec}`}
                                      className="text-xs cursor-pointer"
                                    >
                                      {spec}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
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
      <Dialog
        open={addNewProductDialogOpen}
        onOpenChange={(open) => {
          setAddNewProductDialogOpen(open)
          if (open) initAddProductVariants(availableProducts)
        }}
      >
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
                    const productCategories = getProductCategories(product)
                    const hasCategories = productCategories.length > 0
                    const addResult = resolveEditPoAdd(product)
                    const isAlreadyAdded = Boolean(addResult.duplicateRow)
                    const isFromPO = originalPOProducts.includes(product)
                    
                    return (
                      <div key={`new-${product}-${index}`} className={`p-2 border rounded hover:bg-neutral-50 ${isAlreadyAdded ? 'bg-green-50 border-green-200' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <span className="text-sm font-medium">{product}</span>
                          {getProductSubjects(product).length > 0 && (
                            <span className="text-xs text-neutral-500">
                              ({getProductSubjects(product).join(', ')})
                            </span>
                          )}
                          {hasCategories && (
                            <span className="text-xs text-neutral-500">
                              ({productCategories.join(', ')})
                            </span>
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
                          onClick={() =>
                            handleAddProductToEditPo(
                              product,
                              () => setAddNewProductDialogOpen(false),
                              addProductSelectedSpec[product]
                            )
                          }
                          className="text-xs"
                        >
                          <PlusCircle className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                        </div>
                        {hasCategories && (
                          <div className="mt-2 pt-2 border-t">
                            <Label className="text-xs font-semibold mb-2 block">
                              Select Product Category: *
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {productCategories.map((cat) => {
                                const selected = (addProductSelectedCategory[product] || addResult.productCategory || productCategories[0]) === cat
                                return (
                                  <div key={cat} className="flex items-center space-x-1">
                                    <Checkbox
                                      className="border-neutral-400"
                                      id={`new-cat-${product}-${cat}`}
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        setAddProductSelectedCategory((prev) => ({
                                          ...prev,
                                          [product]: checked ? cat : prev[product] || cat,
                                        }))
                                      }}
                                    />
                                    <Label
                                      htmlFor={`new-cat-${product}-${cat}`}
                                      className="text-xs cursor-pointer"
                                    >
                                      {cat}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {hasSpecs && (
                          <div className="mt-2 pt-2 border-t">
                            <Label className="text-xs font-semibold mb-2 block">
                              Select Specs: *
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {productSpecs.map((spec) => {
                                const selected = (addProductSelectedSpec[product] || productSpecs[0]) === spec
                                return (
                                  <div key={spec} className="flex items-center space-x-1">
                                    <Checkbox
                                      className="border-neutral-400"
                                      id={`new-spec-${product}-${spec}`}
                                      checked={selected}
                                      onCheckedChange={(checked) => {
                                        setAddProductSelectedSpec((prev) => ({
                                          ...prev,
                                          [product]: checked ? spec : prev[product] || spec,
                                        }))
                                      }}
                                    />
                                    <Label
                                      htmlFor={`new-spec-${product}-${spec}`}
                                      className="text-xs cursor-pointer"
                                    >
                                      {spec}
                                    </Label>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
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

