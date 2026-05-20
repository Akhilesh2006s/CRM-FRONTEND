'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, API_BASE_URL, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'
import { ArrowLeft, Package, CheckCircle2, Upload, X, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { useProducts } from '@/hooks/useProducts'
import { computeBucketAmount, type CalculationType } from '@/lib/paymentDivisor'
import { normalizeProductTerm, termFromLevelLabel, type ProductTerm } from '@/lib/productTerm'

type Lead = {
  _id: string
  dc_code?: string
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
  products?: any[] | string
  priority?: string
  remarks?: string
  school_type?: string
}

type GroupProductOpts = {
  getCalculationType: (productName: string) => CalculationType
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
}

// Group child product rows per product + class. For level_based / subject_based,
// sum strengths across distinct levels/subjects; duplicate same level+subject uses max.
const groupProductDetailsByProductAndClass = (
  details: any[],
  opts?: GroupProductOpts
) => {
  const getCt = (name: string) => opts?.getCalculationType(name) ?? ('none' as CalculationType)
  const getFallback = (name: string, ct: CalculationType) =>
    opts?.getCatalogFallbackCount(name, ct) ?? 0

  const normLevel = (l: any) =>
    String(l || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
  const normSubject = (s: any) => String(s || '').trim().toLowerCase()

  const map = new Map<string, any>()

  details.forEach((p) => {
    const key = `${p.product || ''}||${p.class || ''}`
    const strength = Number(p.strength) || 0
    const price = Number(p.price) || 0
    const ct = getCt(p.product || '')

    const existing = map.get(key)
    if (!existing) {
      if (ct === 'level_based' || ct === 'subject_based') {
        map.set(key, {
          ...p,
          strength,
          price,
          _dimRows: [{ strength, level: p.level, subject: p.subject, price }],
        })
      } else {
        map.set(key, {
          ...p,
          strength,
          price,
          total: strength * price,
        })
      }
      return
    }

    const mergedPrice = Math.max(Number(existing.price) || 0, price)

    if (ct === 'level_based' || ct === 'subject_based') {
      const dimRows = [...(existing._dimRows || [])]
      const prevDims = new Set(
        dimRows.map((r: any) => `${normLevel(r.level)}|${normSubject(r.subject || '')}`)
      )
      const thisDim = `${normLevel(p.level)}|${normSubject(p.subject || '')}`
      const duplicateDim = prevDims.has(thisDim)
      const mergedStrength = duplicateDim
        ? Math.max(Number(existing.strength) || 0, strength)
        : (Number(existing.strength) || 0) + strength
      dimRows.push({ strength, level: p.level, subject: p.subject, price })
      map.set(key, {
        ...existing,
        strength: mergedStrength,
        price: mergedPrice,
        _dimRows: dimRows,
      })
    } else {
      const mergedStrength = Math.max(Number(existing.strength) || 0, strength)
      map.set(key, {
        ...existing,
        strength: mergedStrength,
        price: mergedPrice,
        total: mergedStrength * mergedPrice,
      })
    }
  })

  return Array.from(map.values()).map((row) => {
    if (row._dimRows) {
      const ct = getCt(row.product || '')
      const total = computeBucketAmount({
        calculationType: ct,
        rows: row._dimRows,
        unitPrice: Number(row.price) || 0,
        catalogFallbackCount: getFallback(row.product || '', ct),
      })
      const { _dimRows, ...rest } = row
      return { ...rest, total }
    }
    return row
  })
}

const makeRowId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

type ProductDetailRow = {
  id: string
  product: string
  class: string
  fromClass?: string
  toClass?: string
  category: string
  quantity: number
  strength: number
  price: number
  total: number
  level: string
  specs: string
  subject?: string
  isParentRow?: boolean
  sameRateForAllClasses?: boolean
  selectedSubjects?: string[]
  selectedSpecs?: string[]
  selectedCategories?: string[]
  selectedDeliverables?: string[]
  term?: string
}

type CloseProductSectionLine = {
  id: string
  parentRowId: string
  product: string
  level: string
  selectedSpecs: string[]
  selectedSubjects: string[]
  selectedDeliverables: string[]
  selectedCategories?: string[]
  sameRateForAllClasses: boolean
  price: number
  term?: string
}

type CloseProductSection = {
  id: string
  fromClass: string
  toClass: string
  strength: number
  lines: CloseProductSectionLine[]
}

type ExpandSectionsCtx = {
  hasProductSubjects: (product: string) => boolean
  getProductCategories: (product: string) => string[]
  hasProductCategories: (product: string) => boolean
  schoolType?: string
}

function expandSectionsToProductDetails(
  sections: CloseProductSection[],
  ctx: ExpandSectionsCtx
): ProductDetailRow[] {
  const out: ProductDetailRow[] = []
  const schoolExisting = ctx.schoolType === 'Existing'

  for (const sec of sections) {
    for (const line of sec.lines) {
      const fromClass = sec.fromClass ?? '0'
      const toClass = sec.toClass ?? '0'
      const from = parseInt(fromClass, 10) || 0
      const to = parseInt(toClass, 10) || 0
      const strengthToUse = Number(sec.strength) || 0
      const priceToUse = Number(line.price) || 0

      const parentRow: ProductDetailRow = {
        id: line.parentRowId,
        product: line.product,
        class: '0',
        fromClass,
        toClass,
        category: ctx.hasProductCategories(line.product)
          ? (ctx.getProductCategories(line.product)[0] || '')
          : schoolExisting
            ? 'Existing Students'
            : 'New Students',
        quantity: 1,
        strength: strengthToUse,
        price: priceToUse,
        total: 0,
        level: line.level,
        specs: 'Regular',
        isParentRow: true,
        sameRateForAllClasses: line.sameRateForAllClasses,
        selectedSubjects: line.selectedSubjects || [],
        selectedSpecs: line.selectedSpecs || [],
        selectedDeliverables: line.selectedDeliverables || [],
        selectedCategories: line.selectedCategories,
        term: line.term !== undefined && line.term !== '' ? normalizeProductTerm(line.term) : undefined,
      }
      out.push(parentRow)

      if ((from === 0 && to === 0) || from > to) {
        continue
      }

      const selectedSpecs = line.selectedSpecs || []
      const specsToUse = selectedSpecs.length > 0 ? selectedSpecs : ['Regular']
      const selectedSubjects = line.selectedSubjects || []
      const hasSubjects =
        ctx.hasProductSubjects(line.product) && selectedSubjects.length > 0
      const selectedCategories = line.selectedCategories || []
      const categoriesToUse = ctx.hasProductCategories(line.product)
        ? selectedCategories.length > 0
          ? selectedCategories
          : ctx.getProductCategories(line.product)
        : [schoolExisting ? 'Existing Students' : 'New Students']

      let rowIdx = 0
      const parentId = line.parentRowId
      for (let classNum = from; classNum <= to; classNum++) {
        for (const spec of specsToUse) {
          for (const category of categoriesToUse) {
            const subjectDisplay =
              hasSubjects && selectedSubjects.length > 0
                ? selectedSubjects.join(', ')
                : undefined
            out.push({
              id: `${parentId}_${classNum}_${rowIdx++}`,
              product: line.product,
              class: classNum.toString(),
              category,
              productCategory: ctx.hasProductCategories(line.product) ? category : undefined,
              quantity: strengthToUse || 1,
              strength: strengthToUse || 0,
              price: priceToUse || 0,
              total: (strengthToUse || 0) * (priceToUse || 0),
              level: line.level,
              specs: spec,
              subject: subjectDisplay,
              isParentRow: false,
              sameRateForAllClasses: false,
            })
          }
        }
      }
    }
  }
  return out
}

function parentRowToSectionLine(p: ProductDetailRow): CloseProductSectionLine {
  return {
    id: makeRowId(),
    parentRowId: p.id,
    product: p.product,
    level: p.level,
    selectedSpecs: p.selectedSpecs || [],
    selectedSubjects: p.selectedSubjects || [],
    selectedDeliverables: p.selectedDeliverables || [],
    selectedCategories: p.selectedCategories,
    sameRateForAllClasses: p.sameRateForAllClasses || false,
    price: Number(p.price) || 0,
    term: p.term,
  }
}

function parentRowsToSections(parents: ProductDetailRow[]): CloseProductSection[] {
  return parents.map((p) => ({
    id: makeRowId(),
    fromClass: p.fromClass ?? '0',
    toClass: p.toClass ?? '0',
    strength: Number(p.strength) || 0,
    lines: [parentRowToSectionLine(p)],
  }))
}

/** Best-effort: one section per parent row (preserves ranges and line metadata on reopen). */
function productDetailsToSections(details: ProductDetailRow[]): CloseProductSection[] {
  return parentRowsToSections(details.filter((d) => d.isParentRow))
}

const getCurrentAcademicYear = () => {
  const currentYear = new Date().getFullYear()
  return `${currentYear}-${currentYear + 1}`
}

export default function CloseLeadPage() {
  const router = useRouter()
  const params = useParams()
  const leadId = params.id as string
  const currentUser = getCurrentUser()
  const currentAcademicYear = getCurrentAcademicYear()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lead, setLead] = useState<Lead | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState({
    contact_person2: '',
    contact_mobile2: '',
    delivery_date: '',
    year: currentAcademicYear,
  })
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [productDetails, setProductDetails] = useState<ProductDetailRow[]>([])
  const [productSections, setProductSections] = useState<CloseProductSection[]>([])
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
    getProductId,
    getCalculationType,
    getCatalogFallbackCount,
  } = useProducts()

  const groupProductOpts: GroupProductOpts = {
    getCalculationType,
    getCatalogFallbackCount,
  }
  const [deliverablesByProduct, setDeliverablesByProduct] = useState<Record<string, string[]>>({})
  const availableClasses = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  const defaultCategories = ['New Students', 'Existing Students', 'Both']
  const availableDCCategories = ['Term 1', 'Term 2', 'Term 3', 'Full Year']

  useEffect(() => {
    const details = expandSectionsToProductDetails(productSections, {
      hasProductSubjects,
      getProductCategories,
      hasProductCategories,
      schoolType: lead?.school_type,
    })
    setProductDetails(details)
    const names = [...new Set(productSections.flatMap((s) => s.lines.map((l) => l.product)))]
    setSelectedProducts(names)
    // Only stable deps: useProducts() returns new function references every render, so including
    // hasProductSubjects / getProductCategories / hasProductCategories caused maximum update depth.
    // Re-run when the catalog list identity changes (e.g. after /products/active loads).
  }, [productSections, lead?.school_type, catalogProducts])

  // Child (non-parent) rows and their grouped view by product + class
  const childProductRows = productDetails.filter(pd => !pd.isParentRow)
  const groupedChildProductRows = groupProductDetailsByProductAndClass(
    childProductRows,
    groupProductOpts
  )

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
                year: currentAcademicYear,
        })
        
        // Pre-fill selected products and product details - normalize product names to match availableProducts
        // Only set products that exactly match availableProducts
        let validProducts: string[] = []
        
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
        if (validProducts.length > 0) {
          const parentRows: ProductDetailRow[] = validProducts.map((product, productIdx) => {
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
              term: normalizeProductTerm(productData?.term),
            }
          })
          setProductSections(productDetailsToSections(parentRows))
        } else {
          setProductSections([])
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
  const parentProductNames = productSections.flatMap((s) => s.lines.map((l) => l.product))
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

  const sectionAllowsProductLines = (sec: CloseProductSection) => {
    const from = parseInt(sec.fromClass ?? '0', 10)
    const to = parseInt(sec.toClass ?? '0', 10)
    return !(from === 0 || to === 0 || from > to) && Number(sec.strength) > 0
  }

  const addEmptyProductSection = () => {
    setProductSections((prev) => [
      ...prev,
      { id: makeRowId(), fromClass: '0', toClass: '0', strength: 0, lines: [] },
    ])
  }

  const removeProductSection = (sectionId: string) => {
    setProductSections((prev) => prev.filter((s) => s.id !== sectionId))
  }

  const updateProductSection = (
    sectionId: string,
    field: 'fromClass' | 'toClass' | 'strength',
    value: string | number
  ) => {
    setProductSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s
        const next = { ...s, [field]: value }
        if (field === 'fromClass') {
          const newFrom = parseInt(String(value), 10)
          const currentTo = parseInt(String(next.toClass || '0'), 10)
          if (!isNaN(newFrom) && !isNaN(currentTo) && currentTo < newFrom) {
            next.toClass = String(newFrom)
          }
        }
        return next
      })
    )
  }

  const addProductLineToSection = (sectionId: string, product: string) => {
    setProductSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec
        const newLine: CloseProductSectionLine = {
          id: makeRowId(),
          parentRowId: makeRowId(),
          product,
          level: getDefaultLevel(product),
          selectedSpecs: [],
          selectedSubjects: [],
          selectedDeliverables: [],
          selectedCategories: hasProductCategories(product) ? [] : undefined,
          sameRateForAllClasses: false,
          price: 0,
        }
        return { ...sec, lines: [...sec.lines, newLine] }
      })
    )
  }

  const updateProductSectionLine = (
    sectionId: string,
    lineId: string,
    patch: Partial<CloseProductSectionLine>
  ) => {
    setProductSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec
        return {
          ...sec,
          lines: sec.lines.map((line) =>
            line.id === lineId ? { ...line, ...patch } : line
          ),
        }
      })
    )
  }

  const removeProductSectionLine = (sectionId: string, lineId: string) => {
    setProductSections((prev) =>
      prev.map((sec) =>
        sec.id !== sectionId
          ? sec
          : { ...sec, lines: sec.lines.filter((l) => l.id !== lineId) }
      )
    )
  }

  const updateLineUnitPrice = (sectionId: string, lineId: string, unitPrice: number) => {
    setProductSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec
        return {
          ...sec,
          lines: sec.lines.map((line) =>
            line.id === lineId ? { ...line, price: unitPrice } : line
          ),
        }
      })
    )
  }
  
  // Function to generate rows when From/To class range changes
  // Optional defaultStrength and defaultPrice can be passed to populate saved values.
  // If not provided, we fall back to the parent row's strength/price so changes are preserved.
  const generateRowsFromRange = (
    parentId: string,
    fromClass: string,
    toClass: string,
    defaultStrength?: number,
    defaultPrice?: number
  ) => {
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

      const strengthToUse =
        typeof defaultStrength === 'number' ? defaultStrength : (parentRow.strength || 0)
      const priceToUse =
        typeof defaultPrice === 'number' ? defaultPrice : (parentRow.price || 0)
      
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
              productCategory: hasProductCategories(parentRow.product) ? category : undefined,
              quantity: strengthToUse || 1,
              strength: strengthToUse || 0,
              price: priceToUse || 0,
              total: (strengthToUse || 0) * (priceToUse || 0),
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

  // Update a parent product's unit price and propagate to its child rows.
  const updateParentUnitPrice = (parentId: string, unitPrice: number) => {
    setProductDetails(currentDetails =>
      currentDetails.map(row => {
        if (row.id === parentId) {
          return { ...row, price: unitPrice }
        }
        if (!row.isParentRow && row.id.startsWith(parentId + '_')) {
          const strength = Number(row.strength) || 0
          return {
            ...row,
            price: unitPrice,
            total: strength * unitPrice,
          }
        }
        return row
      })
    )
  }
  
  const updateProductDetail = (id: string, field: string, value: any) => {
    setProductDetails(currentDetails => {
      const rowToUpdate = currentDetails.find(p => p.id === id)
      if (!rowToUpdate) return currentDetails
      
      const updated = { ...rowToUpdate, [field]: value }
      
      // Auto-calculate total when price or strength changes (strength * price)
      if (field === 'price' || field === 'strength') {
        updated.total = (Number(updated.strength) || 0) * (Number(updated.price) || 0)

        // For child rows, keep quantity/strength same for ALL specs of the same product + class.
        // Price can still vary per spec; we only sync strength automatically.
        if (!rowToUpdate.isParentRow) {
          // When strength changes on one row, apply that strength to all rows of same product + class
          if (field === 'strength') {
            return currentDetails.map(p => {
              if (
                !p.isParentRow &&
                p.product === updated.product &&
                p.class === updated.class
              ) {
                const newStrength = value
                const price = Number(p.price) || 0
                return {
                  ...p,
                  strength: newStrength,
                  total: (Number(newStrength) || 0) * price,
                }
              }
              if (p.id === id) return updated
              return p
            })
          }

          // When price changes on one row and "sameRateForAllClasses" is enabled on its parent,
          // keep price the same for all specs of this product + class + level.
          if (field === 'price') {
            const parentRow = currentDetails.find(p =>
              p.isParentRow &&
              p.product === rowToUpdate.product &&
              p.id === rowToUpdate.id.split('_')[0]
            )

            if (parentRow?.sameRateForAllClasses) {
              return currentDetails.map(p => {
                if (
                  !p.isParentRow &&
                  p.product === updated.product &&
                  p.class === updated.class &&
                  p.level === updated.level
                ) {
                  const strength = Number(p.strength) || 0
                  const newPrice = value
                  return {
                    ...p,
                    price: newPrice,
                    total: strength * (Number(newPrice) || 0),
                  }
                }
                if (p.id === id) return updated
                return p
              })
            }
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
      setProductSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          lines: sec.lines.filter((l) => l.parentRowId !== id),
        }))
      )
      return
    }
    // Remove only this specific child row (does not resync sections until next section edit)
    setProductDetails(productDetails.filter(p => p.id !== id))
    // Update selectedProducts to match remaining productDetails
    const remainingProducts = productDetails
      .filter(p => p.id !== id)
      .map(p => p.product)
        .filter((p, idx, arr) => arr.indexOf(p) === idx) // Remove duplicates
    setSelectedProducts(remainingProducts)
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

  const proceedWithSubmission = async (dcProductDetails: any[], totalQuantity: number) => {
    try {
      // Create DC with all details
      const assignedEmployeeId = currentUser?._id

      const dcPayload: any = {
        dcOrderId: leadId,
        dcDate: form.delivery_date || new Date().toISOString(),
        dcRemarks: `Lead converted to client - ${lead?.school_name}`,
        dcCategory: lead?.school_type === 'Existing' ? 'Existing School' : 'New School',
        requestedQuantity: totalQuantity,
        employeeId: assignedEmployeeId,
        productDetails: dcProductDetails,
        status: 'created', // Set to 'created' so it appears in "My Clients" page immediately
      }
      
      // Add PO photo if uploaded
      if (poPhotoUrl) {
        dcPayload.poPhotoUrl = poPhotoUrl
        dcPayload.poDocument = poPhotoUrl
      }
      
      console.log('🔄 Creating DC with payload:', {
        dcOrderId: dcPayload.dcOrderId,
        employeeId: dcPayload.employeeId,
        status: dcPayload.status,
        productDetailsCount: dcPayload.productDetails?.length
      });
      
      const leadIdForDc = leadId

      const dc = await apiRequest('/dc/raise', {
        method: 'POST',
        body: JSON.stringify({
          ...dcPayload,
          dcOrderId: leadIdForDc,
        }),
      })
      
      console.log('✅ DC created:', {
        dcId: dc._id,
        status: dc.status,
        customerName: dc.customerName
      });
      
      // If PO photo is provided, also submit PO
      if (poPhotoUrl && dc._id) {
        try {
          await apiRequest(`/dc/${dc._id}/submit-po`, {
            method: 'POST',
            body: JSON.stringify({ 
              poPhotoUrl: poPhotoUrl,
            }),
          })
        } catch (poErr) {
          console.error('Failed to submit PO:', poErr)
          // Don't fail the whole operation if PO submission fails
        }
      }
      
      // Verify the conversion worked by checking if DC exists
      try {
        const verifyDC = await apiRequest(`/dc/${dc._id}`)
        console.log('✅ Verification - DC exists:', {
          id: verifyDC._id,
          status: verifyDC.status,
          employeeId: verifyDC.employeeId,
          dcOrderId: verifyDC.dcOrderId
        });
      } catch (verifyErr) {
        console.warn('⚠️ Could not verify DC creation (this is okay if query times out):', verifyErr);
      }
      
      toast.success('Lead converted to client! DC created and submitted to My Clients successfully.')
      
      // Store the DC ID in sessionStorage so the Client DC page can fetch it directly
      if (dc._id) {
        sessionStorage.setItem('newlyConvertedDCId', dc._id);
        sessionStorage.setItem('newlyConvertedDC', JSON.stringify(dc));
      }
      
      // Redirect to Client DC page
      router.push('/dashboard/dc/client-dc')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSplitConfirm = async () => {
    if (!pendingSubmissionContext) return
    setSubmitting(true)
    setSplitModalOpen(false)
    setSplitPreview(null)
    await proceedWithSubmission(
      pendingSubmissionContext.dcProductDetails,
      pendingSubmissionContext.totalQuantity
    )
    setPendingSubmissionContext(null)
  }

  const handleSplitCancel = () => {
    setSplitModalOpen(false)
    setSplitPreview(null)
    setPendingSubmissionContext(null)
    setSubmitting(false)
  }

  const handleTurnToClient = async () => {
    if (!lead) return
    
    // Filter out parent rows for validation
    const actualProductDetails = productDetails.filter(pd => !pd.isParentRow)
    
    const groupedProductDetails = groupProductDetailsByProductAndClass(
      actualProductDetails,
      groupProductOpts
    )
    
    if (groupedProductDetails.length === 0) {
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
    const invalidProducts = groupedProductDetails.filter(p => 
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
        year: currentAcademicYear,
        assigned_to: assignedEmployeeId,
        products: groupedProductDetails.map((p) => {
          const sampleChild = actualProductDetails.find(
            (r) =>
              !r.isParentRow &&
              (r.product || '') === (p.product || '') &&
              String(r.class || '') === String(p.class || '')
          )
          const parentRow = sampleChild
            ? productDetails.find(
                (parent) =>
                  parent.isParentRow && sampleChild.id.startsWith(parent.id + '_')
              )
            : productDetails.find(
                (parent) => parent.isParentRow && parent.product === p.product
              )
          const deliverables = parentRow?.selectedDeliverables || []
          const bucketRows = actualProductDetails.filter(
            (r) =>
              (r.product || '') === (p.product || '') &&
              String(r.class || '') === String(p.class || '')
          )
          const levelSet = new Set<string>()
          const subjectSet = new Set<string>()
          bucketRows.forEach((r) => {
            if (r.level) levelSet.add(String(r.level).trim())
            if (r.subject) subjectSet.add(String(r.subject).trim())
          })
          const termsFromLevels = new Set<ProductTerm>()
          bucketRows.forEach((r) => {
            const t = termFromLevelLabel(r.level)
            if (t) termsFromLevels.add(t)
          })
          let invoiceTerm: ProductTerm = normalizeProductTerm(parentRow?.term)
          if (termsFromLevels.size === 1) {
            invoiceTerm = [...termsFromLevels][0]
          } else if (termsFromLevels.size > 1) {
            invoiceTerm = 'Both'
          }
          const selectedSubjects =
            parentRow?.selectedSubjects?.length && parentRow.selectedSubjects.length > 0
              ? [...parentRow.selectedSubjects]
              : Array.from(subjectSet)
          return {
            product_name: p.product,
            quantity: p.strength, // Use strength as quantity
            unit_price: p.price,
            class: String(p.class ?? '1'),
            specs: (p as any).specs || undefined,
            deliverables,
            productCategory: (() => {
              const skuCats = hasProductCategories(p.product) ? getProductCategories(p.product) : []
              const catStr = typeof (p as any).category === 'string' ? (p as any).category.trim() : ''
              const isSku = skuCats.some((c) => c.toLowerCase() === catStr.toLowerCase())
              return isSku
                ? catStr
                : (p as any).productCategory || undefined
            })(),
            selected_subjects: selectedSubjects,
            levels_snapshot: Array.from(levelSet),
            level: levelSet.size === 1 ? Array.from(levelSet)[0] : undefined,
            subject: subjectSet.size === 1 ? Array.from(subjectSet)[0] : undefined,
            term: invoiceTerm,
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
                body: JSON.stringify({ status: 'Closed', year: currentAcademicYear }),
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
                  year: currentAcademicYear,
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
      
      // Prepare product details for DC (exclude parent rows).
      // We send the FULL list of spec rows so Client DC can show all specs/levels,
      // but requestedQuantity (below) is based on groupedProductDetails so total strength
      // is still per class, not multiplied by specs.
      const dcProductDetails = actualProductDetails.map(p => {
        const parentRow = productDetails.find(parent => parent.isParentRow && p.id.startsWith(parent.id + '_'))
        const deliverables = parentRow?.selectedDeliverables || []
        const levelValue = p.level || getDefaultLevel(p.product)
        const levelKey = (levelValue || '').toString().toLowerCase().replace(/\s+/g, '')
        let termFromLevel: string | null = null
        if (levelKey.startsWith('term2')) termFromLevel = 'Term 2'
        else if (levelKey.startsWith('term1')) termFromLevel = 'Term 1'
        else if (levelKey.includes('both')) termFromLevel = 'Both'
        const skuCats = hasProductCategories(p.product) ? getProductCategories(p.product) : []
        const catStr = typeof p.category === 'string' ? p.category.trim() : ''
        const isSkuCategory = skuCats.some((c) => c.toLowerCase() === catStr.toLowerCase())
        const enrollmentCategory =
          lead?.school_type === 'Existing' ? 'Existing Students' : 'New Students'
        return {
          product: p.product,
          class: p.class || '1', // Use actual class value
          category: isSkuCategory
            ? enrollmentCategory
            : p.category ||
              (hasProductCategories(p.product)
                ? getProductCategories(p.product)[0] || enrollmentCategory
                : enrollmentCategory),
          productCategory: isSkuCategory
            ? catStr
            : (p as any).productCategory || undefined,
          quantity: Number(p.quantity) || 0, // Keep for backend compatibility
          strength: Number(p.strength) || 0,
          price: Number(p.price) || 0,
          total: Number(p.total) || (Number(p.strength) || 0) * (Number(p.price) || 0),
          level: levelValue,
          specs: p.specs || 'Regular', // Include specs
          subject: p.subject || undefined, // Include subject if present
          deliverables,
          term: normalizeProductTerm(
            termFromLevel ||
              (p as any).term ||
              termFromLevelLabel((p as any).level) ||
              (parentRow as any)?.term
          ),
        }
      })
      
      // Total requested quantity is based on groupedProductDetails (per product + class),
      // so having multiple specs for the same class does NOT multiply the strength.
      const totalQuantity = groupedProductDetails.reduce((sum, p) => sum + (p.strength || 0), 0)

      const term1Items = dcProductDetails.filter(p =>
        (p.term || 'Term 1') === 'Term 1' || (p.term || 'Term 1') === 'Both'
      )
      const term2Items = dcProductDetails.filter(p =>
        (p.term || 'Term 1') === 'Term 2'
      )

      if (term1Items.length > 0 && term2Items.length > 0) {
        setSubmitting(false)
        setSplitPreview({
          term1: term1Items.map((p: any) => ({
            productName: p.productName || p.product,
            strength: p.strength || p.quantity || 0,
          })),
          term2: term2Items.map((p: any) => ({
            productName: p.productName || p.product,
            strength: p.strength || p.quantity || 0,
          })),
        })
        setPendingSubmissionContext({ dcProductDetails, totalQuantity })
        setSplitModalOpen(true)
        return
      }

      await proceedWithSubmission(dcProductDetails, totalQuantity)
    } catch (err: any) {
      setError(err?.message || 'Failed to convert lead to client')
      toast.error(err?.message || 'Failed to convert lead to client')
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
            <Input
              value={form.year}
              readOnly
              className="mt-1 bg-neutral-100 cursor-not-allowed"
            />
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
                      href={resolveUploadUrl(poPhotoUrl)}
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
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Products & Details</DialogTitle>
            <DialogDescription>
              Add class sections (From–To and strength) first, then add product lines under each section. Strength
              applies per generated class row: every class in the range uses the same quantity/strength for DC rows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border rounded p-3 bg-neutral-50">
              <div>
                <Label className="text-sm font-semibold">Sections</Label>
                <p className="text-xs text-neutral-500 mt-1">
                  Products are always edited inside a section. Use the catalog buttons under each section.
                </p>
              </div>
              <Button type="button" size="sm" onClick={addEmptyProductSection}>
                <PlusCircle className="w-4 h-4 mr-1" />
                Add section
              </Button>
            </div>

            {filteredProducts.length === 0 && (
              <div className="p-4 border rounded bg-yellow-50 text-yellow-800 text-sm">
                No products available in the database. Please contact admin to add products.
              </div>
            )}

            {productSections.length === 0 ? (
              <div className="p-4 border rounded bg-neutral-50 text-sm text-neutral-600">
                No sections yet. Click &quot;Add section&quot;, set class From–To and strength, then add products under
                that section.
              </div>
            ) : (
              <div className="space-y-4">
                {productSections.map((section) => {
                  const allowLines = sectionAllowsProductLines(section)
                  return (
                    <div key={section.id} className="border rounded p-4 space-y-3 bg-white">
                      <div className="flex flex-wrap items-end gap-3 justify-between">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <Label className="text-xs font-semibold">From class</Label>
                            <Select
                              value={section.fromClass ?? '0'}
                              onValueChange={(v) => updateProductSection(section.id, 'fromClass', v)}
                            >
                              <SelectTrigger className="w-20 h-9 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableClasses.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">To class</Label>
                            <Select
                              value={section.toClass ?? '0'}
                              onValueChange={(v) => updateProductSection(section.id, 'toClass', v)}
                            >
                              <SelectTrigger className="w-20 h-9 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableClasses.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">Strength (per class) *</Label>
                            <Input
                              type="number"
                              className="w-28 h-9 mt-1"
                              min={1}
                              value={section.strength || ''}
                              onChange={(e) => {
                                let value = e.target.value
                                if (value.length > 1) value = value.replace(/^0+/, '') || '0'
                                const num = value === '' ? 0 : Number(value)
                                updateProductSection(section.id, 'strength', num)
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeProductSection(section.id)}
                          className="text-red-600"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove section
                        </Button>
                      </div>
                      {!allowLines && (
                        <p className="text-xs text-amber-700">
                          Set valid From/To (not 0–0, From ≤ To) and strength greater than 0 before adding products.
                        </p>
                      )}

                      {section.lines.map((line) => {
                        const productSubjects = getProductSubjects(line.product)
                        const hasSubjects = hasProductSubjects(line.product)
                        const selectedSubjects = line.selectedSubjects || []
                        const productSpecs = getProductSpecs(line.product)
                        const selectedSpecs = line.selectedSpecs || []
                        const productCategories = hasProductCategories(line.product)
                          ? getProductCategories(line.product)
                          : []
                        const childRows = productDetails.filter(
                          (row) => !row.isParentRow && row.id.startsWith(`${line.parentRowId}_`)
                        )
                        const groupedChildRows = groupProductDetailsByProductAndClass(
                          childRows,
                          groupProductOpts
                        )
                        const lineTotalAmount = groupedChildRows.reduce(
                          (sum, row) => sum + (Number(row.total) || 0),
                          0
                        )

                        return (
                          <div key={line.id} className="space-y-2 p-3 border rounded bg-neutral-50">
                            <div className="flex flex-wrap items-center gap-3 justify-between">
                              <span className="font-medium min-w-[120px]">{line.product}</span>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`same-rate-${line.id}`}
                                  checked={line.sameRateForAllClasses || false}
                                  onCheckedChange={(checked) =>
                                    updateProductSectionLine(section.id, line.id, {
                                      sameRateForAllClasses: !!checked,
                                    })
                                  }
                                />
                                <Label htmlFor={`same-rate-${line.id}`} className="text-xs cursor-pointer">
                                  Same rate for all classes (this level)
                                </Label>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProductSectionLine(section.id, line.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            {productSpecs.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                  <div>
                                    <Label className="text-xs font-semibold mb-2 block">Select Specs:</Label>
                                    <div className="flex flex-wrap gap-2">
                                      {productSpecs.map((spec) => (
                                        <div key={spec} className="flex items-center space-x-1">
                                          <Checkbox
                                            id={`spec-${line.id}-${spec}`}
                                            checked={selectedSpecs.includes(spec)}
                                            onCheckedChange={(checked) => {
                                              const newSpecs = checked
                                                ? [...selectedSpecs, spec]
                                                : selectedSpecs.filter((s) => s !== spec)
                                              updateProductSectionLine(section.id, line.id, {
                                                selectedSpecs: newSpecs,
                                              })
                                            }}
                                          />
                                          <Label
                                            htmlFor={`spec-${line.id}-${spec}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            {spec}
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex flex-col md:flex-row gap-3 md:items-end">
                                    <div>
                                      <Label className="text-xs font-semibold mb-1 block">Unit Price *</Label>
                                      <Input
                                        type="number"
                                        value={line.price || ''}
                                        onChange={(e) => {
                                          let value = e.target.value
                                          if (value.includes('.')) {
                                            const [intPart, decPart] = value.split('.')
                                            const cleanedInt =
                                              intPart.length > 1
                                                ? intPart.replace(/^0+/, '') || '0'
                                                : intPart
                                            value =
                                              cleanedInt + (decPart !== undefined ? '.' + decPart : '')
                                          } else if (value.length > 1) {
                                            value = value.replace(/^0+/, '') || '0'
                                          }
                                          const numValue = value === '' ? 0 : Number(value)
                                          updateLineUnitPrice(section.id, line.id, numValue)
                                        }}
                                        className="h-8 w-28"
                                        min="0.01"
                                        placeholder="0"
                                        step="0.01"
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold mb-1 block">Total</Label>
                                      <Input
                                        type="text"
                                        value={`₹${lineTotalAmount.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}`}
                                        readOnly
                                        className="h-8 w-32 bg-neutral-50"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {productSpecs.length === 0 && (
                              <div className="mt-2 pt-2 border-t flex flex-col md:flex-row gap-3 md:items-end">
                                <div>
                                  <Label className="text-xs font-semibold mb-1 block">Unit Price *</Label>
                                  <Input
                                    type="number"
                                    value={line.price || ''}
                                    onChange={(e) => {
                                      let value = e.target.value
                                      if (value.includes('.')) {
                                        const [intPart, decPart] = value.split('.')
                                        const cleanedInt =
                                          intPart.length > 1
                                            ? intPart.replace(/^0+/, '') || '0'
                                            : intPart
                                        value = cleanedInt + (decPart !== undefined ? '.' + decPart : '')
                                      } else if (value.length > 1) {
                                        value = value.replace(/^0+/, '') || '0'
                                      }
                                      const numValue = value === '' ? 0 : Number(value)
                                      updateLineUnitPrice(section.id, line.id, numValue)
                                    }}
                                    className="h-8 w-28"
                                    min="0.01"
                                    placeholder="0"
                                    step="0.01"
                                    required
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-semibold mb-1 block">Total</Label>
                                  <Input
                                    type="text"
                                    value={`₹${lineTotalAmount.toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}`}
                                    readOnly
                                    className="h-8 w-32 bg-neutral-50"
                                  />
                                </div>
                              </div>
                            )}

                            {(() => {
                              const productDeliverables = deliverablesByProduct[line.product] || []
                              const selectedDeliverables = line.selectedDeliverables || []
                              if (productDeliverables.length === 0) return null
                              return (
                                <div className="mt-2 pt-2 border-t">
                                  <Label className="text-xs font-semibold mb-2 block">Select Deliverables:</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {productDeliverables.map((deliverable) => (
                                      <div key={deliverable} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`deliverable-${line.id}-${deliverable}`}
                                          checked={selectedDeliverables.includes(deliverable)}
                                          onCheckedChange={(checked) => {
                                            const newDeliverables = checked
                                              ? [...selectedDeliverables, deliverable]
                                              : selectedDeliverables.filter((d) => d !== deliverable)
                                            updateProductSectionLine(section.id, line.id, {
                                              selectedDeliverables: newDeliverables,
                                            })
                                          }}
                                        />
                                        <Label
                                          htmlFor={`deliverable-${line.id}-${deliverable}`}
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

                            {hasProductCategories(line.product) && (() => {
                              const selectedCats =
                                line.selectedCategories ||
                                (hasProductCategories(line.product) ? productCategories : [])
                              return (
                                <div className="mt-2 pt-2 border-t">
                                  <Label className="text-xs font-semibold mb-2 block">
                                    Select Product Categories:
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {productCategories.map((category) => (
                                      <div key={category} className="flex items-center space-x-1">
                                        <Checkbox
                                          id={`category-${line.id}-${category}`}
                                          checked={selectedCats.includes(category)}
                                          onCheckedChange={(checked) => {
                                            const newCategories = checked
                                              ? [...selectedCats, category]
                                              : selectedCats.filter((c) => c !== category)
                                            if (newCategories.length === 0) {
                                              toast.error('At least one product category must be selected')
                                              return
                                            }
                                            updateProductSectionLine(section.id, line.id, {
                                              selectedCategories: newCategories,
                                            })
                                          }}
                                        />
                                        <Label
                                          htmlFor={`category-${line.id}-${category}`}
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

                            {hasSubjects && productSubjects.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <Label className="text-xs font-semibold mb-2 block">Select Subjects:</Label>
                                <div className="flex flex-wrap gap-2">
                                  {productSubjects.map((subject) => (
                                    <div key={subject} className="flex items-center space-x-1">
                                      <Checkbox
                                        id={`subject-${line.id}-${subject}`}
                                        checked={selectedSubjects.includes(subject)}
                                        onCheckedChange={(checked) => {
                                          const newSubjects = checked
                                            ? [...selectedSubjects, subject]
                                            : selectedSubjects.filter((s) => s !== subject)
                                          updateProductSectionLine(section.id, line.id, {
                                            selectedSubjects: newSubjects,
                                          })
                                        }}
                                      />
                                      <Label
                                        htmlFor={`subject-${line.id}-${subject}`}
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

                      <div className="pt-2 border-t">
                        <Label className="text-xs font-semibold mb-2 block">Add product to this section</Label>
                        {filteredProducts.length === 0 ? (
                          <p className="text-xs text-neutral-500">No products in catalog.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto border rounded p-2 bg-neutral-50/50">
                            {filteredProducts.map((product) => (
                              <Button
                                key={`${section.id}-${product}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-8"
                                disabled={!allowLines}
                                onClick={() => addProductLineToSection(section.id, product)}
                              >
                                <PlusCircle className="w-3 h-3 mr-1" />
                                {product}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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
                        <th className="px-3 py-2 text-left">Quantity (Strength) *</th>
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
                            <Select value={pd.level} onValueChange={(v) => updateProductDetail(pd.id, 'level', v)}>
                              <SelectTrigger className="w-28 h-8">
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
                        <td colSpan={4} className="px-3 py-3 text-right">
                          <span className="text-neutral-700">Total:</span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {groupedChildProductRows.reduce(
                            (sum, pd) => sum + (Number(pd.strength) || 0),
                            0
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          ₹{groupedChildProductRows
                            .reduce(
                              (sum, pd) =>
                                sum +
                                ((Number(pd.strength) || 0) * (Number(pd.price) || 0)),
                              0
                            )
                            .toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </td>
                        <td className="px-3 py-3"></td>
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
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Confirmation Dialog */}
      <Dialog
        open={splitModalOpen}
        onOpenChange={(open) => {
          if (!open) handleSplitCancel()
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>This lead will be split into 2 DCs</DialogTitle>
            <DialogDescription>
              Review how products will be divided before confirming.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* DC 1 */}
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold mb-2 text-green-700">
                DC 1 – My Clients (Term 1)
              </p>
              <ul className="space-y-1">
                {splitPreview?.term1.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>• {p.productName}</span>
                    <span>Qty: {p.strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DC 2 */}
            <div className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold mb-2 text-blue-700">
                DC 2 – Term Wise DC (Term 2)
              </p>
              <ul className="space-y-1">
                {splitPreview?.term2.map((p, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-sm text-muted-foreground"
                  >
                    <span>• {p.productName}</span>
                    <span>Qty: {p.strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleSplitCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSplitConfirm}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

