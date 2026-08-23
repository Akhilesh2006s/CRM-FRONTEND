'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, FileText, Package } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useProducts } from '@/hooks/useProducts'
import { applyPaymentDivisorsToBreakdown } from '@/lib/dcPaymentDivisors'

type DC = {
  _id: string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  dcOrderId?: string | {
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
  employeeId?: string | {
    _id: string
    name?: string
    email?: string
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
  
  // Request DC Dialog state
  const [requestDCDialogOpen, setRequestDCDialogOpen] = useState(false)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
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
    property_number: '',
    floor: '',
    tower_block: '',
    nearby_landmark: '',
    area: '',
    city: '',
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
      const data = await apiRequest<DC[]>(`/dc?status=scheduled_for_later`)
      const dataArray = Array.isArray(data) ? data : []
      setItems(
        dataArray.map((dc) => {
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
      )
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
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
      
      const dcOrderId = typeof dc.dcOrderId === 'object' 
        ? dc.dcOrderId?._id 
        : dc.dcOrderId
      
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

      const gate = await getProgramInvoiceGate(
        dcOrderId ? String(dcOrderId) : null,
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
        // Delivery and Address fields - check pendingEdit first, then main fields
        property_number: dcOrder.pendingEdit?.property_number || dcOrder.property_number || '',
        floor: dcOrder.pendingEdit?.floor || dcOrder.floor || '',
        tower_block: dcOrder.pendingEdit?.tower_block || dcOrder.tower_block || '',
        nearby_landmark: dcOrder.pendingEdit?.nearby_landmark || dcOrder.nearby_landmark || '',
        area: dcOrder.pendingEdit?.area || dcOrder.area || '',
        city: dcOrder.pendingEdit?.city || dcOrder.city || '',
        pincode: dcOrder.pendingEdit?.pincode || dcOrder.pincode || '',
      }
      
      setRequestDCFormData(formData)
      
      // Load Term 2 products - prioritize DC's productDetails (has all details), then DcOrder products
      let term2Products: any[] = []
      
      // First try to get from full DC's productDetails (most accurate - has all product details)
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        const dcTerm2Products = fullDC.productDetails.filter((p: any) => (p.term || 'Term 1') === 'Term 2')
        if (dcTerm2Products.length > 0) {
          // Get unit prices from DcOrder products if available, otherwise use from productDetails
          term2Products = dcTerm2Products.map((p: any) => {
            // Try to match with DcOrder product to get unit_price
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
      
      // Fallback to DcOrder products if DC productDetails not available or no Term 2 products found
      if (term2Products.length === 0) {
        const dcOrderTerm2Products = (dcOrder.products || []).filter((p: any) => (p.term || 'Term 1') === 'Term 2')
        term2Products = dcOrderTerm2Products.map((p: any) => ({
          product_name: p.product_name || '',
          quantity: p.quantity || 0,
          unit_price: p.unit_price || 0,
          term: p.term || 'Term 2',
        }))
      }
      
      console.log('📦 Loaded Term 2 products for Request DC:', {
        fromDCProductDetails: fullDC.productDetails?.length || 0,
        term2ProductsCount: term2Products.length,
        products: term2Products
      })
      
      if (term2Products.length === 0) {
        console.warn('⚠️ No Term 2 products found for Request DC dialog')
        toast.warning('No Term 2 products found. Please ensure products are added with Term 2.')
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
      const dcOrderId = typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId._id : selectedDC.dcOrderId
      
      if (!dcOrderId) {
        toast.error('Cannot request DC: DC Order not found')
        return
      }

      // Convert product rows to productDetails format (only Term 2 products)
      const productDetails = requestDCProductRows
        .filter(row => (row.term || 'Term 1') === 'Term 2')
        .map(row => ({
          product: row.product_name,
          class: '1',
          category: requestDCFormData.school_type === 'Existing' ? 'Existing School' : 'New School',
          specs: 'Regular',
          subject: undefined,
          quantity: row.quantity,
          strength: row.quantity,
          level: 'L2',
          term: 'Term 2', // Ensure Term 2
        }))

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

      // Update DcOrder status to 'dc_requested' so it appears in Closed Sales page
      try {
        const updateResponse = await apiRequest(`/dc-orders/${dcOrderId}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'dc_requested',
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
  const groupedByTerm = useMemo(() => {
    return { term1: [] as DC[], term2: items }
  }, [items])

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    let filtered = items
    
    // Apply search query
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((d) => {
        const customerName = (d.customerName || d.saleId?.customerName || (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_name) || '').toLowerCase()
        const phone = (d.customerPhone || (typeof d.dcOrderId === 'object' && d.dcOrderId?.contact_mobile) || '').toLowerCase()
        const product = (d.product || d.saleId?.product || (typeof d.dcOrderId === 'object' && d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '')).toLowerCase()
        const status = (d.status || 'created').toLowerCase()
        const employeeName = (typeof d.employeeId === 'object' && d.employeeId?.name) ? d.employeeId.name.toLowerCase() : ''
        const schoolCode = (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_code) ? d.dcOrderId.school_code.toLowerCase() : ''
        
        return customerName.includes(query) || 
               phone.includes(query) || 
               product.includes(query) || 
               status.includes(query) ||
               employeeName.includes(query) ||
               schoolCode.includes(query)
      })
    }
    
    return filtered
  }, [items, searchQuery])

  const filteredTerm2 = useMemo(() => {
    let filtered = groupedByTerm.term2
    
    // Apply search query
    const query = searchQuery.trim().toLowerCase()
    if (query) {
      filtered = filtered.filter((d) => {
        const customerName = (d.customerName || d.saleId?.customerName || (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_name) || '').toLowerCase()
        const phone = (d.customerPhone || (typeof d.dcOrderId === 'object' && d.dcOrderId?.contact_mobile) || '').toLowerCase()
        const product = (d.product || d.saleId?.product || (typeof d.dcOrderId === 'object' && d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '')).toLowerCase()
        const employeeName = (typeof d.employeeId === 'object' && d.employeeId?.name) ? d.employeeId.name.toLowerCase() : ''
        const schoolCode = (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_code) ? d.dcOrderId.school_code.toLowerCase() : ''
        return customerName.includes(query) || phone.includes(query) || product.includes(query) || employeeName.includes(query) || schoolCode.includes(query)
      })
    }
    
    return filtered
  }, [groupedByTerm.term2, searchQuery])

  const renderDCTable = (dcs: DC[], term: string) => {
    if (dcs.length === 0) return null

    return (
      <Card className="p-6 bg-white shadow-lg border border-neutral-200/60">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">{term}</h2>
          <p className="text-sm text-gray-500 mt-1">Total: {dcs.length} DC(s)</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">S.No</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dcs.map((d, idx) => {
                const customerName = d.customerName || d.saleId?.customerName || (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_name) || 'Unknown Client'
                const phone = d.customerPhone || (typeof d.dcOrderId === 'object' && d.dcOrderId?.contact_mobile) || '-'
                
                // Show rows on this Term-Wise DC only (Close Lead classification).
                let product = '-'
                let productDetails: any[] = []
                
                if (d.productDetails && Array.isArray(d.productDetails) && d.productDetails.length > 0) {
                  const routed = d.productDetails.some((p: any) => p.closeLeadDestination)
                    ? d.productDetails.filter((p: any) => p.closeLeadDestination === 'TERM_WISE_DC')
                    : d.productDetails
                  if (routed.length > 0) {
                    productDetails = routed
                    product = routed.map((p: any) => {
                      const name = p.product || p.productName || ''
                      const qty = p.quantity || p.strength || 0
                      const price = p.unit_price || p.price || 0
                      return `${name}${qty ? ` (Qty: ${qty})` : ''}${price ? ` @ ₹${price}` : ''}`
                    }).filter(Boolean).join(', ')
                  }
                }
                
                if (product === '-') {
                  product = d.product || d.saleId?.product || '-'
                }
                
                const status = d.status || 'created'
                const createdDate = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'
                const schoolCode = (typeof d.dcOrderId === 'object' && d.dcOrderId?.school_code) 
                  ? d.dcOrderId.school_code 
                  : '-'
                const employeeName = typeof d.employeeId === 'object' && d.employeeId?.name
                  ? d.employeeId.name
                  : '-'
                
                return (
                  <TableRow key={d._id} className="hover:bg-neutral-50">
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-medium text-blue-700">{schoolCode}</TableCell>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell>{employeeName}</TableCell>
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
                    <TableCell className="text-center">
                      <Button 
                        size="sm" 
                        onClick={() => openRequestDCDialog(d)}
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Request DC
                      </Button>
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
            View all DCs with Term 2 products
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <Input
                placeholder="Search by client name, phone, product, employee, school code, or status..."
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
          <p className="text-neutral-500">Loading DCs...</p>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-neutral-500">No DCs found.</p>
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
              Product details and costs for this DC
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

            {/* Delivery and Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Delivery and Address</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Property Number *</Label>
                  <Input
                    value={requestDCFormData.property_number}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter property number"
                  />
                </div>
                <div>
                  <Label>Floor *</Label>
                  <Input
                    value={requestDCFormData.floor}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter floor"
                  />
                </div>
                <div>
                  <Label>Tower/Block (Optional)</Label>
                  <Input
                    value={requestDCFormData.tower_block}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter tower/block"
                  />
                </div>
                <div>
                  <Label>Nearby Landmark (Optional)</Label>
                  <Input
                    value={requestDCFormData.nearby_landmark}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter nearby landmark"
                  />
                </div>
                <div>
                  <Label>Area *</Label>
                  <Input
                    value={requestDCFormData.area}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter area"
                  />
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    value={requestDCFormData.city}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <Label>Pincode *</Label>
                  <Input
                    value={requestDCFormData.pincode}
                    readOnly
                    className="bg-neutral-50"
                    placeholder="Enter pincode"
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

