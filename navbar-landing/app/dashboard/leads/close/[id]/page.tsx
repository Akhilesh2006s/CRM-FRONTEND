'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, API_BASE_URL } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Package, CheckCircle2, Upload, X, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useProducts } from '@/hooks/useProducts'

type Lead = {
  _id: string
  school_name?: string
  contact_person?: string
  contact_mobile?: string
  contact_person2?: string
  contact_mobile2?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  strength?: number
  branches?: number
  decision_maker?: string
  products?: any[]
  priority?: string
  remarks?: string
  school_type?: string
}

export default function CloseLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    contact_person2: '',
    contact_mobile2: '',
    delivery_date: '',
    year: '2025-26',
  })
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productDetails, setProductDetails] = useState<Array<{
    id: string
    product: string
    class: string // Single class for each row
    fromClass?: string // Range start (only in parent row)
    toClass?: string // Range end (only in parent row)
    category: string
    quantity: number
    strength: number
    price: number
    total: number
    level: string
    specs: string
    subject?: string // Subject name (if product has subjects)
    isParentRow?: boolean // Flag to identify parent rows that generate child rows
    sameRateForAllClasses?: boolean // Flag to apply same rate to all classes for this spec/level
    selectedSubjects?: string[] // Selected subjects for parent row (multi-select)
    selectedSpecs?: string[] // Selected specs for parent row (multi-select)
    selectedCategories?: string[] // Selected categories for parent row (multi-select)
    selectedDeliverables?: string[] // Selected deliverables for parent row (multi-select)
    term?: string
  }>>([])
  const [poPhoto, setPoPhoto] = useState<File | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState<string>('')
  const [uploadingPO, setUploadingPO] = useState(false)
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splitPreview, setSplitPreview] = useState<{
    term1: { productName: string; strength: number }[]
    term2: { productName: string; strength: number }[]
  } | null>(null)
  const [pendingSubmissionContext, setPendingSubmissionContext] = useState<{
    dcProductDetails: any[]
    totalQuantity: number
  } | null>(null)
  
  const { productNames: availableProducts, getProductLevels, getDefaultLevel, getProductSpecs, getProductSubjects, hasProductSubjects, getProductCategories, hasProductCategories, getProductId } = useProducts()
  const [deliverablesByProduct, setDeliverablesByProduct] = useState<Record<string, string[]>>({})
  const availableClasses = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  const defaultCategories = ['New Students', 'Existing Students', 'Both']
  const availableDCCategories = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

  useEffect(() => {
    if (leadId) {
      loadLead()
    }
  }, [leadId])

  const loadLead = async () => {
    setLoading(true)
    try {
      // Try to get from dc-orders first
      let leadData: any = null
      try {
        leadData = await apiRequest<any>(`/dc-orders/${leadId}`)
      } catch {
        // If not found, try leads API
        leadData = await apiRequest<any>(`/leads/${leadId}`)
      }
      
      if (leadData) {
        setLead(leadData)
        // Pre-fill form with lead data
        // Only use estimated_delivery_date, NOT follow_up_date
        const deliveryDate = leadData.estimated_delivery_date 
          ? new Date(leadData.estimated_delivery_date).toISOString().split('T')[0]
          : ''
        setForm({
          contact_person2: leadData.decision_maker || leadData.contact_person2 || leadData.contact_person || '',
          contact_mobile2: leadData.email || leadData.contact_mobile2 || '',
                delivery_date: deliveryDate, // Do NOT use follow_up_date here
                year: '2025-26',
        })
        
        // Pre-fill selected products and product details - normalize product names to match availableProducts
        // Only set products that exactly match availableProducts
        let validProducts: string[] = []
        let initialProductDetails: Array<{
          id: string
          product: string
          fromClass: string
          toClass: string
          category: string
          quantity: number
          strength: number
          price: number
          total: number
          level: string
          specs: string
        }> = []
        
        if (leadData.products && Array.isArray(leadData.products) && leadData.products.length > 0) {
          validProducts = leadData.products
            .map((p: any) => {
              const name = p.product_name || p.product || p
              if (typeof name === 'string') {
                const normalized = name.trim()
                // Map variations to exact names
                const lower = normalized.toLowerCase()
                if (lower === 'mathlab' || lower === 'math lab' || lower === 'maths lab') {
                  return 'Maths lab'
                }
                if (lower === 'codechamp' || lower === 'code champ') {
                  return 'Codechamp'
                }
                if (lower === 'vedicmath' || lower === 'vedic math') {
                  return 'Vedic Maths'
                }
                if (lower === 'financial literacy' || lower === 'financialliteracy') {
                  return 'Financial literacy'
                }
                if (lower === 'brain bytes' || lower === 'brainbytes') {
                  return 'Brain bytes'
                }
                if (lower === 'spelling bee' || lower === 'spellingbee') {
                  return 'Spelling bee'
                }
                if (lower === 'skill pro' || lower === 'skillpro') {
                  return 'Skill pro'
                }
                if (lower === 'abacus') {
                  return 'Abacus'
                }
                if (lower === 'eel' || lower === 'eell') {
                  return 'EEL'
                }
                if (lower === 'iit') {
                  return 'IIT'
                }
                return normalized
              }
              return null
            })
            .filter((name: string | null): name is string => {
              return name !== null && availableProducts.includes(name)
            })
        } else if (typeof leadData.products === 'string' && leadData.products.trim()) {
          validProducts = leadData.products
            .split(',')
            .map((p: string) => {
              const normalized = p.trim()
              // Normalize product names
              const lower = normalized.toLowerCase()
              if (lower === 'mathlab' || lower === 'math lab' || lower === 'maths lab') {
                return 'Maths lab'
              }
              if (lower === 'codechamp' || lower === 'code champ') {
                return 'Codechamp'
              }
              if (lower === 'vedicmath' || lower === 'vedic math') {
                return 'Vedic Maths'
              }
              if (lower === 'financial literacy' || lower === 'financialliteracy') {
                return 'Financial literacy'
              }
              if (lower === 'brain bytes' || lower === 'brainbytes') {
                return 'Brain bytes'
              }
              if (lower === 'spelling bee' || lower === 'spellingbee') {
                return 'Spelling bee'
              }
              if (lower === 'skill pro' || lower === 'skillpro') {
                return 'Skill pro'
              }
              if (lower === 'abacus') {
                return 'Abacus'
              }
              if (lower === 'eel' || lower === 'eell') {
                return 'EEL'
              }
              if (lower === 'iit') {
                return 'IIT'
              }
              return normalized
            })
            .filter((name: string) => availableProducts.includes(name))
        }
        
        // Only set products if we have valid matches
        setSelectedProducts(validProducts)
        
          // Initialize product details for valid products - create parent rows
        if (validProducts.length > 0) {
          const parentRows = validProducts.map((product, productIdx) => {
            const productData = leadData.products?.find((p: any) => 
              (p.product_name || p.product || p) === product
            )
            // Load saved quantity and unit_price if available
            const savedQuantity = productData?.quantity || 0
            const savedUnitPrice = productData?.unit_price || 0
            
            return {
              id: Date.now().toString() + productIdx,
              product: product,
              class: '1',
              fromClass: productData?.fromClass || productData?.class || '1',
              toClass: productData?.toClass || '10',
              category: hasProductCategories(product)
                ? (getProductCategories(product)[0] || '')
                : (leadData.school_type === 'Existing' ? 'Existing Students' : 'New Students'),
              quantity: savedQuantity || 1,
              strength: savedQuantity || 0, // Use saved quantity as default strength
              price: savedUnitPrice || 0, // Use saved unit_price as default price
              total: (savedQuantity || 0) * (savedUnitPrice || 0),
              level: productData?.level || getDefaultLevel(product),
              specs: 'Regular',
              isParentRow: true,
              sameRateForAllClasses: false,
              selectedSubjects: [],
              selectedSpecs: getProductSpecs(product),
              selectedDeliverables: productData?.deliverables || [],
              selectedCategories: hasProductCategories(product) 
                ? getProductCategories(product) 
                : undefined,
              term: productData?.term || 'Term 1',
            }
          })
          setProductDetails(parentRows)
          
          // Auto-generate rows for each parent after a short delay
          // Pass saved quantity and unit_price to be used as defaults
          setTimeout(() => {
            parentRows.forEach(parent => {
              generateRowsFromRange(parent.id, parent.fromClass || '1', parent.toClass || '10', parent.strength, parent.price)
            })
          }, 100)
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load lead')
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  // Get products that were selected when the lead was created (from "Products Interested")
  const getLeadProducts = (): string[] => {
    if (!lead?.products) {
      return []
    }
    
    let productNames: string[] = []
    
    // Handle array format
    if (Array.isArray(lead.products) && lead.products.length > 0) {
      productNames = lead.products.map((p: any) => {
        const name = p.product_name || p.product || p
        return typeof name === 'string' ? name.trim() : null
      }).filter((name: string | null): name is string => name !== null)
    } 
    // Handle string format (comma-separated)
    else if (typeof lead.products === 'string' && lead.products.trim()) {
      productNames = lead.products.split(',').map((p: string) => p.trim()).filter(Boolean)
    }
    
    if (productNames.length === 0) {
      return []
    }
    
    // Normalize product names to match availableProducts
    return productNames
      .map((name: string) => {
        const normalized = name.trim()
        // Map variations to exact names (same normalization as in loadLead)
        const lower = normalized.toLowerCase()
        if (lower === 'mathlab' || lower === 'math lab' || lower === 'maths lab') {
          return 'Maths lab'
        }
        if (lower === 'codechamp' || lower === 'code champ') {
          return 'Codechamp'
        }
        if (lower === 'vedicmath' || lower === 'vedic math') {
          return 'Vedic Maths'
        }
        if (lower === 'financial literacy' || lower === 'financialliteracy') {
          return 'Financial literacy'
        }
        if (lower === 'brain bytes' || lower === 'brainbytes') {
          return 'Brain bytes'
        }
        if (lower === 'spelling bee' || lower === 'spellingbee') {
          return 'Spelling bee'
        }
        if (lower === 'skill pro' || lower === 'skillpro') {
          return 'Skill pro'
        }
        if (lower === 'abacus') {
          return 'Abacus'
        }
        if (lower === 'eel' || lower === 'eell') {
          return 'EEL'
        }
        if (lower === 'iit') {
          return 'IIT'
        }
        return normalized
      })
      .filter((name: string) => {
        return name !== null && availableProducts.includes(name)
      })
  }

  // Fetch deliverables for parent-row products when Product Configuration is shown
  const parentProductNames = productDetails.filter(pd => pd.isParentRow).map(pd => pd.product)
  useEffect(() => {
    parentProductNames.forEach(async (productName) => {
      const productId = getProductId(productName)
      if (!productId) return
      try {
        const items = await apiRequest<Array<{ deliverableName: string }>>(`/deliverables/by-product/${productId}`)
        const names = Array.isArray(items) ? items.map(d => d.deliverableName) : []
        setDeliverablesByProduct(prev => ({ ...prev, [productName]: names }))
      } catch {
        setDeliverablesByProduct(prev => ({ ...prev, [productName]: [] }))
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentProductNames.join(',')])

  // Show all available products from database
  const filteredProducts = availableProducts

  const addProductWithSpec = (product: string, spec: string) => {
    // Add product to selected products
    if (!selectedProducts.includes(product)) {
    setSelectedProducts([...selectedProducts, product])
    }
    
    // Create only ONE initial row (parent row) with From/To fields - no pre-selections
    const parentId = Date.now().toString() + Math.random().toString()
    const newRow = {
      id: parentId,
      product: product,
      class: '0', // Default, will be replaced when range is set
      fromClass: '0',
      toClass: '0',
        category: hasProductCategories(product)
          ? (getProductCategories(product)[0] || '')
          : (lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students'),
      quantity: 1,
      strength: 0,
      price: 0,
      total: 0,
      level: getDefaultLevel(product),
      specs: 'Regular', // Default, will be replaced when rows are generated
      isParentRow: true, // Mark as parent row
      sameRateForAllClasses: false, // Default: not enabled
      selectedSubjects: [], // Nothing pre-selected - user must select
      selectedSpecs: [], // Nothing pre-selected - user must select
      selectedDeliverables: [], // Nothing pre-selected - user must select
      selectedCategories: hasProductCategories(product) 
        ? [] 
        : undefined,
    }
    
    setProductDetails([...productDetails, newRow])
    
    // Do NOT auto-generate rows - user must set class range (From/To) and select specs/subjects first
  }
  
  // Function to generate rows when From/To class range changes
  // Optional defaultStrength and defaultPrice can be passed to populate saved values
  const generateRowsFromRange = (parentId: string, fromClass: string, toClass: string, defaultStrength: number = 0, defaultPrice: number = 0) => {
    setProductDetails(currentDetails => {
      const parentRow = currentDetails.find(p => p.id === parentId)
      if (!parentRow || !parentRow.isParentRow) return currentDetails
      
      const from = parseInt(fromClass, 10) || 0
      const to = parseInt(toClass, 10) || 0
      
      // When From=0 and To=0, or From>To: invalid range - don't generate child rows
      if ((from === 0 && to === 0) || from > to) {
        const otherParentRows = currentDetails.filter(p => p.isParentRow && p.id !== parentId)
        const otherChildRows = currentDetails.filter(p => !p.isParentRow && !p.id.startsWith(parentId + '_'))
        const updatedParent = { ...parentRow, fromClass, toClass }
        return [...otherParentRows, updatedParent, ...otherChildRows]
      }
      const selectedSpecs = parentRow.selectedSpecs || []
      const specsToUse = selectedSpecs.length > 0 ? selectedSpecs : ['Regular']
      const selectedSubjects = parentRow.selectedSubjects || []
      const hasSubjects = hasProductSubjects(parentRow.product) && selectedSubjects.length > 0
      const subjectsToUse = hasSubjects ? selectedSubjects : [undefined] // Use undefined if no subjects
      const selectedCategories = parentRow.selectedCategories || []
      // Use product-specific categories if available, otherwise use default student categories
      const categoriesToUse = hasProductCategories(parentRow.product)
        ? (selectedCategories.length > 0 ? selectedCategories : getProductCategories(parentRow.product))
        : [lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students']
      
      // Remove all child rows of this parent and other parent rows
      const otherParentRows = currentDetails.filter(p => p.isParentRow && p.id !== parentId)
      const otherChildRows = currentDetails.filter(p => !p.isParentRow && !p.id.startsWith(parentId + '_'))
      
      // Generate rows: for each class in range, create a row for each spec × category combination
      const newRows: Array<typeof parentRow> = []
      let rowIdx = 0
      for (let classNum = from; classNum <= to; classNum++) {
        specsToUse.forEach((spec) => {
          categoriesToUse.forEach((category) => {
            // Create one row per class × spec × category combination
            // Combine all selected subjects into a single string or use first subject
            const subjectDisplay = hasSubjects && selectedSubjects.length > 0 
              ? selectedSubjects.join(', ') 
              : undefined
            newRows.push({
              id: parentId + '_' + classNum + '_' + rowIdx++,
              product: parentRow.product,
              class: classNum.toString(),
              category: category,
              quantity: defaultStrength || 1,
              strength: defaultStrength || 0, // Use default strength if provided
              price: defaultPrice || 0, // Use default price if provided
              total: (defaultStrength || 0) * (defaultPrice || 0),
              level: parentRow.level,
              specs: spec,
              subject: subjectDisplay, // Combined subjects or undefined
              isParentRow: false,
              sameRateForAllClasses: false,
            })
          })
        })
      }
      
      // Update parent row and combine with other rows
      const updatedParent = { ...parentRow, fromClass, toClass }
      return [...otherParentRows, updatedParent, ...otherChildRows, ...newRows]
    })
  }
  
  const updateProductDetail = (id: string, field: string, value: any) => {
    setProductDetails(currentDetails => {
      const rowToUpdate = currentDetails.find(p => p.id === id)
      if (!rowToUpdate) return currentDetails
      
      const updated = { ...rowToUpdate, [field]: value }
      
      // Auto-calculate total when price or strength changes (strength * price)
      if (field === 'price' || field === 'strength') {
        updated.total = (Number(updated.strength) || 0) * (Number(updated.price) || 0)
        
        // If this is a child row and sameRateForAllClasses is enabled for this product/spec/level combo
        // Apply to both PRICE and STRENGTH for all classes
        if (!rowToUpdate.isParentRow && (field === 'price' || field === 'strength')) {
          const parentRow = currentDetails.find(p => 
            p.isParentRow && 
            p.product === rowToUpdate.product &&
            p.id === rowToUpdate.id.split('_')[0]
          )
          
          if (parentRow?.sameRateForAllClasses) {
            // Update price or strength for all rows with same product, class, and level
            // This applies the same value across all specs for that class
            return currentDetails.map(p => {
              if (!p.isParentRow && 
                  p.product === updated.product && 
                  p.class === updated.class && 
                  p.level === updated.level) {
                const newStrength = field === 'strength' ? value : p.strength
                const newPrice = field === 'price' ? value : p.price
                return {
                  ...p,
                  strength: newStrength, // Apply same strength to all specs of this class
                  price: newPrice, // Apply same price to all specs of this class
                  total: (Number(newStrength) || 0) * (Number(newPrice) || 0) // Recalculate total
                }
              }
              if (p.id === id) return updated
              return p
            })
          }
        }
      }
      
      // When From changes: if To < From, auto-set To = From
      if (rowToUpdate.isParentRow && field === 'fromClass') {
        const newFrom = parseInt(String(value), 10)
        const currentTo = parseInt(String(updated.toClass || '0'), 10)
        if (!isNaN(newFrom) && !isNaN(currentTo) && currentTo < newFrom) {
          updated.toClass = String(newFrom)
        }
      }
      
      // If From/To class or selectedSubjects or selectedSpecs or selectedCategories changes on a parent row, regenerate all child rows
      if (rowToUpdate.isParentRow && (field === 'fromClass' || field === 'toClass' || field === 'selectedSubjects' || field === 'selectedSpecs' || field === 'selectedCategories')) {
        setTimeout(() => {
          generateRowsFromRange(id, updated.fromClass || '0', updated.toClass || '0')
        }, 0)
      }
      
      // Update the specific row
      return currentDetails.map(p => p.id === id ? updated : p)
    })
  }
  
  const removeProductDetail = (id: string) => {
    // Check if it's a parent row or child row
    const rowToRemove = productDetails.find(p => p.id === id)
    
    if (rowToRemove?.isParentRow) {
      // Remove parent and all its child rows
      setProductDetails(productDetails.filter(p => 
        p.id !== id && !p.id.startsWith(id + '_')
      ))
      // Remove from selected products
      setSelectedProducts(selectedProducts.filter(p => p !== rowToRemove.product))
    } else {
      // Remove only this specific child row
    setProductDetails(productDetails.filter(p => p.id !== id))
    // Update selectedProducts to match remaining productDetails
    const remainingProducts = productDetails
      .filter(p => p.id !== id)
      .map(p => p.product)
        .filter((p, idx, arr) => arr.indexOf(p) === idx) // Remove duplicates
    setSelectedProducts(remainingProducts)
    }
  }
  
  const handlePOPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type - only allow PDFs
    const isValidType = file.type === 'application/pdf'
    if (!isValidType) {
      toast.error('Please upload a PDF file only')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    
    setPoPhoto(file)
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
      setPoPhotoUrl(data.poPhotoUrl || data.url || '')
      toast.success('PO document uploaded successfully')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload PO document')
      setPoPhoto(null)
    } finally {
      setUploadingPO(false)
    }
  }

  const handleTurnToClient = async () => {
    if (!lead) return
    
    // Filter out parent rows for validation
    const actualProductDetails = productDetails.filter(pd => !pd.isParentRow)
    
    if (actualProductDetails.length === 0) {
      toast.error('Please add at least one product and set class range to generate rows')
      return
    }
    
    // Validate class range for all parent rows - must have valid From/To (not 0,0 and From <= To)
    const parentRows = productDetails.filter(pd => pd.isParentRow)
    const invalidClassRange = parentRows.some(p => {
      const from = parseInt(p.fromClass ?? '0', 10)
      const to = parseInt(p.toClass ?? '0', 10)
      return from === 0 || to === 0 || from > to
    })
    if (invalidClassRange) {
      toast.error('Please select valid class range.')
      return
    }
    
    // Validate deliverables: if product has deliverables, at least 1 must be selected
    const productsWithDeliverables = parentRows.filter(p => (deliverablesByProduct[p.product] || []).length > 0)
    const invalidDeliverables = productsWithDeliverables.some(p => {
      const selected = p.selectedDeliverables || []
      return selected.length === 0
    })
    if (invalidDeliverables) {
      toast.error('Please select at least one deliverable for products that have deliverables configured.')
      return
    }
    
    // Validate product details (excluding parent rows)
    // Check for product, strength (quantity), and price (unit price)
    const invalidProducts = actualProductDetails.filter(p => 
      !p.product || 
      !p.strength || 
      p.strength <= 0 || 
      !p.price || 
      p.price <= 0
    )
    if (invalidProducts.length > 0) {
      toast.error('Please fill in Product, Quantity (Strength), and Unit Price for all products. Both Quantity and Unit Price are mandatory and must be greater than 0.')
      return
    }
    
    // Validate delivery date is required
    if (!form.delivery_date || form.delivery_date.trim() === '') {
      toast.error('Delivery date is required')
      return
    }
    
    // Validate PO document is required
    if (!poPhotoUrl || poPhotoUrl.trim() === '') {
      toast.error('PO document is required. Please upload a PDF file.')
      return
    }
    
    setSubmitting(true)
    setError(null)
    
    try {
      // Always use current user's ID for the DC - the employee converting the lead owns the client
      if (!currentUser?._id) {
        toast.error('User not found. Please login again.')
        setSubmitting(false)
        return
      }
      
      const assignedEmployeeId = currentUser._id
      
      // Determine if this is a DC Order or Lead based on what was loaded
      // The lead state was set from loadLead which tries dc-orders first, then leads
      const isDcOrder = lead && lead.dc_code !== undefined
      
      // Prepare update payload
      const updatePayload: any = {
        school_name: lead?.school_name || undefined,
        contact_person: lead?.contact_person || undefined,
        contact_mobile: lead?.contact_mobile || undefined,
        email: lead?.email || undefined,
        contact_person2: form.contact_person2 || undefined, // Decision Maker name
        contact_mobile2: form.contact_mobile2 || undefined, // Decision Maker email
        decision_maker: form.contact_person2 || undefined, // Also set decision_maker field
        estimated_delivery_date: form.delivery_date ? new Date(form.delivery_date).toISOString() : undefined,
        assigned_to: assignedEmployeeId,
        products: actualProductDetails.map(p => {
          const parentRow = productDetails.find(parent => parent.isParentRow && p.id.startsWith(parent.id + '_'))
          const deliverables = parentRow?.selectedDeliverables || []
          return {
            product_name: p.product,
            quantity: p.strength, // Use strength as quantity
            unit_price: p.price,
            deliverables,
          }
        }),
      }
      
      // Update the lead/dc-order with appropriate status
      console.log('🔄 Updating with payload:', {
        leadId,
        type: isDcOrder ? 'DcOrder' : 'Lead',
        assigned_to: updatePayload.assigned_to,
        hasProducts: !!updatePayload.products
      });
      
      try {
        if (isDcOrder) {
          // DC Order status enum: 'saved', 'pending', 'in_transit', 'completed', 'hold', 'dc_requested', 'dc_accepted', 'dc_approved', 'dc_sent_to_senior'
          // Don't set status to 'Closed' - use 'completed' or 'saved' instead
          updatePayload.status = 'completed' // Use 'completed' for DC Orders when closing
          
          const updated = await apiRequest(`/dc-orders/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          })
          console.log('✅ DcOrder updated successfully:', {
            id: updated._id,
            status: updated.status,
            assigned_to: updated.assigned_to
          });
          
          // Also create/update Lead record with Closed status for reporting
          try {
            // Try to find existing lead by school name and mobile
            const searchResponse = await apiRequest<any>(`/leads?schoolName=${encodeURIComponent(lead?.school_name || '')}&contactMobile=${lead?.contact_mobile || ''}`)
            const allLeads = Array.isArray(searchResponse) ? searchResponse : (searchResponse?.data || [])
            const existingLead = allLeads.find((l: any) => 
              l.school_name === lead?.school_name && 
              l.contact_mobile === lead?.contact_mobile
            )
            
            if (existingLead) {
              // Update existing lead to Closed
              await apiRequest(`/leads/${existingLead._id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'Closed' }),
              })
              console.log('✅ Lead record updated to Closed for reporting')
            } else {
              // Create new lead record for reporting
              await apiRequest('/leads/create', {
                method: 'POST',
                body: JSON.stringify({
                  school_name: lead?.school_name || updated.school_name,
                  contact_person: lead?.contact_person || updated.contact_person,
                  contact_mobile: lead?.contact_mobile || updated.contact_mobile,
                  zone: lead?.zone || updated.zone,
                  location: lead?.location || updated.location,
                  priority: lead?.priority || updated.priority || 'Hot',
                  status: 'Closed',
                  createdBy: assignedEmployeeId,
                }),
              })
              console.log('✅ Lead record created with Closed status for reporting')
            }
          } catch (leadUpdateErr: any) {
            console.warn('⚠️ Could not update/create Lead record for reporting:', leadUpdateErr?.message)
            // Don't fail the whole operation - DC Order update succeeded
          }
        } else {
          // Lead status enum: 'Pending', 'Processing', 'Saved', 'Closed'
          updatePayload.status = 'Closed' // Use 'Closed' for Leads
          
          const updated = await apiRequest(`/leads/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload),
          })
          console.log('✅ Lead updated successfully:', {
            id: updated._id,
            status: updated.status
          });
        }
      } catch (err: any) {
        console.error('❌ Update failed:', err);
        throw err; // Re-throw to be caught by outer catch
      }
      
      // Prepare product details for DC (exclude parent rows)
      const dcProductDetails = actualProductDetails.map(p => {
        const parentRow = productDetails.find(parent => parent.isParentRow && p.id.startsWith(parent.id + '_'))
        const deliverables = parentRow?.selectedDeliverables || []
        const levelValue = p.level || getDefaultLevel(p.product)
        const levelKey = (levelValue || '').toString().toLowerCase().replace(/\s+/g, '')
        let termFromLevel: string | null = null
        if (levelKey.startsWith('term2')) termFromLevel = 'Term 2'
        else if (levelKey.startsWith('term1')) termFromLevel = 'Term 1'
        else if (levelKey.includes('both')) termFromLevel = 'Both'
        return {
          product: p.product,
          class: p.class || '1', // Use actual class value
          category: p.category || (() => {
            // Use product-specific categories if available, otherwise use school-type based category
            if (hasProductCategories(p.product)) {
              const productCats = getProductCategories(p.product)
              return productCats[0] || (lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students')
            }
            return lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students'
          })(),
          quantity: Number(p.quantity) || 0, // Keep for backend compatibility
          strength: Number(p.strength) || 0,
          price: Number(p.price) || 0,
          total: Number(p.total) || (Number(p.strength) || 0) * (Number(p.price) || 0),
          level: levelValue,
          specs: p.specs || 'Regular', // Include specs
          subject: p.subject || undefined, // Include subject if present
          deliverables,
          term: termFromLevel || (p as any).term || (parentRow as any)?.term || 'Term 1',
        }
      })
      
      const totalQuantity = dcProductDetails.reduce((sum, p) => sum + (p.strength || 0), 0)
      
      await proceedWithSubmission(dcProductDetails, totalQuantity)
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client')
      toast.error(err?.message || 'Failed to convert lead to client')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-neutral-500">Loading lead details...</div>
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="space-y-6">
        <div className="p-8 text-center text-red-500">{error}</div>
        <Link href="/dashboard/leads/followup">
          <Button variant="outline">Back to Followup Leads</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads/followup">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Close Lead</h1>
          <p className="text-sm text-neutral-600 mt-1">Fill in the details to close this lead and convert to client</p>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-6">
          {/* School Name */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">School Name</Label>
            <Input
              value={lead?.school_name || ''}
              onChange={(e) => setLead(lead ? { ...lead, school_name: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Person 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Person 1</Label>
            <Input
              value={lead?.contact_person || ''}
              onChange={(e) => setLead(lead ? { ...lead, contact_person: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Email 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Email 1</Label>
            <Input
              type="email"
              value={lead?.email || ''}
              onChange={(e) => setLead(lead ? { ...lead, email: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Mob 1 */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Mob 1</Label>
            <Input
              value={lead?.contact_mobile || ''}
              onChange={(e) => setLead(lead ? { ...lead, contact_mobile: e.target.value } : null)}
              className="mt-1"
            />
          </div>

          {/* Decision Maker */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Decision Maker</Label>
            <Input
              value={form.contact_person2}
              onChange={(e) => setForm({ ...form, contact_person2: e.target.value })}
              placeholder="Enter decision maker name"
              className="mt-1"
            />
          </div>

          {/* Email */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Email</Label>
            <Input
              type="email"
              value={form.contact_mobile2}
              onChange={(e) => setForm({ ...form, contact_mobile2: e.target.value })}
              placeholder="Enter decision maker email"
              className="mt-1"
            />
          </div>

          {/* Delivery Date */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Delivery Date *</Label>
            <Input
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              className="mt-1"
              required
            />
          </div>

          {/* Select Year */}
          <div>
            <Label className="text-sm font-semibold text-neutral-700">Select Year</Label>
            <Select value={form.year} onValueChange={(v) => setForm({ ...form, year: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024-25">2024-25</SelectItem>
                <SelectItem value="2025-26">2025-26</SelectItem>
                <SelectItem value="2026-27">2026-27</SelectItem>
                <SelectItem value="2027-28">2027-28</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PO Document Upload */}
          <div className="pt-4 border-t">
            <Label className="text-sm font-semibold text-neutral-700">PO Document *</Label>
            <div className="mt-1 space-y-2">
              {poPhotoUrl ? (
                <div className="flex items-center gap-2">
                  <div className="h-20 w-20 flex items-center justify-center bg-red-100 rounded border">
                    <span className="text-xs font-semibold text-red-700">PDF</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href={poPhotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View Document
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPoPhotoUrl('')
                        setPoPhoto(null)
                      }}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePOPhotoUpload}
                    disabled={uploadingPO}
                    className="mt-1"
                    required
                  />
                  <p className="text-xs text-neutral-500 mt-1">Accepted: PDF only (max 5MB)</p>
                  {uploadingPO && <p className="text-xs text-neutral-500 mt-1">Uploading...</p>}
                </div>
              )}
            </div>
          </div>

          {/* Add Products Button */}
          <div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setProductDialogOpen(true)}
            >
              <Package className="w-4 h-4 mr-2" />
              ADD PRODUCTS {productDetails.filter(pd => !pd.isParentRow).length > 0 && `(${productDetails.filter(pd => !pd.isParentRow).length})`}
            </Button>
          </div>


          {/* Turn Lead to Client Button */}
          <div className="pt-4 border-t">
            <Button
              onClick={handleTurnToClient}
              disabled={submitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Turn Lead to Client
                </span>
              )}
            </Button>
            {error && (
              <p className="text-sm text-red-600 mt-2 text-center">{error}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Product Selection Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products & Details</DialogTitle>
            <DialogDescription>Select products and enter their details</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Add Products</Label>
              <p className="text-xs text-neutral-500 mb-2">
                {filteredProducts.length > 0 
                  ? `All products from database (${filteredProducts.length} available)`
                  : 'No products available in database'}
              </p>
              {filteredProducts.length === 0 ? (
                <div className="p-4 border rounded bg-yellow-50 text-yellow-800 text-sm">
                  No products available in the database. Please contact admin to add products.
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded p-3">
                  {filteredProducts.map((product) => {
                  const productSpecs = getProductSpecs(product)
                  const hasSpecs = productSpecs.length > 0
                  const specCount = hasSpecs ? productSpecs.length : 1
                  
                  return (
                    <div key={product} className="flex items-center justify-between p-2 border rounded hover:bg-neutral-50">
                      <div className="flex items-center space-x-2 flex-1">
                        <span className="text-sm font-medium">{product}</span>
                        {hasSpecs && (
                          <span className="text-xs text-neutral-500">({specCount} specs - {productSpecs.join(', ')})</span>
                        )}
                      </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                        onClick={() => addProductWithSpec(product, 'Regular')}
                              className="text-xs"
                            >
                              <PlusCircle className="w-3 h-3 mr-1" />
                        Add Product
                            </Button>
                    </div>
                  )
                })}
                </div>
              )}
            </div>

            {/* Product Range Configuration */}
            {productDetails.filter(pd => pd.isParentRow).length > 0 && (
              <div className="mb-4">
                <Label className="text-sm font-semibold mb-2 block">Set Class Range for Products</Label>
                <div className="space-y-3 border rounded p-3">
                  {productDetails
                    .filter(pd => pd.isParentRow)
                    .map((pd) => {
                      const productSubjects = getProductSubjects(pd.product)
                      const hasSubjects = hasProductSubjects(pd.product)
                      const selectedSubjects = pd.selectedSubjects || []
                      const productSpecs = getProductSpecs(pd.product)
                      const selectedSpecs = pd.selectedSpecs || productSpecs
                      const productCategories = hasProductCategories(pd.product) 
                        ? getProductCategories(pd.product) 
                        : []
                      const selectedCategories = pd.selectedCategories || (hasProductCategories(pd.product) ? productCategories : undefined)
                      
                      return (
                        <div key={pd.id} className="space-y-2 p-3 border rounded bg-neutral-50">
                          <div className="flex items-center gap-4">
                            <span className="font-medium min-w-[150px]">{pd.product}</span>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">From:</Label>
                              <Select 
                                value={pd.fromClass ?? '0'} 
                                onValueChange={(v) => updateProductDetail(pd.id, 'fromClass', v)}
                              >
                                <SelectTrigger className="w-20 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableClasses.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">To:</Label>
                              <Select 
                                value={pd.toClass ?? '0'} 
                                onValueChange={(v) => updateProductDetail(pd.id, 'toClass', v)}
                              >
                                <SelectTrigger className="w-20 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableClasses.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`same-rate-${pd.id}`}
                                checked={pd.sameRateForAllClasses || false}
                                onCheckedChange={(checked) => updateProductDetail(pd.id, 'sameRateForAllClasses', checked)}
                              />
                              <Label htmlFor={`same-rate-${pd.id}`} className="text-xs cursor-pointer">
                                Same rate & strength for all classes
                              </Label>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // Remove parent and all its child rows; clear deliverables cache for this product
                                setProductDetails(productDetails.filter(p => 
                                  p.id !== pd.id && !p.id.startsWith(pd.id + '_')
                                ))
                                setSelectedProducts(selectedProducts.filter(p => p !== pd.product))
                                setDeliverablesByProduct(prev => {
                                  const next = { ...prev }
                                  delete next[pd.product]
                                  return next
                                })
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Specs Multi-Select */}
                          {productSpecs.length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                              <Label className="text-xs font-semibold mb-2 block">Select Specs:</Label>
                              <div className="flex flex-wrap gap-2">
                                {productSpecs.map((spec) => (
                                  <div key={spec} className="flex items-center space-x-1">
                                    <Checkbox
                                      id={`spec-${pd.id}-${spec}`}
                                      checked={selectedSpecs.includes(spec)}
                                      onCheckedChange={(checked) => {
                                        const newSpecs = checked
                                          ? [...selectedSpecs, spec]
                                          : selectedSpecs.filter(s => s !== spec)
                                        // Update parent row with new specs
                                        setProductDetails(currentDetails => {
                                          const updated = currentDetails.map(p => 
                                            p.id === pd.id ? { ...p, selectedSpecs: newSpecs } : p
                                          )
                                          // Regenerate rows after update
                                          setTimeout(() => {
                                            const updatedParent = updated.find(p => p.id === pd.id)
                                            if (updatedParent) {
                                              generateRowsFromRange(pd.id, updatedParent.fromClass ?? '0', updatedParent.toClass ?? '0')
                                            }
                                          }, 0)
                                          return updated
                                        })
                                      }}
                                    />
                                    <Label 
                                      htmlFor={`spec-${pd.id}-${spec}`} 
                                      className="text-xs cursor-pointer"
                                    >
                                      {spec}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Select Deliverables (below Specs, above Subjects) */}
                          {(() => {
                            const productDeliverables = deliverablesByProduct[pd.product] || []
                            const selectedDeliverables = pd.selectedDeliverables || []
                            if (productDeliverables.length === 0) return null
                            return (
                              <div className="mt-2 pt-2 border-t">
                                <Label className="text-xs font-semibold mb-2 block">Select Deliverables:</Label>
                                <div className="flex flex-wrap gap-2">
                                  {productDeliverables.map((deliverable) => (
                                    <div key={deliverable} className="flex items-center space-x-1">
                                      <Checkbox
                                        id={`deliverable-${pd.id}-${deliverable}`}
                                        checked={selectedDeliverables.includes(deliverable)}
                                        onCheckedChange={(checked) => {
                                          const newDeliverables = checked
                                            ? [...selectedDeliverables, deliverable]
                                            : selectedDeliverables.filter(d => d !== deliverable)
                                          updateProductDetail(pd.id, 'selectedDeliverables', newDeliverables)
                                        }}
                                      />
                                      <Label 
                                        htmlFor={`deliverable-${pd.id}-${deliverable}`} 
                                        className="text-xs cursor-pointer"
                                      >
                                        {deliverable}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                          
                          {/* Product Categories Multi-Select (only if product has product categories configured) */}
                          {hasProductCategories(pd.product) && (() => {
                            const productCategories = getProductCategories(pd.product)
                            const selectedCategories = pd.selectedCategories || productCategories
                            return (
                              <div className="mt-2 pt-2 border-t">
                                <Label className="text-xs font-semibold mb-2 block">Select Product Categories:</Label>
                                <div className="flex flex-wrap gap-2">
                                  {productCategories.map((category) => (
                                    <div key={category} className="flex items-center space-x-1">
                                      <Checkbox
                                        id={`category-${pd.id}-${category}`}
                                        checked={selectedCategories.includes(category)}
                                        onCheckedChange={(checked) => {
                                          const newCategories = checked
                                            ? [...selectedCategories, category]
                                            : selectedCategories.filter(c => c !== category)
                                          // Ensure at least one product category is selected
                                          if (newCategories.length === 0) {
                                            toast.error('At least one product category must be selected')
                                            return
                                          }
                                          // Update parent row with new categories
                                          setProductDetails(currentDetails => {
                                            const updated = currentDetails.map(p => 
                                              p.id === pd.id ? { ...p, selectedCategories: newCategories } : p
                                            )
                                            // Regenerate rows after update
                                            setTimeout(() => {
                                              const updatedParent = updated.find(p => p.id === pd.id)
                                              if (updatedParent) {
                                                generateRowsFromRange(pd.id, updatedParent.fromClass ?? '0', updatedParent.toClass ?? '0')
                                              }
                                            }, 0)
                                            return updated
                                          })
                                        }}
                                      />
                                      <Label 
                                        htmlFor={`category-${pd.id}-${category}`} 
                                        className="text-xs cursor-pointer"
                                      >
                                        {category}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                          
                          {/* Subjects Multi-Select (only if product has subjects) */}
                          {hasSubjects && productSubjects.length > 0 && (
                            <div className="mt-2 pt-2 border-t">
                              <Label className="text-xs font-semibold mb-2 block">Select Subjects:</Label>
                              <div className="flex flex-wrap gap-2">
                                {productSubjects.map((subject) => (
                                  <div key={subject} className="flex items-center space-x-1">
                                    <Checkbox
                                      id={`subject-${pd.id}-${subject}`}
                                      checked={selectedSubjects.includes(subject)}
                                      onCheckedChange={(checked) => {
                                        const newSubjects = checked
                                          ? [...selectedSubjects, subject]
                                          : selectedSubjects.filter(s => s !== subject)
                                        // Update parent row with new subjects
                                        setProductDetails(currentDetails => {
                                          const updated = currentDetails.map(p => 
                                            p.id === pd.id ? { ...p, selectedSubjects: newSubjects } : p
                                          )
                                          // Regenerate rows after update
                                          setTimeout(() => {
                                            const updatedParent = updated.find(p => p.id === pd.id)
                                            if (updatedParent) {
                                              generateRowsFromRange(pd.id, updatedParent.fromClass ?? '0', updatedParent.toClass ?? '0')
                                            }
                                          }, 0)
                                          return updated
                                        })
                                      }}
                                    />
                                    <Label 
                                      htmlFor={`subject-${pd.id}-${subject}`} 
                                      className="text-xs cursor-pointer"
                                    >
                                      {subject}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Product Details Table */}
            {productDetails.filter(pd => !pd.isParentRow).length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Product Details</Label>
                <div className="border rounded overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-left">Class</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Specs</th>
                        <th className="px-3 py-2 text-left">Subject</th>
                        <th className="px-3 py-2 text-left">Quantity (Strength) *</th>
                        <th className="px-3 py-2 text-left">Unit Price *</th>
                        <th className="px-3 py-2 text-left">Total</th>
                        <th className="px-3 py-2 text-left">Level</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productDetails
                        .filter(pd => !pd.isParentRow) // Only show child rows, not parent rows
                        .map((pd) => (
                        <tr key={pd.id} className="border-t">
                          <td className="px-3 py-2 font-medium">{pd.product}</td>
                          <td className="px-3 py-2">{pd.class}</td>
                          <td className="px-3 py-2">
                            <Select value={pd.category} onValueChange={(v) => updateProductDetail(pd.id, 'category', v)}>
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {hasProductCategories(pd.product) ? (
                                  getProductCategories(pd.product).map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))
                                ) : (
                                  defaultCategories.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">{pd.specs}</td>
                          <td className="px-3 py-2">{pd.subject || '-'}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.strength || ''}
                              onChange={(e) => {
                                let value = e.target.value
                                // Remove leading zeros (but allow single '0')
                                if (value.length > 1) {
                                  value = value.replace(/^0+/, '') || '0'
                                }
                                // Convert to number, use 0 if empty
                                const numValue = value === '' ? 0 : Number(value)
                                updateProductDetail(pd.id, 'strength', numValue)
                              }}
                              onBlur={(e) => {
                                // Normalize on blur to remove any remaining leading zeros
                                const numValue = Number(e.target.value) || 0
                                if (numValue !== pd.strength) {
                                  updateProductDetail(pd.id, 'strength', numValue)
                                }
                              }}
                              className="w-20 h-8"
                              min="1"
                              placeholder="0"
                              required
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              value={pd.price || ''}
                              onChange={(e) => {
                                let value = e.target.value
                                // Remove leading zeros for decimal numbers
                                if (value.includes('.')) {
                                  const [intPart, decPart] = value.split('.')
                                  // Remove leading zeros from integer part, but keep at least '0' if it was just '0'
                                  const cleanedInt = intPart.length > 1 
                                    ? intPart.replace(/^0+/, '') || '0'
                                    : intPart
                                  value = cleanedInt + (decPart !== undefined ? '.' + decPart : '')
                                } else if (value.length > 1) {
                                  // Remove leading zeros for whole numbers
                                  value = value.replace(/^0+/, '') || '0'
                                }
                                // Convert to number, use 0 if empty
                                const numValue = value === '' ? 0 : Number(value)
                                updateProductDetail(pd.id, 'price', numValue)
                              }}
                              onBlur={(e) => {
                                // Normalize on blur to remove any remaining leading zeros
                                const numValue = Number(e.target.value) || 0
                                if (numValue !== pd.price) {
                                  updateProductDetail(pd.id, 'price', numValue)
                                }
                              }}
                              className="w-24 h-8"
                              min="0.01"
                              placeholder="0"
                              step="0.01"
                              required
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">
                            ₹{((Number(pd.strength) || 0) * (Number(pd.price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2">
                            <Select value={pd.level} onValueChange={(v) => updateProductDetail(pd.id, 'level', v)}>
                              <SelectTrigger className="w-20 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getProductLevels(pd.product).map(l => (
                                  <SelectItem key={l} value={l}>{l}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProductDetail(pd.id)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="border-t-2 border-neutral-300 bg-neutral-100 font-semibold">
                        <td colSpan={5} className="px-3 py-3 text-right">
                          <span className="text-neutral-700">Total:</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {productDetails
                            .filter(pd => !pd.isParentRow)
                            .reduce((sum, pd) => sum + (Number(pd.strength) || 0), 0)}
                        </td>
                        <td className="px-3 py-3 text-right">-</td>
                        <td className="px-3 py-3 text-right">
                          ₹{productDetails
                            .filter(pd => !pd.isParentRow)
                            .reduce((sum, pd) => sum + ((Number(pd.strength) || 0) * (Number(pd.price) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td colSpan={2} className="px-3 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setProductDialogOpen(false)}>
              Done ({productDetails.length} products)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

