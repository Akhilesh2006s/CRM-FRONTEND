'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'
import { toast } from 'sonner'
import { keepMyClientsOwnedProductRows } from '@/lib/clientDcProductRows'
import { resolveExistingProductTerm } from '@/lib/productTerm'
import { sortDcsNewestFirst } from '@/lib/dcListSort'

type DcOrderData = {
  _id?: string
  school_name?: string
  school_code?: string
  school_type?: string
  dc_code?: string
  contact_person?: string
  contact_mobile?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  cluster?: string
  remarks?: string
  products?: Array<{
    product_name?: string
    product?: string
    quantity?: number
    strength?: number
  }>
  assigned_to?: {
    _id: string
    name?: string
  } | string
  due_amount?: number
  due_percentage?: number
  // Transport fields
  transport_name?: string
  transport_location?: string
  transportation_landmark?: string
  pincode?: string
  dcRequestData?: {
    productDetails?: any[]
    dcDate?: string
    dcCategory?: string
    dcRemarks?: string
    dcNotes?: string
  }
  pendingEdit?: {
    transport_name?: string
    transport_location?: string
    transportation_landmark?: string
    pincode?: string
    status?: string
  }
}

type DC = {
  _id: string
  dcOrderId?: DcOrderData | string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  requestedQuantity?: number
  deliverableQuantity?: number
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  dcNotes?: string
  financeRemarks?: string
  splApproval?: string
  smeRemarks?: string
  dcType?: 'normal' | 'shortage'
  employeeId?: {
    _id: string
    name?: string
  } | string
  productDetails?: Array<{
    product: string
    class: string
    category: string
    productName: string
    quantity: number
    strength?: number
  }>
  adminId?: {
    _id: string
    name?: string
  }
  adminReviewedAt?: string
  sentToManagerAt?: string
  createdAt?: string
}

type ProductRow = {
  id: string
  product: string
  class: string
  // Student category (New/Existing/Both)
  category: string
  // Product category (e.g. EduApt, Prime+, etc.)
  productCategory?: string
  specs: string
  subject?: string
  strength: number
  price: number
  total: number
  level: string
  productName?: string
  quantity?: number
  term: string
}

function pendingRowQty(row: { quantity?: number; strength?: number }) {
  const q = Number(row.quantity)
  if (Number.isFinite(q) && q > 0) return q
  const s = Number(row.strength)
  return Number.isFinite(s) && s > 0 ? s : 0
}

export default function PendingDCPage() {
  const router = useRouter()
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Get current user to check role
  const currentUser = getCurrentUser()
  const isCoordinator = currentUser?.role === 'Coordinator'
  const isSeniorCoordinator = currentUser?.role === 'Senior Coordinator'
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
  
  // DC Details form fields
  const [financeRemarks, setFinanceRemarks] = useState('')
  const [splApproval, setSplApproval] = useState('')
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [smeRemarks, setSmeRemarks] = useState('')
  const [dcDetailsErrors, setDcDetailsErrors] = useState<{
    dcDate?: string
    dcCategory?: string
    financeRemarks?: string
    splApproval?: string
    dcRemarks?: string
    dcNotes?: string
  }>({})
  
  // Product rows
  const [productRows, setProductRows] = useState<ProductRow[]>([])
  
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const categoryOptions = [
    'NA',
    'Training Mterial',
    'new Students',
    'Old Students',
    'Excess',
    'Exchange',
    'Shortage',
    'Excess-OldStudents',
    'Excess NewStudents',
  ]
  const { productNames: availableProducts, getProductLevels, getDefaultLevel, getProductSpecs, getProductSubjects, getProductCategories, hasProductCategories, hasProductSpecs } = useProducts()
  const availableDCCategories = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiRequest<DC[]>(`/dc?status=pending_dc`)
      // Ensure data is an array before setting
      const dataArray = Array.isArray(data) ? data : []
      // Filter out:
      // 1. DCs that have been submitted to warehouse (status: sent_to_manager)
      // 2. Term 2 DCs (all products are Term 2) - they should be in Term-Wise DC, not Pending DC
      const filteredDCs = dataArray.filter(dc => {
        if (dc.status === 'sent_to_manager') return false
        
        // Check if this is a Term 2 DC (all products are Term 2)
        if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
          const allTerm2 = dc.productDetails.every((p: any) => (p.term || 'Term 1') === 'Term 2')
          const hasTerm1 = dc.productDetails.some((p: any) => {
            const term = p.term || 'Term 1'
            return term === 'Term 1' || term === 'Both'
          })
          // If all products are Term 2 and no Term 1, this should be in Term-Wise DC
          if (allTerm2 && !hasTerm1) {
            console.log(`⚠️ Filtering out Term 2 DC ${dc._id} from Pending DC - should be in Term-Wise DC`)
            return false
          }
        }
        
        return true
      })
      setItems(sortDcsNewestFirst(filteredDCs))
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
      alert(`Error loading DCs: ${e?.message || 'Unknown error'}`)
    } finally {
    setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openDCForm = async (dc: DC) => {
    try {
      // Fetch full DC details
      const fullDC = await apiRequest<DC>(`/dc/${dc._id}`)
      console.log('Full DC data from API:', fullDC)
      
      // Also fetch the DcOrder if it exists to get all lead/deal information
      let dcOrderData: DcOrderData | null = null
      if (fullDC.dcOrderId) {
        try {
          const dcOrderId = typeof fullDC.dcOrderId === 'object' && fullDC.dcOrderId !== null && '_id' in fullDC.dcOrderId 
            ? fullDC.dcOrderId._id 
            : (typeof fullDC.dcOrderId === 'string' ? fullDC.dcOrderId : null)
          if (dcOrderId) {
            dcOrderData = await apiRequest<DcOrderData>(`/dc-orders/${dcOrderId}`)
            console.log('DcOrder data from API:', dcOrderData)
          }
        } catch (e) {
          console.warn('Failed to fetch DcOrder:', e)
        }
      }
      
      // Merge DC and DcOrder data
      const mergedDC: DC = {
        ...fullDC,
        // Get customer info from DcOrder if available
        customerName: fullDC.customerName || (dcOrderData?.school_name) || '',
        customerPhone: fullDC.customerPhone || (dcOrderData?.contact_mobile) || '',
        customerEmail: fullDC.customerEmail || (dcOrderData?.email) || '',
        customerAddress: fullDC.customerAddress || (dcOrderData?.address) || (dcOrderData?.location) || '',
        // Get product from DcOrder if available
        product: fullDC.product || (dcOrderData?.products && Array.isArray(dcOrderData.products) 
          ? dcOrderData.products.map((p) => p.product_name || p.product || '').join(', ') 
          : ''),
        // Store DcOrder data for display
        dcOrderId: dcOrderData || fullDC.dcOrderId,
      }
      
      setSelectedDC(mergedDC)
      
      // Populate form fields
      setFinanceRemarks(mergedDC.financeRemarks || '')
      setSplApproval(mergedDC.splApproval || '')
      setDcDate(mergedDC.dcDate ? new Date(mergedDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(mergedDC.dcRemarks || '')
      setDcCategory(mergedDC.dcCategory || '')
      setDcNotes(mergedDC.dcNotes || '')
      setSmeRemarks(mergedDC.smeRemarks || '')
      setDcDetailsErrors({})

      const isShortageDc = fullDC.dcType === 'shortage'
      
      // Open must display THIS DC's requested products. Never reconstruct from the
      // original lead / unsplit DcOrder.products / a longer dcRequestData snapshot.
      const dcProductDetails = Array.isArray(mergedDC.productDetails) ? mergedDC.productDetails : []
      const requestProductDetails = Array.isArray(dcOrderData?.dcRequestData?.productDetails)
        ? dcOrderData.dcRequestData.productDetails
        : []
      const sourceDetails = dcProductDetails.length > 0 ? dcProductDetails : requestProductDetails
      const ownedDetails = keepMyClientsOwnedProductRows(sourceDetails)
      const validProductDetails = ownedDetails.filter((p: any) => p && (p.product || p.productName) && (p.quantity > 0 || p.strength > 0))
      
      console.log('[DC-ASSOC] Pending DC Open products', {
        dcId: mergedDC._id,
        dcCount: dcProductDetails.length,
        requestCount: requestProductDetails.length,
        ownedCount: validProductDetails.length,
        total: validProductDetails.reduce(
          (s: number, p: any) => s + (Number(p.quantity) || Number(p.strength) || 0),
          0
        ),
        lines: validProductDetails.map((p: any) => ({
          product: p.product || p.productName,
          level: p.level,
          term: p.term,
          quantity: Number(p.quantity) || Number(p.strength) || 0,
        })),
      })
      
      if (validProductDetails.length > 0) {
        // Use existing productDetails from DC
        console.log('✅ Using DC.productDetails:', validProductDetails)
        const mappedProductRows = validProductDetails.map((p: any, idx: number) => {
          // Normalize product value to match dropdown options (case-insensitive matching)
          const rawProduct = (p.product || p.productName || '').trim()
          // Find matching product (case-insensitive)
          const matchedProduct = availableProducts.find(ap => 
            ap.toLowerCase() === rawProduct.toLowerCase() || 
            rawProduct.toLowerCase().includes(ap.toLowerCase()) ||
            ap.toLowerCase().includes(rawProduct.toLowerCase())
          ) || (rawProduct || 'ABACUS')

          const rawProductCategory =
            typeof p.productCategory === 'string' ? p.productCategory.trim() : ''
          const rawCategory = typeof p.category === 'string' ? p.category.trim() : ''

          const skuCategories = getProductCategories(matchedProduct)
          const normalizeSku = (v: any) => String(v || '').trim().toLowerCase().replace(/\s+/g, '')
          const studentCategoryValues = [
            ...categoryOptions,
            'New Students',
            'Existing Students',
            'Both',
            'New School',
            'Existing School',
          ]
          const isStudentCategory = (v: any) => studentCategoryValues.some(sc => normalizeSku(sc) === normalizeSku(v))

          const normalizeCategory = (v: string) => {
            if (!v) return ''
            if (v === 'New Students') return 'new Students'
            if (v === 'Existing Students') return 'Old Students'
            if (v === 'Both') return 'NA'
            if (v === 'New School') return 'new Students'
            if (v === 'Existing School') return 'Old Students'
            return v
          }

          const normalizedCategory = normalizeCategory(rawCategory)
          const defaultCategory =
            mergedDC.school_type === 'Existing' ? 'Old Students' : 'new Students'
          const finalCategory = isShortageDc
            ? 'Shortage'
            : categoryOptions.includes(normalizedCategory)
            ? normalizedCategory
            : defaultCategory

          const matchedSkuFromProductCategory = rawProductCategory
            ? skuCategories.find(c => normalizeSku(c) === normalizeSku(rawProductCategory))
            : undefined
          const matchedSkuFromCategory =
            !matchedSkuFromProductCategory && rawCategory && !isStudentCategory(rawCategory)
              ? skuCategories.find(c => normalizeSku(c) === normalizeSku(rawCategory))
              : undefined

          // Backward compatibility:
          // - newer records store SKU category in `productCategory`
          // - older records sometimes stored SKU category in `category`
          const finalProductCategory =
            matchedSkuFromProductCategory || matchedSkuFromCategory || (!isStudentCategory(rawCategory) ? rawCategory : '')

          return {
            id: String(idx + 1),
            product: matchedProduct, // Use matched product for dropdown
            class: p.class || '1',
            category: finalCategory,
            productCategory: finalProductCategory || undefined,
            productName: p.productName || p.product || matchedProduct, // Use productName or product or matched product
            quantity: Number(p.quantity) || Number(p.strength) || 0,
            strength: Number(p.strength) || Number(p.quantity) || 0,
            level: p.level || getDefaultLevel(matchedProduct),
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            price: Number(p.unit_price) || Number(p.price) || 0,
            total: Number(p.total) || 0,
            term: resolveExistingProductTerm(p),
          }
        })
        
        setProductRows(mappedProductRows)
      } else if (dcOrderData?.products && Array.isArray(dcOrderData.products) && dcOrderData.products.length > 0) {
        const ownedOrderProducts = keepMyClientsOwnedProductRows(dcOrderData.products)
        const productsToUse = ownedOrderProducts.length > 0 ? ownedOrderProducts : []
        
        console.log('[DC-ASSOC] Pending DC Open fallback to DcOrder.products', {
          allProducts: dcOrderData.products.length,
          owned: productsToUse.length,
        })
        
        if (productsToUse.length === 0) {
          console.warn('⚠️ No products found in DcOrder.products')
          setProductRows([])
        } else {
          setProductRows(
            productsToUse.map((p: any, idx: number) => {
              const rawProduct = p.product_name || p.product || 'ABACUS'
              // Find matching product (case-insensitive)
              const matchedProduct =
                availableProducts.find(
                  (ap) =>
                    ap.toLowerCase() === String(rawProduct).toLowerCase() ||
                    String(rawProduct).toLowerCase().includes(ap.toLowerCase()) ||
                    ap.toLowerCase().includes(String(rawProduct).toLowerCase())
                ) || 'ABACUS'

              const skuCategories = getProductCategories(matchedProduct)
              const normalizeSku = (v: any) =>
                String(v || '').trim().toLowerCase().replace(/\s+/g, '')

              const rawProductCategory =
                typeof p.productCategory === 'string' ? p.productCategory.trim() : ''
              const rawCategory = typeof p.category === 'string' ? p.category.trim() : ''

              const studentCategories = ['New Students', 'Existing Students', 'Both', 'New School', 'Existing School']
              const isStudentCategory = (v: any) =>
                studentCategories.some(sc => normalizeSku(sc) === normalizeSku(v))

              // Use SKU productCategory if available; otherwise only use `category` if it isn't a student category.
              const productCategoryCandidate =
                rawProductCategory || (!isStudentCategory(rawCategory) ? rawCategory : '')

              const matchedSkuFromProductCategory = rawProductCategory
                ? skuCategories.find(c => normalizeSku(c) === normalizeSku(rawProductCategory))
                : undefined

              const matchedSkuFromCategory =
                !matchedSkuFromProductCategory && rawCategory && !isStudentCategory(rawCategory)
                  ? skuCategories.find(c => normalizeSku(c) === normalizeSku(rawCategory))
                  : undefined

              // Prefer matched SKU option string; otherwise show stored candidate to avoid empty UI.
              const finalProductCategory = rawProductCategory

              return {
                id: String(idx + 1),
                product: matchedProduct, // Use matched product for dropdown
                class: p.class || '1',
                category: isShortageDc
                  ? 'Shortage'
                  : mergedDC.school_type === 'Existing'
                    ? 'Old Students'
                    : 'new Students',
                productCategory: finalProductCategory || undefined,
                productName: matchedProduct, // Use matched product
                quantity: Number(p.quantity) || 0,
                strength: Number(p.strength) || Number(p.quantity) || 0,
                level: p.level || getDefaultLevel(matchedProduct),
                specs: p.specs || 'Regular',
                subject: p.subject || undefined,
                price: Number(p.unit_price) || Number(p.price) || 0,
                total:
                  Number(p.total) ||
                  (Number(p.unit_price) || 0) * (Number(p.quantity) || 0),
                term: resolveExistingProductTerm(p),
              }
            })
          )
        }
      } else {
        // Fallback: create from product string or check if DC has product field
        console.log('⚠️ No productDetails or DcOrder products found, using fallback')
        const rawProduct = mergedDC.product || (dcOrderData?.products && Array.isArray(dcOrderData.products) && dcOrderData.products.length > 0
          ? dcOrderData.products[0].product_name || dcOrderData.products[0].product
          : 'ABACUS')
        // Find matching product (case-insensitive)
        const matchedProduct = availableProducts.find(ap => 
          ap.toLowerCase() === String(rawProduct).toLowerCase() || 
          String(rawProduct).toLowerCase().includes(ap.toLowerCase()) ||
          ap.toLowerCase().includes(String(rawProduct).toLowerCase())
        ) || 'ABACUS'
        
        // Try to get quantity from requestedQuantity or DcOrder
        const fallbackQuantity = mergedDC.requestedQuantity || 
          (dcOrderData?.products && Array.isArray(dcOrderData.products) && dcOrderData.products.length > 0
            ? dcOrderData.products.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0)
            : 0) || 0
        
        setProductRows([{
          id: '1',
          product: matchedProduct, // Use matched product for dropdown
          class: '1',
          category: isShortageDc
            ? 'Shortage'
            : mergedDC?.school_type === 'Existing'
              ? 'Old Students'
              : 'new Students',
          productCategory: undefined,
          productName: matchedProduct, // Use matched product
          quantity: fallbackQuantity,
          strength: fallbackQuantity,
          level: getDefaultLevel(matchedProduct),
          specs: getProductSpecs(matchedProduct)[0] || '',
          subject: undefined,
          price: 0,
          total: 0,
          term: 'Term 1',
        }])
      }
      
      console.log('📦 Final productRows set:', productRows.length, 'products')
    } catch (e: any) {
      console.error('Failed to load DC details:', e)
      alert(`Error loading DC: ${e?.message || 'Unknown error'}`)
    }
  }

  const clearDcDetailsError = (key: keyof typeof dcDetailsErrors) => {
    setDcDetailsErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validatePendingDcDetailsFields = (): boolean => {
    const next: typeof dcDetailsErrors = {}
    const dateVal = String(dcDate || '').trim()
    if (!dateVal || Number.isNaN(new Date(dateVal).getTime())) {
      next.dcDate = 'DC Date is required.'
    }
    if (!String(dcCategory || '').trim()) {
      next.dcCategory = 'Please select a DC Category.'
    }
    if (!String(financeRemarks || '').trim()) {
      next.financeRemarks = 'Finance Remarks is required.'
    }
    if (!String(splApproval || '').trim()) {
      next.splApproval = 'SPL Approval is required.'
    }
    if (!String(dcRemarks || '').trim()) {
      next.dcRemarks = 'DC Remarks is required.'
    }
    if (!String(dcNotes || '').trim()) {
      next.dcNotes = 'DC Notes is required.'
    }
    setDcDetailsErrors(next)
    if (Object.keys(next).length > 0) {
      toast.error(Object.values(next)[0] || 'Please fill required DC Details before submitting.')
      if (typeof document !== 'undefined') {
        document.getElementById('dc-details-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!selectedDC) return

    if (!validatePendingDcDetailsFields()) {
      return
    }
    
    setSaving(true)
    try {
      // Check if this is a Term 2 DC (all products are Term 2)
      const allProductsAreTerm2 = productRows.length > 0 && 
        productRows.every(row => (row.term || 'Term 1') === 'Term 2')
      const hasTerm1 = productRows.some(row => {
        const term = row.term || 'Term 1'
        return term === 'Term 1' || term === 'Both'
      })
      
      // Determine status: if all products are Term 2 and no Term 1, keep as scheduled_for_later
      // Otherwise, use pending_dc (or keep existing status if it's already pending_dc)
      let statusToUse = selectedDC.status || 'pending_dc'
      if (allProductsAreTerm2 && !hasTerm1) {
        // This is a Term 2 DC - should stay in Term-Wise DC
        statusToUse = 'scheduled_for_later'
        console.log('📦 Detected Term 2 DC - maintaining scheduled_for_later status')
      } else if (hasTerm1 || productRows.some(row => (row.term || 'Term 1') === 'Both')) {
        // This has Term 1 or Both - should be in Pending DC
        statusToUse = 'pending_dc'
        console.log('📦 Detected Term 1 or Both - using pending_dc status')
      }
      
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          financeRemarks,
          splApproval,
          dcDate,
          dcRemarks,
          dcCategory,
          dcNotes,
          smeRemarks,
          status: statusToUse, // Preserve Term 2 status
          productDetails: productRows.map(row => ({
            product: row.product,
            class: row.class || '1',
            category: selectedDC.dcType === 'shortage' ? 'Shortage' : row.category,
            productCategory: row.productCategory || undefined,
            productName: row.productName,
            quantity: pendingRowQty(row),
            strength: pendingRowQty(row),
            level: row.level,
            specs: row.specs || '',
            subject: row.subject || undefined,
            term: row.term || 'Term 1',
            unit_price: Number(row.price) || Number(row.unit_price) || 0,
            price: Number(row.price) || Number(row.unit_price) || 0,
            total:
              pendingRowQty(row) *
              (Number(row.price) || Number(row.unit_price) || 0),
          })),
        }),
      })
      
      const statusMessage = statusToUse === 'scheduled_for_later' 
        ? 'DC saved successfully! It will remain in Term-Wise DC.'
        : 'DC saved successfully!'
      alert(statusMessage)
      load()
      setSelectedDC(null)
    } catch (e: any) {
      alert(e?.message || 'Failed to save DC')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitToWarehouse = async () => {
    if (!selectedDC) return

    if (!validatePendingDcDetailsFields()) {
      return
    }
    
    const totalQuantity = productRows.reduce((sum, row) => sum + pendingRowQty(row), 0)
    if (totalQuantity <= 0) {
      toast.error('Please add at least one product with quantity > 0')
      return
    }
    
    // Check if this is a Term 2 DC (all products are Term 2)
    const allProductsAreTerm2 = productRows.length > 0 && 
      productRows.every(row => (row.term || 'Term 1') === 'Term 2')
    const hasTerm1 = productRows.some(row => {
      const term = row.term || 'Term 1'
      return term === 'Term 1' || term === 'Both'
    })
    
    // If it's a Term 2 DC, prevent submission and redirect user
    if (allProductsAreTerm2 && !hasTerm1) {
      alert('Term 2 DCs should be managed from the Term-Wise DC page. This DC will remain in Term-Wise DC. Please use the Term-Wise DC page to submit Term 2 DCs.')
      return
    }
    
    setSubmitting(true)
    try {
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          financeRemarks,
          splApproval,
          dcDate,
          dcRemarks,
          dcCategory,
          dcNotes,
          smeRemarks,
          productDetails: productRows.map(row => ({
            product: row.product,
            class: row.class || '1',
            category: selectedDC.dcType === 'shortage' ? 'Shortage' : row.category,
            productCategory: row.productCategory || undefined,
            productName: row.productName,
            quantity: pendingRowQty(row),
            strength: pendingRowQty(row),
            level: row.level,
            specs: row.specs || '',
            subject: row.subject || undefined,
            term: row.term || 'Term 1',
            unit_price: Number(row.price) || Number(row.unit_price) || 0,
            price: Number(row.price) || Number(row.unit_price) || 0,
            total:
              pendingRowQty(row) *
              (Number(row.price) || Number(row.unit_price) || 0),
          })),
          requestedQuantity: totalQuantity,
        }),
      })
      
      await apiRequest(`/dc/${selectedDC._id}/manager-request`, {
        method: 'POST',
        body: JSON.stringify({
          requestedQuantity: totalQuantity,
          remarks: dcRemarks || smeRemarks || '',
        }),
      })
      
      toast.success('DC submitted to Warehouse')
      setSelectedDC(null)
      router.push('/dashboard/warehouse/dc-at-warehouse')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit to Warehouse')
    } finally {
      setSubmitting(false)
    }
  }

  const getProductsSummary = (dc: DC) => {
    if (dc.productDetails && Array.isArray(dc.productDetails) && dc.productDetails.length > 0) {
      const total = dc.productDetails.reduce((sum, p) => sum + (p.quantity || 0), 0)
      const productName = dc.productDetails[0]?.product || dc.product || 'Product'
      return `${productName} - ${total}`
    }
    if (dc.product && dc.requestedQuantity) {
      return `${dc.product} - ${dc.requestedQuantity}`
    }
    return 'N/A'
  }

  const getDCNumber = (dc: DC) => {
    if (dc.createdAt) {
      const year = new Date(dc.createdAt).getFullYear()
      const shortYear = year.toString().slice(-2)
      const nextYear = (year + 1).toString().slice(-2)
      const dcId = dc._id.slice(-4)
      return `${shortYear}-${nextYear}/${dcId}`
    }
    return `DC-${dc._id.slice(-6)}`
  }

  const getSchoolCode = (dc: DC) => {
    const order = dc.dcOrderId
    if (order && typeof order === 'object') {
      const code = (order.school_code || order.dc_code || '').trim()
      return code || '-'
    }
    return '-'
  }

  if (selectedDC) {
    const isShortageDcDetail = selectedDC.dcType === 'shortage'

    // Show detailed form view
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Viswam Edutech - Raise DC</h1>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-blue-700 font-semibold">
                Products: <strong>{getProductsSummary(selectedDC)}</strong>
              </span>
              <span className="text-red-600 font-semibold">
                Due & Due (%): <strong>
                  {typeof selectedDC.dcOrderId === 'object' && selectedDC.dcOrderId !== null 
                    ? `${selectedDC.dcOrderId.due_amount || 0} & (${selectedDC.dcOrderId.due_percentage || 0}%)`
                    : '0 & (0%)'
                  }
                </strong>
              </span>
              <span className="text-gray-900 font-semibold">
                DC No: <strong>{getDCNumber(selectedDC)}</strong>
              </span>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectedDC(null)}>
            Back to List
          </Button>
        </div>

        <Card className="p-6 bg-white">
          {/* Lead Information and More Information */}
          {selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Lead Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Lead Information</h3>
                <div>
                  <Label>School Type</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.school_type || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="School Type"
                  />
                </div>
                <div>
                  <Label>School Name</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.school_name || selectedDC.customerName || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="School Name"
                  />
                </div>
                <div>
                  <Label>School Code</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.dc_code || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="School Code"
                  />
                </div>
                <div>
                  <Label>Contact Person Name</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.contact_person || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Contact Person Name"
                  />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.contact_mobile || selectedDC.customerPhone || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Contact Mobile"
                  />
                </div>
                <div>
                  <Label>Assigned To</Label>
                  <Input 
                    value={
                      (selectedDC.dcOrderId?.assigned_to && typeof selectedDC.dcOrderId.assigned_to === 'object' && 'name' in selectedDC.dcOrderId.assigned_to)
                        ? selectedDC.dcOrderId.assigned_to.name
                        : (selectedDC.employeeId && typeof selectedDC.employeeId === 'object' && 'name' in selectedDC.employeeId)
                        ? selectedDC.employeeId.name
                        : '-'
                    }
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Assigned To"
                  />
                </div>
              </div>

              {/* More Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">More Information</h3>
                <div>
                  <Label>Town</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.location || selectedDC.dcOrderId?.address?.split(',')[0] || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Town"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Textarea 
                    value={selectedDC.dcOrderId?.address || selectedDC.dcOrderId?.location || selectedDC.customerAddress || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    rows={3} 
                    placeholder="Address"
                  />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.zone || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Zone"
                  />
                </div>
                <div>
                  <Label>Cluster</Label>
                  <Input 
                    value={selectedDC.dcOrderId?.cluster || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    placeholder="Cluster"
                  />
                </div>
                <div>
                  <Label>Remarks</Label>
                  <Textarea 
                    value={selectedDC.dcOrderId?.remarks || ''} 
                    disabled 
                    className="bg-gray-100 text-gray-900" 
                    rows={2} 
                    placeholder="Remarks"
                  />
                </div>
              </div>

              {/* Delivery and Address Section - Transport Details */}
              {selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Delivery and Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Transport Name</Label>
                      <Input 
                        value={selectedDC.dcOrderId.pendingEdit?.transport_name || selectedDC.dcOrderId.transport_name || ''} 
                        disabled 
                        className="bg-gray-100 text-gray-900" 
                        placeholder="Transport Name"
                      />
                    </div>
                    <div>
                      <Label>Transport Location</Label>
                      <Input 
                        value={selectedDC.dcOrderId.pendingEdit?.transport_location || selectedDC.dcOrderId.transport_location || ''} 
                        disabled 
                        className="bg-gray-100 text-gray-900" 
                        placeholder="Transport Location"
                      />
                    </div>
                    <div>
                      <Label>Transportation Landmark</Label>
                      <Input 
                        value={selectedDC.dcOrderId.pendingEdit?.transportation_landmark || selectedDC.dcOrderId.transportation_landmark || ''} 
                        disabled 
                        className="bg-gray-100 text-gray-900" 
                        placeholder="Transportation Landmark"
                      />
                    </div>
                    <div>
                      <Label>Pincode</Label>
                      <Input 
                        value={selectedDC.dcOrderId.pendingEdit?.pincode || selectedDC.dcOrderId.pincode || ''} 
                        disabled 
                        className="bg-gray-100 text-gray-900" 
                        placeholder="Pincode"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DC Details Section */}
          <div id="dc-details-section" className="space-y-4 mb-6 border-t pt-6">
            <h3 className="font-semibold text-gray-900 text-lg">DC Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Finance Remarks *</Label>
                <Input
                  value={financeRemarks}
                  onChange={(e) => {
                    setFinanceRemarks(e.target.value)
                    clearDcDetailsError('financeRemarks')
                  }}
                  placeholder="Finance Remarks"
                  className={`bg-white text-gray-900 ${dcDetailsErrors.financeRemarks ? 'border-red-500' : ''}`}
                />
                {dcDetailsErrors.financeRemarks && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.financeRemarks}</p>
                )}
              </div>
              <div>
                <Label>SPL Approval *</Label>
                <Input
                  value={splApproval}
                  onChange={(e) => {
                    setSplApproval(e.target.value)
                    clearDcDetailsError('splApproval')
                  }}
                  placeholder="Special Approval"
                  className={`bg-white text-gray-900 ${dcDetailsErrors.splApproval ? 'border-red-500' : ''}`}
                />
                {dcDetailsErrors.splApproval && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.splApproval}</p>
                )}
              </div>
              <div>
                <Label>DC Date *</Label>
                <Input
                  type="date"
                  value={dcDate}
                  onChange={(e) => {
                    setDcDate(e.target.value)
                    clearDcDetailsError('dcDate')
                  }}
                  className={`bg-white text-gray-900 ${dcDetailsErrors.dcDate ? 'border-red-500' : ''}`}
                />
                {dcDetailsErrors.dcDate && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcDate}</p>
                )}
              </div>
              <div>
                <Label>DC Remarks *</Label>
                <Input
                  value={dcRemarks}
                  onChange={(e) => {
                    setDcRemarks(e.target.value)
                    clearDcDetailsError('dcRemarks')
                  }}
                  placeholder="DC Remarks"
                  className={`bg-white text-gray-900 ${dcDetailsErrors.dcRemarks ? 'border-red-500' : ''}`}
                />
                {dcDetailsErrors.dcRemarks && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcRemarks}</p>
                )}
              </div>
              <div>
                <Label>DC Category *</Label>
                <Select
                  value={dcCategory}
                  onValueChange={(v) => {
                    setDcCategory(v)
                    clearDcDetailsError('dcCategory')
                  }}
                >
                  <SelectTrigger className={`bg-white text-gray-900 ${dcDetailsErrors.dcCategory ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select DC Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDCCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dcDetailsErrors.dcCategory && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcCategory}</p>
                )}
              </div>
              <div>
                <Label>DC Notes *</Label>
                <Input
                  value={dcNotes}
                  onChange={(e) => {
                    setDcNotes(e.target.value)
                    clearDcDetailsError('dcNotes')
                  }}
                  placeholder="Notes"
                  className={`bg-white text-gray-900 ${dcDetailsErrors.dcNotes ? 'border-red-500' : ''}`}
                />
                {dcDetailsErrors.dcNotes && (
                  <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcNotes}</p>
                )}
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="border-t pt-6 mb-6">
            <div className="mb-3">
              <Label className="text-lg font-semibold text-gray-900">Products</Label>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="py-2 px-3 text-left border-r text-gray-900">Product</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Class</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Product Category</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Category</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Specs</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Subject</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Strength</th>
                    <th className="py-2 px-3 text-left border-r text-gray-900">Level</th>
                    <th className="py-2 px-3 text-center text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row, idx) => (
                    <tr key={row.id} className="border-b bg-white">
                      <td className="py-2 px-3 border-r">
                        <Select value={row.product} onValueChange={(v) => {
                          const updated = [...productRows]
                          updated[idx].product = v
                          // Default level
                          updated[idx].level = getDefaultLevel(v)
                          // Default product category if configured
                          if (hasProductCategories(v)) {
                            const cats = getProductCategories(v)
                            updated[idx].productCategory = cats[0] || ''
                          } else {
                            updated[idx].productCategory = undefined
                          }
                          // Default specs
                          const specs = getProductSpecs(v)
                          updated[idx].specs = specs[0] || ''
                          // Default subject if product has subjects
                          const subjects = getProductSubjects(v)
                          updated[idx].subject = subjects.length > 0 ? subjects[0] : undefined
                          setProductRows(updated)
                        }}>
                          <SelectTrigger className="h-8 text-xs bg-white">
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
                          const updated = [...productRows]
                          updated[idx].class = v
                          setProductRows(updated)
                        }}>
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableClasses.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 border-r">
                        {hasProductCategories(row.product) ? (
                          <Select
                            value={row.productCategory || ''}
                            onValueChange={(v) => {
                              const updated = [...productRows]
                              updated[idx].productCategory = v
                              setProductRows(updated)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Prod Category" />
                            </SelectTrigger>
                            <SelectContent>
                            {(() => {
                              const opts = getProductCategories(row.product)
                              const current = (row.productCategory || '').trim()
                              const selectOpts =
                                current && !opts.includes(current) ? [...opts, current] : opts
                              return selectOpts.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))
                            })()}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r">
                        {isShortageDcDetail ? (
                          <span
                            className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded"
                            title="Shortage DC — category is always Shortage (read-only)"
                          >
                            Shortage
                          </span>
                        ) : (
                          <span className="text-xs text-gray-900">{row.category || '-'}</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r">
                        {hasProductSpecs(row.product) ? (
                        <Select value={row.specs || undefined} onValueChange={(v) => {
                          const updated = [...productRows]
                          updated[idx].specs = v
                          setProductRows(updated)
                        }}>
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue placeholder="Select Specs" />
                          </SelectTrigger>
                          <SelectContent>
                            {getProductSpecs(row.product).map(spec => (
                              <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r">
                        {getProductSubjects(row.product).length > 0 ? (
                          <Select value={row.subject || ''} onValueChange={(v) => {
                            const updated = [...productRows]
                            updated[idx].subject = v
                            setProductRows(updated)
                          }}>
                            <SelectTrigger className="h-8 text-xs bg-white">
                              <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                            <SelectContent>
                              {getProductSubjects(row.product).map(subject => (
                                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-neutral-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r">
                        <Input
                          type="number"
                          className="h-8 text-xs bg-white"
                          value={row.strength || ''}
                          onChange={(e) => {
                            const updated = [...productRows]
                            const next = Number(e.target.value) || 0
                            updated[idx].strength = next
                            updated[idx].quantity = next
                            setProductRows(updated)
                          }}
                          placeholder="0"
                          min="0"
                        />
                      </td>
                      <td className="py-2 px-3 border-r">
                        <Select value={row.level || getDefaultLevel(row.product)} onValueChange={(v) => {
                          const updated = [...productRows]
                          updated[idx].level = v
                          setProductRows(updated)
                        }}>
                          <SelectTrigger className="h-8 text-xs bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getProductLevels(row.product).map(level => (
                              <SelectItem key={level} value={level}>{level}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {productRows.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            onClick={() => {
                              setProductRows(productRows.filter((_, i) => i !== idx))
                            }}
                          >
                            ×
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                    <td colSpan={8} className="px-3 py-3 text-right">
                      <span className="text-gray-700">Total:</span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-lg">
                      {productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0)}
                    </td>
                    <td className="px-3 py-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center border-t pt-4">
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline" 
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => window.print()}
              >
                Print
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm">SME Remarks:</Label>
                <Input
                  value={smeRemarks}
                  onChange={(e) => setSmeRemarks(e.target.value)}
                  placeholder="SME Remarks"
                  className="bg-white text-gray-900 w-48"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              {(isSeniorCoordinator || isAdmin) && (
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleSubmitToWarehouse}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit to Warehouse'}
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Show list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Pending DC List</h1>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading...</div>}
        {!loading && items.length === 0 && <div className="p-4">No pending DCs.</div>}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-gray-900">
                <th className="py-2 px-3 text-left">S.No</th>
                <th className="py-2 px-3 text-left">DC No</th>
                <th className="py-2 px-3 text-left">School Code</th>
                <th className="py-2 px-3 text-left">Customer Name</th>
                <th className="py-2 px-3 text-left">Customer Phone</th>
                <th className="py-2 px-3 text-left">Products</th>
                <th className="py-2 px-3 text-left">Qty</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d, idx) => (
                <tr key={d._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium">{getDCNumber(d)}</td>
                  <td className="py-2 px-3 font-medium text-blue-700">{getSchoolCode(d)}</td>
                  <td className="py-2 px-3 font-medium">
                    <button 
                      className="text-blue-600 hover:underline"
                      onClick={() => openDCForm(d)}
                    >
                      {d.customerName || d.saleId?.customerName || '-'}
                    </button>
                  </td>
                  <td className="py-2 px-3">{d.customerPhone || '-'}</td>
                  <td className="py-2 px-3">{getProductsSummary(d)}</td>
                  <td className="py-2 px-3">{d.requestedQuantity || '-'}</td>
                  <td className="py-2 px-3">
                    <div className="flex gap-2 justify-end items-center">
                      <Button 
                        size="sm" 
                        onClick={() => openDCForm(d)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Open
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
