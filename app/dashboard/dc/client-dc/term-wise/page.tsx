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
import { useProducts } from '@/hooks/useProducts'
import { applyPaymentDivisorsToBreakdown } from '@/lib/dcPaymentDivisors'
import { displayProductLevel } from '@/lib/clientDcProductRows'
import { persistProductTerm } from '@/lib/productTerm'

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
    productName?: string
    term?: string
    class?: string
    category?: string
    productCategory?: string
    specs?: string
    subject?: string
    quantity?: number
    strength?: number
    level?: string
    price?: number
    unit_price?: number
    closeLeadDestination?: string
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
  invoicePending?: boolean
  invoicePendingMessage?: string
}

export default function TermWiseDCPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { getCalculationType, getCatalogFallbackCount } = useProducts()
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
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
    level?: string
    class?: string
    specs?: string
    subject?: string
    category?: string
    productCategory?: string
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
    level?: string
    class?: string
    specs?: string
    subject?: string
    category?: string
    productCategory?: string
  }>>([])
  const [savingDC, setSavingDC] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // Backend persists per-product routing on GET (repairSaleCloseLeadRouting).
      // Term-Wise DCs only contain paired Level 2 / Term 2 rows after repair.
      console.log('🔍 Fetching Term-Wise DCs...')
      const data = await apiRequest<DC[]>(`/dc?status=scheduled_for_later`)
      const dataArray = Array.isArray(data) ? data : []
      const normalized = dataArray.map((dc) => {
        const rows = Array.isArray(dc.productDetails) ? dc.productDetails : []
        const productLabel = rows
          .map((p: any) => p.product || p.productName || '')
          .filter(Boolean)
          .join(', ')
        return {
          ...dc,
          ...(productLabel ? { product: productLabel } : {}),
        }
      })
      console.log(`✅ Loaded ${normalized.length} Term-Wise DCs`)
      setItems(normalized)
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
            
            const term = persistProductTerm({ term: pd.term, level: pd.level })
            
            return {
              product: pd.product || '',
              class: pd.class || '1',
              category: pd.category || 'New School',
              specs: pd.specs || 'Regular',
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
              level: displayProductLevel(p.level),
              unitPrice: price,
              total: total,
              term: persistProductTerm(p),
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
              level: displayProductLevel(pd.level),
              unitPrice: estimatedUnitPrice,
              total: total,
              term: persistProductTerm(pd),
            }
          })
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

      const resolvedDcOrderId =
        dc.dcOrderId && typeof dc.dcOrderId === 'object'
          ? dc.dcOrderId._id
          : (dc.dcOrderId as string | undefined)
      const gate = await getProgramInvoiceGate(
        resolvedDcOrderId ? String(resolvedDcOrderId) : null,
        paymentBreakdown[0]?.product || fullDC.product || null
      )

      setInvoiceData({
        schoolInfo,
        paymentBreakdown: gate.invoicePending ? [] : paymentBreakdown,
        totalAmount: gate.invoicePending ? 0 : totalAmount,
        dcDate: fullDC.dcDate || undefined,
        invoicePending: gate.invoicePending,
        invoicePendingMessage: gate.message,
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
      const [dcOrder, fullDC] = await Promise.all([
        apiRequest<any>(`/dc-orders/${dcOrderId}`),
        apiRequest<any>(`/dc/${dc._id}`).catch(() => dc),
      ])
      setSelectedDC(fullDC?._id ? fullDC : dc)
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
      
      // Load products from THIS Term-Wise DC only. Never fall back to the full DcOrder
      // (that list still contains the Term 1 p3 allocation matched by product name).
      const sourceDetails = Array.isArray(fullDC?.productDetails) && fullDC.productDetails.length > 0
        ? fullDC.productDetails
        : Array.isArray(dc.productDetails)
          ? dc.productDetails
          : []
      let productsToShow: any[] = []
      
      if (sourceDetails.length > 0) {
        const routedRows = sourceDetails.some((p: any) => p.closeLeadDestination)
          ? sourceDetails.filter((p: any) => p.closeLeadDestination === 'TERM_WISE_DC')
          : sourceDetails
        productsToShow = routedRows.map((p: any) => {
          const dcProductName = (p.product || p.product_name || '').toLowerCase().trim()
          const dcLevel = String(p.level || '').trim().toLowerCase()
          const dcClass = String(p.class ?? '').trim().toLowerCase()
          const matchingDcOrderProduct = (dcOrder.products || []).find((op: any) => {
            const orderProductName = (op.product_name || '').toLowerCase().trim()
            if (orderProductName !== dcProductName) return false
            const orderLevel = String(op.level || '').trim().toLowerCase()
            if (dcLevel && orderLevel && dcLevel !== orderLevel) return false
            const orderClass = String(op.class ?? '').trim().toLowerCase()
            if (dcClass && orderClass && dcClass !== orderClass) return false
            return true
          })
          
          return {
            product_name: p.product || p.product_name || '',
            quantity: Number(p.quantity) || Number(p.strength) || 0,
            unit_price: matchingDcOrderProduct?.unit_price || p.unit_price || p.price || 0,
            term: persistProductTerm(p),
            level: p.level,
            class: p.class,
            specs: p.specs,
            subject: p.subject,
            category: p.category,
            productCategory: p.productCategory,
          }
        })
      }
      
      setEditProductRows(
        productsToShow.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          level: p.level,
          class: p.class,
          specs: p.specs,
          subject: p.subject,
          category: p.category,
          productCategory: p.productCategory,
          term: persistProductTerm(p),
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
        level: row.level,
        class: row.class,
        specs: row.specs,
        subject: row.subject,
        category: row.category,
        productCategory: row.productCategory,
        term: persistProductTerm(row),
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
        originatingDcId: selectedDC?._id,
      }

      await apiRequest(`/dc-orders/${selectedDcOrder._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })

      if (selectedDC?._id) {
        const existing = Array.isArray(selectedDC.productDetails) ? selectedDC.productDetails : []
        const productDetails = editProductRows.map((row, idx) => {
          const prev = existing[idx] || {}
          return {
            ...prev,
            product: row.product_name || prev.product,
            productName: row.product_name || prev.productName,
            quantity: row.quantity,
            strength: Number(prev.strength) || row.quantity,
            price: row.unit_price ?? prev.price,
            unit_price: row.unit_price,
            level: row.level || prev.level,
            class: row.class || prev.class,
            specs: row.specs || prev.specs,
            subject: row.subject ?? prev.subject,
            category: row.category || prev.category,
            productCategory: row.productCategory || prev.productCategory,
            term: persistProductTerm({ ...prev, ...row }),
          }
        })
        await apiRequest('/dc/' + selectedDC._id, {
          method: 'PUT',
          body: JSON.stringify({ productDetails }),
        })
      }

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
      // Fetch the full DC data to get productDetails (most accurate)
      const fullDC = await apiRequest<any>(`/dc/${dc._id}`).catch(() => dc)
      
      // Fetch the latest DC Order data (includes changes from Edit PO)
      const dcOrder = await apiRequest<any>(`/dc-orders/${dcOrderId}`)
      
      // Populate form with current data from DC Order (shows changes made in Edit PO)
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
      
      setRequestDCFormData(formData)
      
      // Load products already on this Term-Wise DC (Close Lead classification).
      // Do not pull Term 2 rows from the full DcOrder — that wrongly includes Term-2-only products.
      let termWiseProducts: any[] = []

      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        const routedRows = fullDC.productDetails.some((p: any) => p.closeLeadDestination)
          ? fullDC.productDetails.filter((p: any) => p.closeLeadDestination === 'TERM_WISE_DC')
          : fullDC.productDetails
        termWiseProducts = routedRows.map((p: any) => {
          const matchingDcOrderProduct = (dcOrder.products || []).find((op: any) => {
            const orderProductName = (op.product_name || '').toLowerCase().trim()
            const dcProductName = (p.product || p.product_name || '').toLowerCase().trim()
            if (orderProductName !== dcProductName) return false
            const orderLevel = String(op.level || '').trim().toLowerCase()
            const dcLevel = String(p.level || '').trim().toLowerCase()
            if (dcLevel && orderLevel && dcLevel !== orderLevel) return false
            return true
          })
          return {
            product_name: p.product || p.product_name || '',
            quantity: Number(p.quantity) || Number(p.strength) || 0,
            unit_price: matchingDcOrderProduct?.unit_price || p.unit_price || p.price || 0,
            term: persistProductTerm(p),
            level: p.level,
            class: p.class,
            specs: p.specs,
            subject: p.subject,
            category: p.category,
            productCategory: p.productCategory,
            closeLeadDestination: p.closeLeadDestination || 'TERM_WISE_DC',
          }
        })
      }

      console.log('📦 Loaded Term-Wise products for Request DC:', {
        fromDCProductDetails: fullDC.productDetails?.length || 0,
        termWiseProductsCount: termWiseProducts.length,
        products: termWiseProducts
      })

      setRequestDCProductRows(
        termWiseProducts.map((p: any, idx: number) => ({
          id: String(idx + 1),
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          level: p.level,
          class: p.class,
          specs: p.specs,
          subject: p.subject,
          category: p.category,
          productCategory: p.productCategory,
          term: persistProductTerm(p),
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
      const dcOrderId = typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId._id : selectedDC.dcOrderId
      
      if (!dcOrderId) {
        toast.error('Cannot request DC: DC Order not found')
        return
      }

      // Convert product rows already on this Term-Wise DC (do not require term === Term 2)
      const existingDetails = Array.isArray(selectedDC.productDetails) ? selectedDC.productDetails : []
      const productDetails = requestDCProductRows
        .map((row, idx) => {
          const prev = existingDetails[idx] || existingDetails.find((p: any) => {
            const name = String(p.product || p.product_name || '').toLowerCase().trim()
            const rowName = String(row.product_name || '').toLowerCase().trim()
            if (name !== rowName) return false
            const pl = String(p.level || '').toLowerCase().trim()
            const rl = String(row.level || '').toLowerCase().trim()
            return !pl || !rl || pl === rl
          }) || {}
          return {
            ...prev,
            product: row.product_name,
            class: row.class || prev.class || '1',
            category: row.category || prev.category || (requestDCFormData.school_type === 'Existing' ? 'Existing School' : 'New School'),
            specs: row.specs || prev.specs || 'Regular',
            subject: row.subject ?? prev.subject,
            productCategory: row.productCategory || prev.productCategory,
            quantity: row.quantity,
            strength: row.quantity,
            price: row.unit_price,
            total: (row.quantity || 0) * (row.unit_price || 0),
            level: row.level || prev.level,
            term: persistProductTerm({ ...prev, ...row }),
            closeLeadDestination: 'TERM_WISE_DC',
            unit_price: row.unit_price || 0,
          }
        })

      // Update DC - keep status as 'scheduled_for_later' so it still appears in Term-Wise DC
      const dcPayload = {
        dcOrderId: dcOrderId,
        customerName: requestDCFormData.school_name || selectedDC.customerName || '',
        customerPhone: requestDCFormData.contact_mobile || selectedDC.customerPhone || '',
        productDetails,
        dcDate: new Date().toISOString().split('T')[0],
        dcRemarks: requestDCFormData.remarks,
        dcCategory: requestDCFormData.school_type === 'Existing' ? 'Existing School' : 'New School',
        status: 'scheduled_for_later', // Keep as scheduled_for_later so it appears in Term-Wise DC
      }

      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify(dcPayload),
      })

      // Update DcOrder status to 'dc_requested' and store request data with unit prices
      try {
        const updateResponse = await apiRequest(`/dc-orders/${dcOrderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'dc_requested',
            dcRequestData: {
              productDetails: productDetails, // Includes unit_price
              requestedQuantity: totalQuantity,
              requestedAt: new Date().toISOString(),
            },
          }),
        })
        console.log('✅ DcOrder status updated to dc_requested:', {
          dcOrderId,
          response: updateResponse,
          status: updateResponse?.status
        })
        
        // Verify the status was actually updated
        if (updateResponse?.status !== 'dc_requested') {
          console.warn('⚠️ DcOrder status may not have been updated correctly:', updateResponse?.status)
          toast.warning('DC updated, but DcOrder status may not have been updated. Please check Closed Sales page.')
        }
      } catch (dcOrderError: any) {
        console.error('❌ Failed to update DcOrder status:', {
          dcOrderId,
          error: dcOrderError?.message,
          fullError: dcOrderError
        })
        // Still show success for DC update, but warn about DcOrder
        toast.error(`Failed to update DcOrder status: ${dcOrderError?.message || 'Unknown error'}. Please refresh Closed Sales page manually.`)
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

  // Term-Wise list = DCs already routed at Close Lead (status scheduled_for_later).
  // Do not re-filter by product.term === Term 2.
  const groupedByTerm = useMemo(() => {
    return { term1: [] as DC[], term2: items }
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
                
                // Show product-detail rows on this Term-Wise DC only (Close Lead classification).
                // Do not fall back to DcOrder Term 2 products — that wrongly lists Term-2-only rows.
                let product = '-'
                if (d.productDetails && Array.isArray(d.productDetails) && d.productDetails.length > 0) {
                  const routed = d.productDetails.some((p: any) => p.closeLeadDestination)
                    ? d.productDetails.filter((p: any) => p.closeLeadDestination === 'TERM_WISE_DC')
                    : d.productDetails
                  const names = routed.map((p: any) => p.product || p.productName || '').filter(Boolean)
                  if (names.length > 0) product = names.join(', ')
                }
                
                // Fallback to other product fields if no productDetails
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
            View clients with Term-Wise DC rows (paired Level 2 / Term 2 from Close Lead)
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

              {invoiceData.invoicePending && (
                <div className="border rounded-lg p-4 bg-amber-50 text-amber-800 text-sm">
                  {invoiceData.invoicePendingMessage || 'Invoice not generated yet'}
                </div>
              )}

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
                          <td className="py-3 px-4">{persistProductTerm(item)}</td>
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
              {!invoiceData.invoicePending && (
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
              )}
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
                      <TableHead>Level</TableHead>
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
                              value={persistProductTerm(row)}
                              readOnly
                              disabled
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.level || ''}
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
                      <TableHead>Level</TableHead>
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
                              value={persistProductTerm(row)}
                              readOnly
                              disabled
                              className="h-9 bg-neutral-50"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.level || ''}
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

