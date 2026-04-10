'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CreditCard, Search, FileText, Pencil, Package, X } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

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
    school_code?: string
    contact_person?: string
    contact_mobile?: string
    email?: string
    products?: Array<{
      product_name?: string
      quantity?: number
      term?: string
    }>
    status?: string
    school_type?: string
    createdAt?: string
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  createdAt?: string
  productDetails?: Array<{
    product?: string
    term?: string
    class?: string
    category?: string
    specs?: string
    subject?: string
    quantity?: number
    strength?: number
    level?: string
  }>
}

type InvoiceData = {
  schoolInfo: any
  paymentBreakdown: Array<{
    product: string
    term?: string
    class: string
    category: string
    specs: string
    subject?: string
    quantity: number
    strength: number
    level: string
    unitPrice: number
    total: number
  }>
  totalAmount: number
  dcDate?: string
}

export default function TermWiseDCPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  
  // Edit PO Dialog state
  const [editPODialogOpen, setEditPODialogOpen] = useState(false)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [selectedDcOrder, setSelectedDcOrder] = useState<any>(null)
  const [editProductRows, setEditProductRows] = useState<Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number
    term: string
  }>>([])
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
    pod_proof_url: '',
    remarks: '',
    total_amount: 0,
    transport_name: '',
    transport_location: '',
    transportation_landmark: '',
    pincode: '',
  })
  const [submittingEdit, setSubmittingEdit] = useState(false)
  
  // Request DC Dialog state
  const [requestDCDialogOpen, setRequestDCDialogOpen] = useState(false)
  const [requestDCFormData, setRequestDCFormData] = useState({
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
    pod_proof_url: '',
    remarks: '',
    total_amount: 0,
    transport_name: '',
    transport_location: '',
    transportation_landmark: '',
    pincode: '',
  })
  const [requestDCProductRows, setRequestDCProductRows] = useState<Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number
    term: string
  }>>([])
  const [savingDC, setSavingDC] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // Fetch ALL DCs with status 'scheduled_for_later' (Term 2 DCs)
      // These should be visible to all users, not just the employee who created them
      console.log('🔍 Fetching Term-Wise DCs...')
      const data = await apiRequest<DC[]>(`/dc?status=scheduled_for_later`)
      const dataArray = Array.isArray(data) ? data : []
      console.log(`✅ Loaded ${dataArray.length} DCs with status 'scheduled_for_later'`)
      
      // Filter to only show Term 2 DCs (all products are Term 2)
      const term2DCs = dataArray.filter(dc => {
        // Check productDetails first
        if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
          const allTerm2 = dc.productDetails.every((p: any) => (p.term || 'Term 1') === 'Term 2')
          const hasTerm1 = dc.productDetails.some((p: any) => {
            const term = p.term || 'Term 1'
            return term === 'Term 1' || term === 'Both'
          })
          // If all products are Term 2 and no Term 1, it's a Term 2 DC
          if (allTerm2 && !hasTerm1) {
            return true
          }
        }
        
        // Check dcOrderId.products as fallback
        if (dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId.products) {
          const products = dc.dcOrderId.products
          if (Array.isArray(products) && products.length > 0) {
            const allTerm2 = products.every((p: any) => (p.term || 'Term 1') === 'Term 2')
            const hasTerm1 = products.some((p: any) => {
              const term = p.term || 'Term 1'
              return term === 'Term 1' || term === 'Both'
            })
            if (allTerm2 && !hasTerm1) {
              return true
            }
          }
        }
        
        // If status is scheduled_for_later, include it (fallback for DCs created before term field was set)
        return dc.status === 'scheduled_for_later'
      })
      
      console.log(`📊 Filtered to ${term2DCs.length} Term 2 DCs out of ${dataArray.length} total`)
      
      // Debug: Log DCs and their productDetails
      if (term2DCs.length > 0) {
        console.log('📦 Term 2 DCs found:', term2DCs.map(dc => ({
          id: dc._id,
          customerName: dc.customerName,
          status: dc.status,
          hasProductDetails: !!dc.productDetails,
          productDetailsCount: dc.productDetails?.length || 0,
          productDetails: dc.productDetails,
          dcOrderProducts: dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId.products : null
        })))
      } else {
        console.warn('⚠️ No Term 2 DCs found with status "scheduled_for_later"')
      }
      
      setItems(term2DCs)
    } catch (e: any) {
      console.error('❌ Failed to load DCs:', e)
      console.error('Error details:', {
        message: e?.message,
        status: e?.status,
        details: e?.details
      })
      toast.error(`Error loading DCs: ${e?.message || 'Unknown error'}`)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openInvoiceView = async (dc: DC) => {
    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`)
      
      let schoolInfo: any = {}
      let paymentBreakdown: any[] = []
      let totalAmount = 0
      let dcOrder: any = null
      
      if (dc.dcOrderId) {
        const dcOrderId = typeof dc.dcOrderId === 'object'
          ? dc.dcOrderId._id
          : dc.dcOrderId
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
        schoolInfo = {
          customerName: dc.customerName || '',
          mobileNumber: dc.customerPhone || '',
        }
      }
      
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        if (dcOrder && dcOrder.products && Array.isArray(dcOrder.products) && dcOrder.products.length > 0) {
          const usedIndices = new Set<number>()
          
          paymentBreakdown = fullDC.productDetails.map((pd: any, index: number) => {
            let matchingProduct: any = null
            let matchingIndex = -1
            
            if (index < dcOrder.products.length && !usedIndices.has(index)) {
              matchingProduct = dcOrder.products[index]
              matchingIndex = index
              usedIndices.add(index)
            } else {
              const dcProductName = (pd.product || '').toLowerCase().trim()
              
              for (let i = 0; i < dcOrder.products.length; i++) {
                if (usedIndices.has(i)) continue
                const p = dcOrder.products[i]
                const orderProductName = (p.product_name || '').toLowerCase().trim()
                
                if (dcProductName === orderProductName) {
                  matchingProduct = p
                  matchingIndex = i
                  usedIndices.add(i)
                  break
                }
              }
              
              if (!matchingProduct) {
                for (let i = 0; i < dcOrder.products.length; i++) {
                  if (usedIndices.has(i)) continue
                  const p = dcOrder.products[i]
                  const orderProductName = (p.product_name || '').toLowerCase().trim()
                  
                  if (dcProductName.includes(orderProductName) || orderProductName.includes(dcProductName)) {
                    matchingProduct = p
                    matchingIndex = i
                    usedIndices.add(i)
                    break
                  }
                }
              }
              
              if (!matchingProduct) {
                const dcProductName = (pd.product || '').toLowerCase().trim()
                matchingProduct = dcOrder.products.find((p: any) => {
                  const orderProductName = (p.product_name || '').toLowerCase().trim()
                  return dcProductName === orderProductName || 
                         dcProductName.includes(orderProductName) || 
                         orderProductName.includes(dcProductName)
                })
              }
            }
            
            const unitPrice = matchingProduct 
              ? (Number(matchingProduct.unit_price) || 0)
              : (Number(pd.price) || 0)
            
            const quantity = Number(pd.quantity) || 0
            const strength = Number(pd.strength) || 0
            const total = unitPrice * strength
            totalAmount += total
            
            const term = matchingProduct?.term || pd.term || 'Term 1'
            
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
          paymentBreakdown = fullDC.productDetails.map((p: any) => {
            const price = Number(p.price) || 0
            const quantity = Number(p.quantity) || 0
            const strength = Number(p.strength) || 0
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
              term: p.term || 'Term 1',
            }
          })
        }
      }
      
      if (paymentBreakdown.length === 0 && dcOrder && dcOrder.total_amount && Number(dcOrder.total_amount) > 0) {
        totalAmount = Number(dcOrder.total_amount)
        if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
          const totalStrength = fullDC.productDetails.reduce((sum: number, p: any) => 
            sum + (Number(p.strength) || 0), 0
          )
          const estimatedUnitPrice = totalStrength > 0 ? totalAmount / totalStrength : 0
          
          paymentBreakdown = fullDC.productDetails.map((pd: any) => {
            const quantity = Number(pd.quantity) || 0
            const strength = Number(pd.strength) || 0
            const total = estimatedUnitPrice * strength
            return {
              product: pd.product || '',
              class: pd.class || '1',
              category: pd.category || 'New School',
              specs: pd.specs || 'Regular',
              subject: pd.subject || undefined,
              quantity: quantity,
              strength: Number(pd.strength) || 0,
              level: pd.level || 'L2',
              unitPrice: estimatedUnitPrice,
              total: total,
              term: pd.term || 'Term 1',
            }
          })
        }
      }
      
      setInvoiceData({
        schoolInfo,
        paymentBreakdown,
        totalAmount,
        dcDate: fullDC.dcDate || undefined,
      })
      setInvoiceModalOpen(true)
    } catch (e: any) {
      console.error('Failed to load invoice:', e)
      toast.error('Failed to load invoice data: ' + (e?.message || 'Unknown error'))
    }
  }

  const openEditPODialog = async (dc: DC) => {
    const dcOrderId = typeof dc.dcOrderId === 'object' ? dc.dcOrderId._id : dc.dcOrderId
    
    if (!dcOrderId) {
      toast.error('Cannot edit: DC Order not found')
      return
    }

    try {
      const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
      setSelectedDC(dc)
      setSelectedDcOrder(dcOrder)
      
      // Populate form with current data
      const formData = {
        school_name: dcOrder.school_name || '',
        contact_person: dcOrder.contact_person || '',
        contact_mobile: dcOrder.contact_mobile || '',
        contact_person2: dcOrder.contact_person2 || '',
        contact_mobile2: dcOrder.contact_mobile2 || '',
        email: dcOrder.email || '',
        address: dcOrder.address || '',
        school_type: dcOrder.school_type || '',
        zone: dcOrder.zone || '',
        location: dcOrder.location || '',
        pod_proof_url: dcOrder.pod_proof_url || dc.poPhotoUrl || '',
        remarks: dcOrder.remarks || '',
        total_amount: dcOrder.total_amount || 0,
        // Transport fields - check pendingEdit first, then main fields
        transport_name: dcOrder.pendingEdit?.transport_name || dcOrder.transport_name || '',
        transport_location: dcOrder.pendingEdit?.transport_location || dcOrder.transport_location || '',
        transportation_landmark: dcOrder.pendingEdit?.transportation_landmark || dcOrder.transportation_landmark || '',
        pincode: dcOrder.pendingEdit?.pincode || dcOrder.pincode || '',
      }
      
      setEditFormData(formData)
      
      // Load products - prioritize DC's productDetails (has all details), then DcOrder products
      let productsToShow: any[] = []
      
      // First try to get from DC's productDetails (most accurate - has all product details)
      if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
        // Get unit prices from DcOrder products if available
        productsToShow = dc.productDetails.map((p: any) => {
          // Try to match with DcOrder product to get unit_price
          const matchingDcOrderProduct = (dcOrder.products || []).find((op: any) => {
            const orderProductName = (op.product_name || '').toLowerCase().trim()
            const dcProductName = (p.product || p.product_name || '').toLowerCase().trim()
            return orderProductName === dcProductName
          })
          
          return {
            product_name: p.product || p.product_name || '',
            quantity: p.quantity || p.strength || 0,
            unit_price: matchingDcOrderProduct?.unit_price || p.unit_price || p.price || 0,
            term: p.term || 'Term 1',
          }
        })
      } else if (dcOrder.products && Array.isArray(dcOrder.products) && dcOrder.products.length > 0) {
        // Fallback to DcOrder products (initial values)
        productsToShow = dcOrder.products.map((p: any) => ({
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          term: p.term || 'Term 1',
        }))
      }
      
      setEditProductRows(
        productsToShow.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          term: p.term || 'Term 1',
        }))
      )
      
      setEditPODialogOpen(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load DC Order details')
    }
  }

  const savePOChanges = async () => {
    if (!selectedDcOrder) return

    setSubmittingEdit(true)
    try {
      const products = editProductRows.map(row => ({
        product_name: row.product_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        term: row.term || 'Term 1',
      }))

      const totalAmount = products.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0)

      const payload = {
        ...editFormData,
        products,
        total_amount: totalAmount,
        // Explicitly include transport fields
        transport_name: editFormData.transport_name || '',
        transport_location: editFormData.transport_location || '',
        transportation_landmark: editFormData.transportation_landmark || '',
        pincode: editFormData.pincode || '',
      }

      await apiRequest(`/dc-orders/${selectedDcOrder._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      toast.success('PO updated successfully!')
      setEditPODialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update PO')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const addProductRow = () => {
    setEditProductRows([
      ...editProductRows,
      {
        id: String(Date.now()),
        product_name: '',
        quantity: 0,
        unit_price: 0,
        term: 'Term 1',
      },
    ])
  }

  const removeProductRow = (id: string) => {
    setEditProductRows(editProductRows.filter(row => row.id !== id))
  }

  const openRequestDCDialog = async (dc: DC) => {
    setSelectedDC(dc)

    const dcOrderId = typeof dc.dcOrderId === 'object' ? dc.dcOrderId._id : dc.dcOrderId
    if (!dcOrderId) {
      toast.error('Cannot request DC: DC Order not found')
      return
    }

    try {
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`).catch(() => dc)
      const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)

      const formData = {
        school_name: dcOrder.school_name || '',
        contact_person: dcOrder.contact_person || '',
        contact_mobile: dcOrder.contact_mobile || '',
        contact_person2: dcOrder.contact_person2 || '',
        contact_mobile2: dcOrder.contact_mobile2 || '',
        email: dcOrder.email || '',
        address: dcOrder.address || '',
        school_type: dcOrder.school_type || '',
        zone: dcOrder.zone || '',
        location: dcOrder.location || '',
        pod_proof_url: dcOrder.pod_proof_url || dc.poPhotoUrl || '',
        remarks: dcOrder.remarks || '',
        total_amount: dcOrder.total_amount || 0,
        transport_name: dcOrder.pendingEdit?.transport_name || dcOrder.transport_name || '',
        transport_location: dcOrder.pendingEdit?.transport_location || dcOrder.transport_location || '',
        transportation_landmark: dcOrder.pendingEdit?.transportation_landmark || dcOrder.transportation_landmark || '',
        pincode: dcOrder.pendingEdit?.pincode || dcOrder.pincode || '',
      }

      setRequestDCFormData(formData)

      let term2Products: any[] = []

      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        const dcTerm2Products = fullDC.productDetails.filter((p: any) => (p.term || 'Term 1') === 'Term 2')
        if (dcTerm2Products.length > 0) {
          term2Products = dcTerm2Products.map((p: any) => {
            const matchingDcOrderProduct = (dcOrder.products || []).find((op: any) => {
              const orderProductName = (op.product_name || '').toLowerCase().trim()
              const dcProductName = (p.product || p.product_name || '').toLowerCase().trim()
              return orderProductName === dcProductName && (op.term || 'Term 1') === 'Term 2'
            })

            return {
              product_name: p.product || p.product_name || '',
              quantity: p.quantity || p.strength || 0,
              unit_price: matchingDcOrderProduct?.unit_price || p.unit_price || p.price || 0,
              term: p.term || 'Term 2',
            }
          })
        }
      }

      if (term2Products.length === 0) {
        const dcOrderTerm2Products = (dcOrder.products || []).filter((p: any) => (p.term || 'Term 1') === 'Term 2')
        term2Products = dcOrderTerm2Products.map((p: any) => ({
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          term: p.term || 'Term 2',
        }))
      }

      setRequestDCProductRows(
        term2Products.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          term: p.term || 'Term 2',
        }))
      )

      setRequestDCDialogOpen(true)
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load DC Order details')
    }
  }

  const requestClientDC = async () => {
    if (!selectedDC) return

    const totalQuantity = requestDCProductRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
    if (totalQuantity <= 0) {
      toast.error('Please ensure at least one product with quantity > 0')
      return
    }

    setSavingDC(true)
    try {
      const dcOrderId =
        typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId._id : selectedDC.dcOrderId

      if (!dcOrderId) {
        toast.error('Cannot request DC: DC Order not found')
        return
      }

      const productDetails = requestDCProductRows
        .filter((row) => (row.term || 'Term 1') === 'Term 2')
        .map((row) => ({
          product: row.product_name,
          class: '1',
          category: requestDCFormData.school_type === 'Existing' ? 'Existing School' : 'New School',
          specs: 'Regular',
          subject: undefined,
          quantity: row.quantity,
          strength: row.quantity,
          level: 'L2',
          term: 'Term 2',
          unit_price: row.unit_price || 0,
        }))

      const dcPayload = {
        dcOrderId,
        customerName: requestDCFormData.school_name || selectedDC.customerName || '',
        customerPhone: requestDCFormData.contact_mobile || selectedDC.customerPhone || '',
        productDetails,
        dcDate: new Date().toISOString().split('T')[0],
        dcRemarks: requestDCFormData.remarks,
        dcCategory: requestDCFormData.school_type === 'Existing' ? 'Existing School' : 'New School',
        status: 'scheduled_for_later',
      }

      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify(dcPayload),
      })

      try {
        const updateResponse = await apiRequest<any>(`/dc-orders/${dcOrderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'dc_requested',
            dcRequestData: {
              productDetails,
              requestedQuantity: totalQuantity,
              requestedAt: new Date().toISOString(),
            },
          }),
        })
        if (updateResponse?.status !== 'dc_requested') {
          toast.warning('DC updated, but DcOrder status may not have been updated. Please check Closed Sales page.')
        }
      } catch (dcOrderError: any) {
        toast.error(
          `Failed to update DcOrder status: ${dcOrderError?.message || 'Unknown error'}. Please refresh Closed Sales page manually.`
        )
      }

      toast.success('DC requested successfully! It will appear in Closed Sales page.')
      setRequestDCDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to request DC')
    } finally {
      setSavingDC(false)
    }
  }

  // Group DCs by term - only show Term 2
  const groupedByTerm = useMemo(() => {
    const term2DCs: DC[] = []
    
    console.log(`🔍 Filtering ${items.length} DCs for Term 2 products...`)
    
    items.forEach((dc, index) => {
      let hasTerm2 = false
      let termSource = 'none'
      
      // Check productDetails first (most reliable)
      if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
        const terms = dc.productDetails.map((p: any) => {
          // Check multiple possible field names for term
          return (p.term || p.term_name || 'Term 1').toString().trim()
        })
        const uniqueTerms = Array.from(new Set(terms))
        
        // Check for Term 2 (case-insensitive, handle variations)
        hasTerm2 = uniqueTerms.some(term => 
          term.toLowerCase().includes('term 2') || 
          term.toLowerCase().includes('term2') ||
          term === '2' ||
          term.toLowerCase() === 'term 2'
        )
        termSource = 'productDetails'
        
        if (hasTerm2) {
          console.log(`✅ DC ${index + 1} has Term 2 in productDetails:`, {
            dcId: dc._id,
            customerName: dc.customerName,
            terms: uniqueTerms,
            productDetails: dc.productDetails
          })
        }
      } else if (dc.dcOrderId && typeof dc.dcOrderId === 'object' && dc.dcOrderId.products) {
        // Check DcOrder products (fallback)
        const terms = dc.dcOrderId.products.map((p: any) => {
          return (p.term || p.term_name || 'Term 1').toString().trim()
        })
        const uniqueTerms = Array.from(new Set(terms))
        
        // Check for Term 2 (case-insensitive, handle variations)
        hasTerm2 = uniqueTerms.some(term => 
          term.toLowerCase().includes('term 2') || 
          term.toLowerCase().includes('term2') ||
          term === '2' ||
          term.toLowerCase() === 'term 2'
        )
        termSource = 'dcOrderProducts'
        
        if (hasTerm2) {
          console.log(`✅ DC ${index + 1} has Term 2 in dcOrder products:`, {
            dcId: dc._id,
            customerName: dc.customerName,
            terms: uniqueTerms
          })
        }
      }
      
      // If status is 'scheduled_for_later', it's likely a Term 2 DC even if term field is missing
      // This handles cases where DCs were created before term field was properly set
      if (!hasTerm2 && dc.status === 'scheduled_for_later') {
        console.log(`⚠️ DC ${index + 1} has status 'scheduled_for_later' but no Term 2 in products. Including anyway.`, {
          dcId: dc._id,
          customerName: dc.customerName,
          productDetails: dc.productDetails,
          dcOrderProducts: dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId.products : null
        })
        hasTerm2 = true
        termSource = 'status_fallback'
      }
      
      if (hasTerm2) {
        term2DCs.push(dc)
      } else {
        console.log(`❌ DC ${index + 1} does NOT have Term 2:`, {
          dcId: dc._id,
          customerName: dc.customerName,
          status: dc.status,
          termSource,
          productDetails: dc.productDetails,
          dcOrderProducts: dc.dcOrderId && typeof dc.dcOrderId === 'object' ? dc.dcOrderId.products : null
        })
      }
    })
    
    console.log(`📊 Filtered results: ${term2DCs.length} Term 2 DCs out of ${items.length} total`)
    
    return { term1: [], term2: term2DCs }
  }, [items])

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return items
    
    return items.filter((d) => {
      const customerName = (d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || '').toLowerCase()
      const phone = (d.customerPhone || d.dcOrderId?.contact_mobile || '').toLowerCase()
      const product = (d.product || d.saleId?.product || (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '')).toLowerCase()
      const status = (d.status || 'created').toLowerCase()
      
      return customerName.includes(query) || 
             phone.includes(query) || 
             product.includes(query) || 
             status.includes(query)
    })
  }, [items, searchQuery])

  const filteredTerm2 = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return groupedByTerm.term2
    
    return groupedByTerm.term2.filter((d) => {
      const customerName = (d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || '').toLowerCase()
      const phone = (d.customerPhone || d.dcOrderId?.contact_mobile || '').toLowerCase()
      const product = (d.product || d.saleId?.product || (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '')).toLowerCase()
      return customerName.includes(query) || phone.includes(query) || product.includes(query)
    })
  }, [groupedByTerm.term2, searchQuery])

  const renderDCTable = (dcs: DC[], term: string) => {
    if (dcs.length === 0) return null

    return (
      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">{term}</h2>
          <p className="text-sm text-gray-500 mt-1">Total: {dcs.length} client(s)</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">S.No</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Client Turned Date</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dcs.map((d, idx) => {
                const customerName = d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || 'Unknown Client'
                const phone = d.customerPhone || d.dcOrderId?.contact_mobile || '-'
                
                // Get products - prioritize productDetails (Term 2 only), then dcOrderId products (Term 2 only), then fallback
                let product = '-'
                if (d.productDetails && Array.isArray(d.productDetails) && d.productDetails.length > 0) {
                  // Filter to only Term 2 products
                  const term2Products = d.productDetails.filter((p: any) => (p.term || 'Term 1') === 'Term 2')
                  if (term2Products.length > 0) {
                    product = term2Products.map((p: any) => p.product || p.productName || '').filter(Boolean).join(', ')
                  }
                }
                
                if (product === '-' && d.dcOrderId && typeof d.dcOrderId === 'object' && d.dcOrderId.products && Array.isArray(d.dcOrderId.products)) {
                  // Filter to only Term 2 products
                  const term2Products = d.dcOrderId.products.filter((p: any) => (p.term || 'Term 1') === 'Term 2')
                  if (term2Products.length > 0) {
                    product = term2Products.map((p: any) => p.product_name || p.product || '').filter(Boolean).join(', ')
                  }
                }
                
                // Fallback to other product fields if no Term 2 products found
                if (product === '-') {
                  product = d.product || d.saleId?.product || '-'
                }
                
                const status = d.status || 'created'
                const createdDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'
                const turnedDate = (typeof d.dcOrderId === 'object' && d.dcOrderId?.createdAt)
                  ? new Date(d.dcOrderId.createdAt).toLocaleDateString()
                  : (d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-')
                const schoolCode = (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_code) 
                  ? d.dcOrderId.school_code 
                  : '-'
                
                return (
                  <TableRow key={d._id} className="hover:bg-neutral-50">
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium text-blue-700">{schoolCode}</TableCell>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell>{phone}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={product}>{product}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                        status === 'created' ? 'bg-blue-100 text-blue-700' :
                        status === 'po_submitted' ? 'bg-yellow-100 text-yellow-700' :
                        status === 'sent_to_manager' ? 'bg-purple-100 text-purple-700' :
                        status === 'warehouse_processing' ? 'bg-orange-100 text-orange-700' :
                        status === 'completed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {status}
                      </span>
                    </TableCell>
                    <TableCell>{createdDate}</TableCell>
                    <TableCell>{turnedDate}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        {(d.poPhotoUrl || d.dcOrderId) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => openEditPODialog(d)}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit PO
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          onClick={() => openRequestDCDialog(d)}
                        >
                          <Package className="w-4 h-4 mr-2" />
                          Request DC
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Term-Wise DC</h1>
          <p className="text-sm text-neutral-500 mt-1">
            View your clients with Term 2 products
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                placeholder="Search by client name, phone, product, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-neutral-500">Loading clients...</p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-neutral-500">No clients found.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {renderDCTable(filteredTerm2, 'Term 2')}
        </div>
      )}

      {/* Invoice View Modal */}
      <Dialog open={invoiceModalOpen} onOpenChange={setInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice - {invoiceData?.schoolInfo?.customerName || 'Client'}</DialogTitle>
            <DialogDescription>
              Product details and costs for this DC request
            </DialogDescription>
          </DialogHeader>
          
          {invoiceData && (
            <div className="space-y-6 py-4">
              {/* School Information */}
              <div className="border rounded-lg p-4 bg-neutral-50">
                <h3 className="font-semibold text-lg mb-3">School Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-neutral-600">School Name:</span>
                    <span className="ml-2 font-medium">{invoiceData.schoolInfo.customerName || '-'}</span>
                  </div>
                  {invoiceData.schoolInfo.schoolCode && (
                    <div>
                      <span className="text-neutral-600">School Code:</span>
                      <span className="ml-2 font-medium">{invoiceData.schoolInfo.schoolCode}</span>
                    </div>
                  )}
                  {invoiceData.schoolInfo.contactName && (
                    <div>
                      <span className="text-neutral-600">Contact Person:</span>
                      <span className="ml-2 font-medium">{invoiceData.schoolInfo.contactName}</span>
                    </div>
                  )}
                  {invoiceData.schoolInfo.mobileNumber && (
                    <div>
                      <span className="text-neutral-600">Mobile:</span>
                      <span className="ml-2 font-medium">{invoiceData.schoolInfo.mobileNumber}</span>
                    </div>
                  )}
                  {invoiceData.schoolInfo.location && (
                    <div>
                      <span className="text-neutral-600">Location:</span>
                      <span className="ml-2 font-medium">{invoiceData.schoolInfo.location}</span>
                    </div>
                  )}
                  {invoiceData.schoolInfo.zone && (
                    <div>
                      <span className="text-neutral-600">Zone:</span>
                      <span className="ml-2 font-medium">{invoiceData.schoolInfo.zone}</span>
                    </div>
                  )}
                  {invoiceData.dcDate && (
                    <div>
                      <span className="text-neutral-600">DC Date:</span>
                      <span className="ml-2 font-medium">{new Date(invoiceData.dcDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Products Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-neutral-100 px-4 py-3 border-b">
                  <h3 className="font-semibold text-lg">Products & Pricing</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 border-b">
                        <th className="py-3 px-4 text-left font-semibold">Product</th>
                        <th className="py-3 px-4 text-left font-semibold">Term</th>
                        <th className="py-3 px-4 text-left font-semibold">Class</th>
                        <th className="py-3 px-4 text-left font-semibold">Category</th>
                        <th className="py-3 px-4 text-left font-semibold">Specs</th>
                        <th className="py-3 px-4 text-left font-semibold">Subject</th>
                        <th className="py-3 px-4 text-right font-semibold">Quantity</th>
                        <th className="py-3 px-4 text-right font-semibold">Strength</th>
                        <th className="py-3 px-4 text-right font-semibold">Level</th>
                        <th className="py-3 px-4 text-right font-semibold">Unit Price</th>
                        <th className="py-3 px-4 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceData.paymentBreakdown.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-neutral-50">
                          <td className="py-3 px-4 font-medium">{item.product}</td>
                          <td className="py-3 px-4">{item.term || 'Term 1'}</td>
                          <td className="py-3 px-4">{item.class}</td>
                          <td className="py-3 px-4">{item.category}</td>
                          <td className="py-3 px-4">{item.specs}</td>
                          <td className="py-3 px-4">{item.subject || '-'}</td>
                          <td className="py-3 px-4 text-right">{item.quantity}</td>
                          <td className="py-3 px-4 text-right">{item.strength}</td>
                          <td className="py-3 px-4 text-right">{item.level}</td>
                          <td className="py-3 px-4 text-right">₹{item.unitPrice.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-neutral-100 border-t-2 border-neutral-400 font-bold">
                        <td colSpan={10} className="py-4 px-4 text-right">
                          Grand Total:
                        </td>
                        <td className="py-4 px-4 text-right text-lg">
                          ₹{invoiceData.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Status */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-600">Payment Status</p>
                    <p className="text-lg font-semibold text-blue-700">Pending</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      Payment will be updated when received (Cash, UPI, etc.)
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-neutral-600">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-700">₹{invoiceData.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceModalOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setInvoiceModalOpen(false)
              router.push('/dashboard/payments')
            }}>
              View in Payments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit PO Dialog */}
      <Dialog open={editPODialogOpen} onOpenChange={setEditPODialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit PO - {editFormData.school_name || 'Client'}</DialogTitle>
            <DialogDescription>
              Make changes to the PO. Changes will be saved instantly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* School/Client Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label>School Name</Label>
                  <Input value={editFormData.school_name} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={editFormData.contact_person} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Person 2</Label>
                  <Input value={editFormData.contact_person2} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={editFormData.address}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>School Type</Label>
                  <Input value={editFormData.school_type} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input value={editFormData.contact_mobile} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Mobile 2</Label>
                  <Input value={editFormData.contact_mobile2} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input value={editFormData.zone} readOnly className="bg-neutral-50" />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={editFormData.remarks}
                onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                rows={3}
              />
            </div>

            {/* PO Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>PO Photo URL</Label>
                <Input
                  value={editFormData.pod_proof_url}
                  onChange={(e) => setEditFormData({ ...editFormData, pod_proof_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  value={editFormData.total_amount}
                  readOnly
                  className="bg-neutral-50"
                />
              </div>
            </div>

            {/* Transport Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Transport Details</h3>
              <div className="grid grid-cols-2 gap-4">
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

            {/* Products */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Products</h3>
                <Button onClick={addProductRow} size="sm">
                  + Add Product
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editProductRows.map((row, idx) => {
                      const total = (row.quantity || 0) * (row.unit_price || 0)
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              value={row.product_name}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                                updated[idx].product_name = e.target.value
                                setEditProductRows(updated)
                              }}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.term || 'Term 1'}
                              readOnly
                              disabled
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => {
                                const updated = [...editProductRows]
                                updated[idx].quantity = Number(e.target.value) || 0
                                setEditProductRows(updated)
                                // Update total amount
                                const newTotal = updated.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0)
                                setEditFormData({ ...editFormData, total_amount: newTotal })
                              }}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.unit_price}
                              readOnly
                              disabled
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={total.toFixed(2)}
                              readOnly
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                removeProductRow(row.id)
                                // Update total amount after removal
                                const updated = editProductRows.filter(r => r.id !== row.id)
                                const newTotal = updated.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0)
                                setEditFormData({ ...editFormData, total_amount: newTotal })
                              }}
                            >
                              <span className="text-red-600">X</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPODialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePOChanges} disabled={submittingEdit}>
              {submittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request DC Dialog */}
      <Dialog open={requestDCDialogOpen} onOpenChange={setRequestDCDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request DC - {requestDCFormData.school_name || 'Client'}</DialogTitle>
            <DialogDescription>
              Review PO details and request Delivery Challan. All fields are read-only.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* School/Client Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label>School Name</Label>
                  <Input value={requestDCFormData.school_name} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input value={requestDCFormData.contact_person} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Person 2</Label>
                  <Input value={requestDCFormData.contact_person2} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={requestDCFormData.email} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input value={requestDCFormData.location} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea
                    value={requestDCFormData.address}
                    readOnly
                    className="bg-neutral-50"
                    rows={3}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label>School Type</Label>
                  <Input value={requestDCFormData.school_type} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input value={requestDCFormData.contact_mobile} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Contact Mobile 2</Label>
                  <Input value={requestDCFormData.contact_mobile2} readOnly className="bg-neutral-50" />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input value={requestDCFormData.zone} readOnly className="bg-neutral-50" />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={requestDCFormData.remarks}
                readOnly
                className="bg-neutral-50"
                rows={3}
              />
            </div>

            {/* PO Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>PO Photo URL</Label>
                <Input
                  value={requestDCFormData.pod_proof_url}
                  readOnly
                  className="bg-neutral-50"
                />
              </div>
              <div>
                <Label>Total Amount</Label>
                <Input
                  type="number"
                  value={requestDCFormData.total_amount}
                  readOnly
                  className="bg-neutral-50"
                />
              </div>
            </div>

            {/* Transport Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Transport Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Transport Name *</Label>
                  <Input
                    value={requestDCFormData.transport_name}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Transport name"
                  />
                </div>
                <div>
                  <Label>Transport Location *</Label>
                  <Input
                    value={requestDCFormData.transport_location}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Transport location"
                  />
                </div>
                <div>
                  <Label>Transportation Landmark</Label>
                  <Input
                    value={requestDCFormData.transportation_landmark}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Transportation landmark"
                  />
                </div>
                <div>
                  <Label>Pincode *</Label>
                  <Input
                    value={requestDCFormData.pincode}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Pincode"
                  />
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Products</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Strength</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestDCProductRows.map((row, idx) => {
                      const total = (row.quantity || 0) * (row.unit_price || 0)
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Input
                              value={row.product_name}
                              readOnly
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.term || 'Term 1'}
                              readOnly
                              disabled
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={row.quantity}
                              onChange={(e) => {
                                const value = Number(e.target.value) || 0
                                setRequestDCProductRows((rows) => {
                                  const updated = [...rows]
                                  updated[idx] = {
                                    ...updated[idx],
                                    quantity: value < 0 ? 0 : value,
                                  }
                                  return updated
                                })
                              }}
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={row.unit_price}
                              readOnly
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={total.toFixed(2)}
                              readOnly
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDCDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={requestClientDC} disabled={savingDC}>
              {savingDC ? 'Requesting...' : 'Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

