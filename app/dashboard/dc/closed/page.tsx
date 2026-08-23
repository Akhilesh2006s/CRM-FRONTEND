'use client'

import { useEffect, useState, useMemo } from 'react'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { isSuperAdmin as checkIsSuperAdmin } from '@/lib/permissions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'
import { toast } from 'sonner'
import { sanitizeMobileInput, validateContactMobile, validateContactPerson } from '@/lib/saleFormValidation'
import { keepMyClientsOwnedProductRows } from '@/lib/clientDcProductRows'
import { CLOSE_LEAD_DESTINATION } from '@/lib/closeLeadTermRouting'
import { resolveExistingProductTerm } from '@/lib/productTerm'

/** DcOrder statuses that belong on the Closed Sales page. */
function isClosedSalesOrderStatus(status?: string) {
  return status === 'dc_requested' || status === 'dc_accepted'
}

/** Closed Sales only after Executive clicks Request DC (requestedAt / requestedBy). */
function wasRequestedByExecutive(deal?: { status?: string; requestedAt?: string; requestedBy?: unknown } | null) {
  if (!deal) return false
  if (!isClosedSalesOrderStatus(deal.status)) return false
  if (deal.status === 'dc_accepted') return true
  return Boolean(deal.requestedAt || deal.requestedBy)
}

/**
 * Linked DC document statuses that mean Super Admin already Raised DC
 * (Pending DC → warehouse). Request DC / po_submitted / created must stay visible.
 */
const DC_LEFT_CLOSED_SALES = new Set([
  'pending_dc',
  'sent_to_manager',
  'warehouse_processing',
])

function hasLeftClosedSalesStage(dc?: { status?: string } | null) {
  if (!dc?.status) return false
  return DC_LEFT_CLOSED_SALES.has(dc.status)
}

function productLineQty(p: any): number {
  const q = Number(p?.quantity)
  if (Number.isFinite(q) && q > 0) return q
  const s = Number(p?.strength)
  return Number.isFinite(s) && s > 0 ? s : 0
}

function dcListFromResponse(res: any): any[] {
  if (Array.isArray(res)) return res
  if (Array.isArray(res?.data)) return res.data
  return []
}

/** Term-Wise / Term 2 DC — never a Closed Sales Raise DC source. */
function isTermWiseDcRecord(dc?: any): boolean {
  if (!dc) return false
  if (dc.status === 'scheduled_for_later') return true
  const details = Array.isArray(dc.productDetails) ? dc.productDetails : []
  if (!details.length) return false
  return details.every(
    (p: any) => String(p?.closeLeadDestination || '').trim() === CLOSE_LEAD_DESTINATION.TERM_WISE_DC
  )
}

/**
 * Closed Sales Raise DC is the My Clients / Term 1 DC only.
 * Never include Term-Wise / Term 2 allocations (e.g. P3 Level 2).
 */
function closedSalesOwnedLines(rows: any[], siblingRows: any[] = []): any[] {
  const input = Array.isArray(rows) ? rows : []
  const withoutExplicitTermWise = input.filter((p) => {
    const dest = String(p?.closeLeadDestination || '').trim()
    return dest !== CLOSE_LEAD_DESTINATION.TERM_WISE_DC
  })
  return keepMyClientsOwnedProductRows(withoutExplicitTermWise, siblingRows)
}

/**
 * Once a My Clients DC exists, use THAT DC's product allocations.
 * Never pick Term-Wise DC lines or the merged DcOrder list (90 + 20 = 110).
 */
function resolveClosedSalesProductLines(deal?: any, dc?: any, siblingRows: any[] = []): any[] {
  const sources: any[][] = []
  if (!isTermWiseDcRecord(dc) && Array.isArray(dc?.productDetails) && dc.productDetails.length > 0) {
    sources.push(dc.productDetails)
  }
  const requested = deal?.dcRequestData?.productDetails
  if (Array.isArray(requested) && requested.length > 0) {
    sources.push(requested)
  }
  const pe = deal?.pendingEdit
  if (pe?.status === 'approved' && Array.isArray(pe.products) && pe.products.length > 0) {
    sources.push(pe.products)
  }
  if (Array.isArray(deal?.products) && deal.products.length > 0) {
    sources.push(deal.products)
  }
  for (const src of sources) {
    const owned = closedSalesOwnedLines(src, siblingRows)
    if (owned.length > 0) return owned
  }
  return []
}

type DcOrder = {
  _id: string
  dc_code?: string
  school_name?: string
  school_code?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  contact_person2?: string
  contact_mobile2?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  cluster?: string
  products?: Array<{ product_name: string; quantity: number; strength?: number }>
  assigned_to?: {
    _id: string
    name?: string
    email?: string
  }
  created_at?: string
  createdAt?: string
  remarks?: string
  pod_proof_url?: string
  status?: string
  dcRequestData?: any
  isLead?: boolean // Flag to identify if this is a converted lead
  // Transport fields
  transport_name?: string
  transport_location?: string
  transportation_landmark?: string
  pincode?: string
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
  dcOrderId?: string | DcOrder
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  dcNotes?: string
  productDetails?: Array<{
    product: string
    class: string
    category: string
    productName: string
    quantity: number
    strength?: number
    price?: number
    total?: number
    level?: string
  }>
}

export default function ClosedSalesPage() {
  const [items, setItems] = useState<DcOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDeal, setSelectedDeal] = useState<DcOrder | null>(null)
  const [openRaiseDCDialog, setOpenRaiseDCDialog] = useState(false)
  const [openLocationDialog, setOpenLocationDialog] = useState(false)
  const [openPOPhotoDialog, setOpenPOPhotoDialog] = useState(false)
  const [selectedPOPhotoUrl, setSelectedPOPhotoUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [employees, setEmployees] = useState<{ _id: string; name: string }[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')
  // Map to store existing DCs for each deal: dealId -> DC
  const [dealDCs, setDealDCs] = useState<Record<string, DC>>({})
  const [existingDC, setExistingDC] = useState<DC | null>(null)
  
  // Search and filter state
  const [searchSchoolName, setSearchSchoolName] = useState('')
  const [searchMobile, setSearchMobile] = useState('')
  const [searchFromDate, setSearchFromDate] = useState('')
  const [searchToDate, setSearchToDate] = useState('')
  const [searchZone, setSearchZone] = useState('')
  const [searchExecutive, setSearchExecutive] = useState('')
  const [searchTown, setSearchTown] = useState('')
  
  // Get current user to check role
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isSuperAdmin = checkIsSuperAdmin(currentUser as any)
  const isCoordinator = currentUser?.role === 'Coordinator'
  const isEmployee = currentUser?.role === 'Executive'
  const isAdmin = currentUser?.role === 'Admin'
  // Employees can request DC, Coordinators/Admins can approve or send to senior
  const canRequestDC = isEmployee
  const canApproveDC = isSuperAdmin || isCoordinator || isAdmin
  // This Closed Sales form only: Contact Person 2 + Contact Mobile 2 are mandatory
  // (does not affect Create Sale or other pages).
  const requireContact2 = true
  
  // Form state for Raise DC modal
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [dcDetailsErrors, setDcDetailsErrors] = useState<{
    dcDate?: string
    dcCategory?: string
    dcRemarks?: string
    contact_person2?: string
    contact_mobile2?: string
  }>({})
  
  // Product rows for DC (like in the Raise DC form)
  type ProductRow = {
    id: string
    product: string
    class: string
    category: string
    productCategory?: string
    specs: string
    subject?: string
    quantity: number
    strength: number
    level: string
    term: string
    unit_price: number
  }
  const [productRows, setProductRows] = useState<ProductRow[]>([
    { id: '1', product: 'Abacus', class: '1', category: 'new Students', productCategory: undefined, specs: '', quantity: 1, strength: 0, level: 'L1', term: 'Term 1', unit_price: 0 }
  ])
  
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

  const normalizeCategoryForDropdown = (raw: any, fallback: string) => {
    const v = typeof raw === 'string' ? raw.trim() : ''
    if (!v) return fallback
    if (v === 'New Students') return 'new Students'
    if (v === 'Existing Students') return 'Old Students'
    if (v === 'Both') return 'NA'
    if (v === 'New School') return 'new Students'
    if (v === 'Existing School') return 'Old Students'
    return categoryOptions.includes(v) ? v : fallback
  }
  const { productNames: availableProducts, getProductLevels, getDefaultLevel, getProductSpecs, getProductSubjects, getProductCategories, hasProductCategories, hasProductSubjects, hasProductSpecs } = useProducts()

  /** Map Create Sale / DcOrder / DC product lines into Closed Sales rows without mixing quantity ↔ strength. */
  const mapSourceProductToRow = (p: any, idx: number, schoolType?: string): ProductRow => {
    const originalProduct = p.product_name || p.product || 'Abacus'
    const skuCategories = getProductCategories(originalProduct)
    const rawSku = p.productCategory || p.category || ''
    const normalizedSku = String(rawSku).trim()
    const matchedSku =
      skuCategories.includes(normalizedSku)
        ? normalizedSku
        : skuCategories.find((c) => c.toLowerCase() === normalizedSku.toLowerCase())

    const quantityNum =
      p.quantity !== undefined && p.quantity !== null && p.quantity !== ''
        ? Number(p.quantity)
        : 1
    const strengthNum =
      p.strength !== undefined && p.strength !== null && p.strength !== ''
        ? Number(p.strength)
        : 0

    return {
      id: String(idx + 1),
      product: originalProduct,
      class: p.class || '1',
      category: normalizeCategoryForDropdown(
        p.category,
        schoolType === 'Existing' ? 'Old Students' : 'new Students'
      ),
      productCategory: matchedSku || undefined,
      specs: p.specs || 'Regular',
      subject: p.subject || undefined,
      quantity: Number.isFinite(quantityNum) && quantityNum >= 0 ? quantityNum : 1,
      strength: Number.isFinite(strengthNum) && strengthNum >= 0 ? strengthNum : 0,
      level: p.level || getDefaultLevel(originalProduct || 'Abacus'),
      term: resolveExistingProductTerm(p),
      unit_price: Number(p.unit_price) || Number(p.price) || 0,
    }
  }
  
  // Get available levels for a specific product, default to L1 if product not found
  const getAvailableLevels = (product: string): string[] => {
    return getProductLevels(product)
  }

  const load = async () => {
    setLoading(true)
    try {
      // Try multiple statuses that might indicate closed deals
      // First try 'completed', then try all statuses to see what we have
      let data: DcOrder[] = []
      try {
        // Get all statuses in parallel for better performance with reduced timeout
        // Note: API returns paginated response { data: [...], pagination: {...} }
        const apiCallWithTimeout = (url: string, timeout = 8000) => {
          return Promise.race([
            apiRequest<any>(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ])
        }
        
        // Closed Sales = DcOrders currently awaiting raise/accept only.
        // Do NOT include saved (My Clients), completed (past stage), or later pipeline stages.
        const [dcRequestedRes, dcAcceptedRes] = await Promise.all([
          apiCallWithTimeout(`/dc-orders?status=dc_requested&limit=500`),
          apiCallWithTimeout(`/dc-orders?status=dc_accepted&limit=500`),
        ])
        const dcRequestedArray = Array.isArray(dcRequestedRes) ? dcRequestedRes : (dcRequestedRes?.data || [])
        const dcAcceptedArray = Array.isArray(dcAcceptedRes) ? dcAcceptedRes : (dcAcceptedRes?.data || [])
        
        console.log('📊 Loaded DcOrders for Closed Sales:', {
          dc_requested: dcRequestedArray.length,
          dc_accepted: dcAcceptedArray.length
        })
        console.log('📋 dc_requested items:', dcRequestedArray.map((d: any) => ({
          id: d._id,
          school_name: d.school_name,
          status: d.status,
          updatedAt: d.updatedAt || d.updated_at
        })))
        
        data = [...dcRequestedArray, ...dcAcceptedArray].filter((d: any) =>
          isClosedSalesOrderStatus(d.status)
        )
      } catch (e) {
        // If no completed deals, try getting all deals and filter client-side
        console.log('No completed deals found, trying all deals...')
        try {
          const allDealsRes = await Promise.race([
            apiRequest<any>(`/dc-orders?limit=500`),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 8000)
            )
          ])
          // Extract data array from paginated response or use direct array
          const dealsArray = Array.isArray(allDealsRes) ? allDealsRes : (allDealsRes?.data || [])
          // Closed Sales stage only — never Pending/Completed/My Clients
          data = dealsArray.filter((d: any) => isClosedSalesOrderStatus(d.status))
        } catch (timeoutError) {
          console.warn('Timeout loading all deals, using empty array')
          data = []
        }
      }
      
      // Closed Sales = only after Executive Request DC (DcOrder status dc_requested / dc_accepted).
      // Do NOT merge Closed leads here — closing a lead / converting to client must stay in
      // Executive My Clients until Request DC; otherwise sales jump into Closed Sales too early.
      // Do NOT merge Create Sale DCs (status=created) — those stay on Create Sale / Follow-up,
      // not Closed Sales.
      
      console.log('Loaded closed deals:', data)
      console.log('First deal sample:', data[0])
      
      // Load existing DCs for all deals efficiently (fetch only DCs for deals we have)
      const dcMap: Record<string, DC> = {}
      try {
        // Only fetch DCs if we have deals to check
        if (data.length > 0) {
          // Fetch DCs with a reasonable limit - only for deals we actually have
          // This is much more efficient than fetching 10000 DCs
          const dealIds = data.filter((d: any) => !d.isLead).map((d: any) => d._id)
          const leadIds = data.filter((d: any) => d.isLead).map((d: any) => d._id)
          
          // Fetch DCs with timeout and reasonable limit
          // Also fetch Term 2 DCs (scheduled_for_later) that might be split from original DCs
          const [allDCsRes, term2DCsRes] = await Promise.all([
            Promise.race([
            apiRequest<any>(`/dc?limit=2000`),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), 8000)
            )
            ]),
            Promise.race([
              apiRequest<any>(`/dc?status=scheduled_for_later&limit=500`),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), 8000)
              )
            ]).catch(() => ({ data: [] })) // Don't fail if this query fails
          ])
          const allDCsArray = Array.isArray(allDCsRes) ? allDCsRes : (allDCsRes?.data || [])
          const term2DCsArray = Array.isArray(term2DCsRes) ? term2DCsRes : (term2DCsRes?.data || [])
          
          console.log('📦 Loaded DCs:', {
            all: allDCsArray.length,
            term2_split: term2DCsArray.length
          })
        
          // Build map for DcOrders - prioritize Term 1 DCs (not Term 2) for Closed Sales display
          dealIds.forEach((dealId: string) => {
            // Find all DCs linked to this DcOrder
            const relatedDCs = allDCsArray.filter((dc: any) => {
              const dcOrderId = dc.dcOrderId?._id || dc.dcOrderId
              return dcOrderId === dealId || (typeof dcOrderId === 'string' && dcOrderId === dealId)
            })
            
            if (relatedDCs.length > 0) {
              // If there are multiple DCs (split case), prioritize Term 1 DC (not scheduled_for_later)
              // Term 1 DCs have status like 'pending_dc', 'dc_requested', etc.
              // Term 2 DCs have status 'scheduled_for_later'
              const term1DC = relatedDCs.find((dc: any) => dc.status !== 'scheduled_for_later')
              const term2DC = relatedDCs.find((dc: any) => dc.status === 'scheduled_for_later')
              
              if (term1DC) {
                // Use Term 1 / My Clients DC for Closed Sales only
                dcMap[dealId] = term1DC
                console.log(`✅ Found Term 1 DC for DcOrder ${dealId}:`, term1DC._id, `(status: ${term1DC.status})`)
                if (term2DC) {
                  console.log(`   Also has Term 2 DC:`, term2DC._id, `(will appear in Term-Wise DC)`)
                }
              } else {
                console.log(`⚠️ No My Clients DC for Closed Sales DcOrder ${dealId}`)
              }
            }
          })
          
          // Build map for Leads
          leadIds.forEach((leadId: string) => {
            const relatedDC = allDCsArray.find((dc: any) => {
              const dcOrderId = dc.dcOrderId?._id || dc.dcOrderId
              const saleId = dc.saleId?._id || dc.saleId
              return dcOrderId === leadId || 
                     (typeof dcOrderId === 'string' && dcOrderId === leadId) ||
                     saleId === leadId ||
                     (typeof saleId === 'string' && saleId === leadId)
            })
            if (relatedDC) {
              dcMap[leadId] = relatedDC
            }
          })
        }
        
        setDealDCs(dcMap)
        console.log('Loaded DCs for deals:', Object.keys(dcMap).length, 'DCs found')

        data = data.filter((deal: any) => {
          if (deal.isLead) return true
          return isClosedSalesOrderStatus(deal.status)
        })
      } catch (e) {
        console.warn('Failed to load DCs:', e)
        // Continue without DCs - they're optional
      }
      
      // Ensure all deals have proper structure
      const normalizedData = data.map((deal: any) => {
        // Handle assigned_to - preserve populated object if it exists
        let assignedTo = deal.assigned_to || deal.assignedTo
        
        console.log('Processing deal:', deal.school_name)
        console.log('  - assigned_to raw:', assignedTo)
        console.log('  - assigned_to type:', typeof assignedTo)
        
        if (assignedTo) {
          if (typeof assignedTo === 'object' && assignedTo !== null && '_id' in assignedTo) {
            // Already populated, keep it
            console.log('  - Keeping populated object:', assignedTo)
            assignedTo = assignedTo
          } else if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
            // It's just an ID string - try to fetch employee name
            console.log('  - It\'s a string ID, will try to get from API')
            // Keep it as is for now, the getOne API should populate it
            assignedTo = { _id: assignedTo, name: 'Loading...' }
          } else {
            console.log('  - assigned_to is invalid, setting to undefined')
            assignedTo = undefined
          }
        } else {
          console.log('  - No assigned_to found')
          assignedTo = undefined
        }
        
        return {
          ...deal,
          school_name: deal.school_name || deal.schoolName || '',
          school_code: deal.school_code || deal.schoolCode || '',
          contact_person: deal.contact_person || deal.contactPerson || '',
          contact_mobile: deal.contact_mobile || deal.contactMobile || deal.mobile || '',
          zone: deal.zone || '',
          location: deal.location || deal.address || '',
          address: deal.address || deal.location || '',
          products: deal.products || [],
          assigned_to: assignedTo,
          school_type: deal.school_type || deal.schoolType || '',
          dc_code: deal.dc_code || deal.dcCode || '',
          remarks: deal.remarks || '',
          cluster: deal.cluster || '',
          pod_proof_url: deal.pod_proof_url || deal.podProofUrl || null,
        }
      })
      
      // Sort: dc_requested items first (by updatedAt), then others by creation date (most recent first)
      const sortedData = normalizedData.sort((a: any, b: any) => {
        const aIsRequested = a.status === 'dc_requested'
        const bIsRequested = b.status === 'dc_requested'
        
        // If one is dc_requested and the other isn't, prioritize dc_requested
        if (aIsRequested && !bIsRequested) return -1
        if (!aIsRequested && bIsRequested) return 1
        
        // If both are dc_requested, sort by updatedAt (most recent first)
        if (aIsRequested && bIsRequested) {
          const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime()
          const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime()
          return dateB - dateA
        }
        
        // Otherwise, sort by creation date (most recent first)
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA
      })
      
      // Remove duplicates based on school_name + contact_mobile
      // BUT: For split DCs (Term 1 and Term 2), allow both entries to appear separately
      // Prioritize: dc_requested > dc_accepted > other statuses
      // Keep the most recent entry (already sorted, so first occurrence is most recent)
      const seen = new Map<string, DcOrder>()
      const uniqueData: DcOrder[] = []
      
      for (const item of sortedData) {
        // Create a unique key from school_name and contact_mobile (case-insensitive)
        const schoolName = (item.school_name || '').toLowerCase().trim()
        const contactMobile = (item.contact_mobile || '').trim()
        
        // Check if this is a split DC (has dcRequestData.isSplit or term2DCId)
        const dcRequestData = (item as any).dcRequestData || {}
        const isSplit = dcRequestData.isSplit || dcRequestData.term2DCId
        
        // For split DCs, determine if this is Term 1 or Term 2 entry
        // Priority: Check dcRequestData.productDetails (most recent request)
        // Fallback: Check item.products (from initial split)
        let isTerm2Entry = false
        if (isSplit) {
          // First check dcRequestData.productDetails (what was requested most recently)
          if (dcRequestData.productDetails && Array.isArray(dcRequestData.productDetails) && dcRequestData.productDetails.length > 0) {
            const allTerm2 = dcRequestData.productDetails.every((p: any) => (p.term || 'Term 1') === 'Term 2')
            const hasTerm1 = dcRequestData.productDetails.some((p: any) => (p.term || 'Term 1') === 'Term 1' || p.term === 'Both')
            // If all products are Term 2 and no Term 1 products, this is the Term 2 entry
            isTerm2Entry = allTerm2 && !hasTerm1
          } 
          // If dcRequestData doesn't have productDetails or it's empty, check item.products
          // This handles the case where Term 1 DC was requested first (products array has Term 1)
          else if (item.products && Array.isArray(item.products) && item.products.length > 0) {
            const hasTerm2Only = item.products.every((p: any) => (p.term || 'Term 1') === 'Term 2')
            const hasTerm1 = item.products.some((p: any) => (p.term || 'Term 1') === 'Term 1' || p.term === 'Both')
            // If all products are Term 2 and no Term 1 products, this is the Term 2 entry
            isTerm2Entry = hasTerm2Only && !hasTerm1
          }
          // If we have term2DCId, this might be the Term 1 entry (Term 2 DC exists separately)
          // But we need to check products to be sure
        }
        
        // Term-Wise / Term 2 DCs belong on Clients → Term Wise DC, not Closed Sales.
        if (isSplit && isTerm2Entry) {
          continue
        }

        const uniqueKey = `${schoolName}|${contactMobile}`
        
        // Only add if we haven't seen this combination before
        if (!seen.has(uniqueKey)) {
          seen.set(uniqueKey, item)
          uniqueData.push(item)
          if (isSplit) {
            console.log(`✅ Added ${isTerm2Entry ? 'Term 2' : 'Term 1'} split DC entry: ${item.school_name} - ${item.contact_mobile}`)
          }
        } else {
          // Check if the new item has a higher priority status than the existing one
          const existing = seen.get(uniqueKey)!
          const existingPriority = existing.status === 'dc_requested' ? 3 : 
                                   existing.status === 'dc_accepted' ? 2 : 
                                   existing.status === 'Closed' ? 0 : 1
          const newPriority = item.status === 'dc_requested' ? 3 : 
                              item.status === 'dc_accepted' ? 2 : 
                              item.status === 'Closed' ? 0 : 1
          
          // Replace if new item has higher priority (dc_requested > dc_accepted > others > Closed)
          if (newPriority > existingPriority) {
            console.log(`Replacing duplicate with higher priority: ${item.school_name} - ${item.contact_mobile} (${existing.status} -> ${item.status})`)
            const index = uniqueData.findIndex(d => {
              const dSchoolName = (d.school_name || '').toLowerCase().trim()
              const dContactMobile = (d.contact_mobile || '').trim()
              return `${dSchoolName}|${dContactMobile}` === uniqueKey
            })
            if (index !== -1) {
              uniqueData[index] = item
              seen.set(uniqueKey, item)
            }
          } else {
            console.log(`Removing duplicate (lower priority): ${item.school_name} - ${item.contact_mobile} (${item.status} vs ${existing.status})`)
          }
        }
      }
      
      console.log(`Removed ${sortedData.length - uniqueData.length} duplicate entries`)
      
      // Final sort by creation date (most recent first) to ensure proper ordering
      const finalSorted = uniqueData.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA // Most recent first
      })
      
      setItems(finalSorted)
      console.log('Normalized deals:', finalSorted)
      console.log('First deal assigned_to:', finalSorted[0]?.assigned_to)
    } catch (e: any) {
      console.error('Failed to load closed deals:', e)
      const errorMessage = e?.message || 'Unknown error'
      // Provide more context if it's a filter error
      if (errorMessage.includes('filter is not a function')) {
        alert(`Error loading deals: The API returned invalid data format. Please check the server response.`)
      } else {
        alert(`Error loading deals: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Load employees for assignment dropdown
    const loadEmployees = async () => {
      try {
        const data = await apiRequest<any[]>('/employees?isActive=true')
        const list = Array.isArray(data) ? data : []
        setEmployees(list.map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' })).filter(e => e.name !== 'Unknown'))
      } catch (e) {
        console.error('Failed to load employees:', e)
      }
    }
    loadEmployees()
  }, [])

  const openRaiseDC = async (deal: DcOrder) => {
    try {
      // Closed Sales Raise DC is always the My Clients / Term 1 DC.
      // Term-Wise products stay on Clients → Term Wise DC.
      const existingDCForDeal = isTermWiseDcRecord(dealDCs[deal._id])
        ? undefined
        : dealDCs[deal._id]
      setExistingDC(existingDCForDeal || null)

      let fullDeal: DcOrder
      if ((deal as any).isLead) {
        fullDeal = deal
      } else {
        try {
          fullDeal = await apiRequest<DcOrder>(`/dc-orders/${deal._id}`)
        } catch (fetchError: any) {
          console.warn('Could not fetch full deal details, using list data:', fetchError?.message)
          fullDeal = deal
        }
      }
      console.log('Full deal data from API:', fullDeal)
      console.log('Existing DC for this deal:', existingDCForDeal)
      console.log('assigned_to from API:', fullDeal.assigned_to)
      console.log('assigned_to type:', typeof fullDeal.assigned_to)
      
      // Handle assigned_to - could be ObjectId string, populated object, or null/undefined
      let assignedTo = undefined
      
      // First check the fullDeal from API
      if (fullDeal.assigned_to) {
        if (typeof fullDeal.assigned_to === 'object' && fullDeal.assigned_to !== null && '_id' in fullDeal.assigned_to) {
          // Already populated object with _id
          if ('name' in fullDeal.assigned_to && fullDeal.assigned_to.name) {
            assignedTo = fullDeal.assigned_to
          } else {
            // Has _id but no name - might need to use from deal list
            assignedTo = deal.assigned_to || fullDeal.assigned_to
          }
        } else if (typeof fullDeal.assigned_to === 'string') {
          // It's an ObjectId string - try to get from the deal list (which should be populated)
          assignedTo = deal.assigned_to || { _id: fullDeal.assigned_to as string, name: 'Unknown' }
        }
      }
      
      // Fallback to deal's assigned_to from the list (which should be populated)
      if (!assignedTo && deal.assigned_to) {
        if (typeof deal.assigned_to === 'object' && deal.assigned_to !== null && '_id' in deal.assigned_to) {
          assignedTo = deal.assigned_to
        }
      }
      
      console.log('=== ASSIGNED TO DEBUG ===')
      console.log('fullDeal.assigned_to:', fullDeal.assigned_to)
      console.log('fullDeal.assigned_to type:', typeof fullDeal.assigned_to)
      console.log('deal.assigned_to:', deal.assigned_to)
      console.log('deal.assigned_to type:', typeof deal.assigned_to)
      console.log('Final processed assignedTo:', assignedTo)
      console.log('Has assigned employee?', !!assignedTo && typeof assignedTo === 'object' && '_id' in assignedTo && 'name' in assignedTo)
      
      // Normalize the deal data
      const normalizedDeal: DcOrder = {
        ...fullDeal,
        school_name: fullDeal.school_name || deal.school_name || '',
        school_type: fullDeal.school_type || deal.school_type || '',
        contact_person: fullDeal.contact_person || deal.contact_person || '',
        contact_mobile: fullDeal.contact_mobile || deal.contact_mobile || '',
        contact_person2: (fullDeal as any).contact_person2 || (deal as any).contact_person2 || '',
        contact_mobile2: (fullDeal as any).contact_mobile2 || (deal as any).contact_mobile2 || '',
        email: fullDeal.email || deal.email || '',
        address: fullDeal.address || deal.address || deal.location || '',
        location: fullDeal.location || deal.location || deal.address || '',
        zone: fullDeal.zone || deal.zone || '',
        cluster: fullDeal.cluster || deal.cluster || '',
        remarks: fullDeal.remarks || deal.remarks || '',
        dc_code: fullDeal.dc_code || deal.dc_code || '',
        products: fullDeal.products || deal.products || [],
        assigned_to: assignedTo,
        // Transport fields - check pendingEdit first, then main fields
        transport_name: fullDeal.pendingEdit?.transport_name || fullDeal.transport_name || deal.transport_name || '',
        transport_location: fullDeal.pendingEdit?.transport_location || fullDeal.transport_location || deal.transport_location || '',
        transportation_landmark: fullDeal.pendingEdit?.transportation_landmark || fullDeal.transportation_landmark || deal.transportation_landmark || '',
        pincode: fullDeal.pendingEdit?.pincode || fullDeal.pincode || deal.pincode || '',
      }
      
      setSelectedDeal(normalizedDeal)
      // Set selected employee if already assigned
      if (normalizedDeal.assigned_to && typeof normalizedDeal.assigned_to === 'object' && '_id' in normalizedDeal.assigned_to) {
        setSelectedEmployeeId(normalizedDeal.assigned_to._id)
      } else {
        setSelectedEmployeeId('')
      }

      const dcRequestData = (fullDeal as any).dcRequestData || {}
      if (dcRequestData.dcDate) {
        setDcDate(new Date(dcRequestData.dcDate).toISOString().split('T')[0])
      }
      if (dcRequestData.dcRemarks) setDcRemarks(dcRequestData.dcRemarks)
      if (dcRequestData.dcCategory) setDcCategory(dcRequestData.dcCategory)
      if (dcRequestData.dcNotes) setDcNotes(dcRequestData.dcNotes)

      let siblingRows: any[] = []
      let myClientsDcFromSiblings: DC | undefined
      const orderIdForSiblings = String(
        (existingDCForDeal as any)?.dcOrderId?._id ||
          (existingDCForDeal as any)?.dcOrderId ||
          fullDeal._id ||
          deal._id ||
          ''
      )
      if (orderIdForSiblings) {
        try {
          const related = await apiRequest<any>(
            `/dc?dcOrderId=${encodeURIComponent(orderIdForSiblings)}`
          )
          const relatedList = dcListFromResponse(related)
          myClientsDcFromSiblings = relatedList.find((r: any) => !isTermWiseDcRecord(r))
          siblingRows = relatedList
            .filter((r: any) => isTermWiseDcRecord(r))
            .flatMap((r: any) => (Array.isArray(r.productDetails) ? r.productDetails : []))
        } catch (e) {
          console.warn('Could not load Term-Wise sibling lines for Closed Sales Raise DC:', e)
        }
      }

      let dcForProducts = existingDCForDeal || myClientsDcFromSiblings
      if (isTermWiseDcRecord(dcForProducts)) {
        dcForProducts = myClientsDcFromSiblings
      }
      if (dcForProducts?._id && !isTermWiseDcRecord(dcForProducts)) {
        try {
          const loaded = await apiRequest<DC>(`/dc/${dcForProducts._id}`)
          if (loaded && !isTermWiseDcRecord(loaded)) {
            dcForProducts = loaded
            setExistingDC(loaded)
            setDcDate(loaded.dcDate ? new Date(loaded.dcDate).toISOString().split('T')[0] : '')
            if (loaded.dcRemarks) setDcRemarks(loaded.dcRemarks)
            if (loaded.dcCategory) setDcCategory(loaded.dcCategory)
            if (loaded.dcNotes) setDcNotes(loaded.dcNotes)
          }
        } catch (e) {
          console.warn('Could not load full DC for Closed Sales products:', e)
        }
      }
      if (isTermWiseDcRecord(dcForProducts)) {
        dcForProducts = undefined
      }
      const poProducts = resolveClosedSalesProductLines(fullDeal, dcForProducts, siblingRows)
      console.log('[DC-ASSOC] Closed Sales Raise products', {
        dcId: dcForProducts?._id,
        count: poProducts.length,
        total: poProducts.reduce((s: number, p: any) => s + productLineQty(p), 0),
        lines: poProducts.map((p: any) => ({
          product: p.product || p.productName || p.product_name,
          level: p.level,
          term: p.term,
          quantity: productLineQty(p),
        })),
      })

      const placeholderRow = {
        id: '1',
        product: 'Abacus',
        class: '1',
        category: normalizedDeal.school_type === 'Existing' ? 'Old Students' : 'new Students',
        specs: '',
        quantity: 1,
        strength: 0,
        level: 'L1',
        term: 'Term 1',
        unit_price: 0,
      }

      if (poProducts.length > 0) {
        setProductRows(
          poProducts.map((p: any, idx: number) =>
            mapSourceProductToRow(p, idx, normalizedDeal.school_type)
          )
        )
      } else {
        setProductRows([placeholderRow])
      }
      setDcDetailsErrors({})
      setOpenRaiseDCDialog(true)
      
      console.log('Normalized deal for modal:', normalizedDeal)
      console.log('Final assigned_to in normalized deal:', normalizedDeal.assigned_to)
    } catch (e: any) {
      console.error('Failed to load deal details:', e)
      // Fallback to using the deal data we have
      setSelectedDeal(deal)
      setOpenRaiseDCDialog(true)
      setDcDetailsErrors({})
      
      // Initialize form with deal data
      setDcDate('')
      setDcRemarks('')
      setDcCategory('')
      setDcNotes('')
      const fallbackLines = resolveClosedSalesProductLines(
        deal,
        isTermWiseDcRecord(dealDCs[deal._id]) ? undefined : dealDCs[deal._id]
      )
      if (fallbackLines.length > 0) {
        setProductRows(
          fallbackLines.map((p: any, idx: number) => mapSourceProductToRow(p, idx, deal.school_type))
        )
      } else {
        setProductRows([{
          id: '1',
          product: 'Abacus',
          class: '1',
          category: deal.school_type === 'Existing' ? 'Old Students' : 'new Students',
          specs: '',
          quantity: 1,
          strength: 0,
          level: 'L1',
          term: 'Term 1',
          unit_price: 0,
        }])
      }
      
      const errorMessage = e?.message || 'Unknown error'
      if (errorMessage.includes('Cannot connect to backend')) {
        toast.error('Cannot connect to backend server. Please check your connection or contact support.')
      } else if (errorMessage.includes('not found') || errorMessage.includes('DC not found')) {
        // Don't show warning for "not found" errors - this is expected for some deals
        console.log('Deal not found in API, using list data (this is normal for some deals)')
      } else {
        toast.warning(`Could not load full deal details: ${errorMessage}. Using available data.`)
      }
    }
  }

  const openViewLocation = (deal: DcOrder) => {
    setSelectedDeal(deal)
    setOpenLocationDialog(true)
  }

  /** DC Date + Category are marked required in the Raise DC UI (*). Remarks is optional.
   *  Super Admin Closed Sales also requires Contact Person 2 + Contact Mobile 2. */
  const validateDcDetailsFields = (): boolean => {
    const next: {
      dcDate?: string
      dcCategory?: string
      dcRemarks?: string
      contact_person2?: string
      contact_mobile2?: string
    } = {}
    if (!dcDate || !String(dcDate).trim()) {
      next.dcDate = 'DC Date is required.'
    }
    if (!dcCategory || !String(dcCategory).trim()) {
      next.dcCategory = 'DC Category is required.'
    }
    if (requireContact2) {
      const person2Check = validateContactPerson(selectedDeal?.contact_person2 || '', {
        required: true,
        label: 'Contact Person 2',
      })
      if (!person2Check.ok) next.contact_person2 = person2Check.message
      const mobile2Check = validateContactMobile(selectedDeal?.contact_mobile2 || '', {
        required: true,
      })
      if (!mobile2Check.ok) next.contact_mobile2 = mobile2Check.message
    }
    setDcDetailsErrors(next)
    const ok = Object.keys(next).length === 0
    if (!ok) {
      const messages = Object.values(next).filter(Boolean)
      toast.error(messages[0] || 'Please fill in all required fields.')
      // Scroll mandatory contact fields into view when they fail
      if (next.contact_person2 || next.contact_mobile2) {
        requestAnimationFrame(() => {
          document.getElementById('closed-sales-contact-person-2')?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        })
      }
    }
    return ok
  }

  /** Persist Contact Person 2 / Mobile 2 from Closed Sales (Super Admin required). */
  const closedSalesContact2Payload = () => {
    if (!selectedDeal) return {}
    const person2 = String(selectedDeal.contact_person2 || '').trim()
    const mobile2 = String(selectedDeal.contact_mobile2 || '').trim()
    return {
      contact_person2: person2,
      contact_mobile2: mobile2,
      ...(requireContact2 ? { validateClosedSalesContact2: true } : {}),
    }
  }

  const handleSubmitToManager = async () => {
    if (!selectedDeal) return

    if (!validateDcDetailsFields()) {
      return
    }

    // Check if employee is assigned - prioritize deal's assigned employee
    let employeeId = null
    
    // First, check if deal already has an assigned employee
    if (selectedDeal.assigned_to) {
      if (typeof selectedDeal.assigned_to === 'object' && '_id' in selectedDeal.assigned_to) {
        employeeId = selectedDeal.assigned_to._id
      } else if (typeof selectedDeal.assigned_to === 'string') {
        employeeId = selectedDeal.assigned_to
      }
    }
    
    // If no employee from deal, use the selected employee from dropdown (only if deal doesn't have one)
    if (!employeeId && selectedEmployeeId) {
      employeeId = selectedEmployeeId
    }

    // Only require employee assignment if deal truly doesn't have one
    if (!employeeId) {
      alert('Please assign an employee before submitting to Senior Coordinator')
      return
    }

    setSubmitting(true)
    try {
      // First, raise DC (creates or gets existing DC)
      const raisePayload: any = {
        dcOrderId: selectedDeal._id,
        dcDate: String(dcDate).trim(),
        dcRemarks: dcRemarks.trim() || undefined,
        dcCategory: String(dcCategory).trim(),
      }
      
      // Only include employeeId if deal doesn't already have one assigned (backend will use deal's assigned_to if available)
      if (!selectedDeal.assigned_to && employeeId) {
        raisePayload.employeeId = employeeId
      }

      // Calculate requested quantity from product rows (units ordered — not strength)
      const totalQuantity = productRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
      raisePayload.requestedQuantity = totalQuantity || 1
      
      // Include product details in payload
      raisePayload.productDetails = productRows.map(row => ({
        product: row.product,
        class: row.class,
        category: row.category,
        productCategory: row.productCategory || undefined,
        specs: row.specs || 'Regular',
        subject: row.subject || undefined,
        strength: Number(row.strength) || 0,
        quantity: Number(row.quantity) || 0,
        level: row.level,
        term: resolveExistingProductTerm(row),
        unit_price: Number(row.unit_price) || Number(row.price) || 0,
        price: Number(row.unit_price) || Number(row.price) || 0,
        total:
          (Number(row.quantity) || 0) *
          (Number(row.unit_price) || Number(row.price) || 0),
        closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
      }))

      // Set status to pending_dc when raising from Closed Sales
      // Status will only change to sent_to_manager when "Submit to Warehouse" is pressed in Pending DC page
      raisePayload.status = 'pending_dc'
      const isShortageCategory = (dcCategory || '').toLowerCase() === 'shortage'
      if (isShortageCategory) {
        raisePayload.dcType = 'shortage'
        raisePayload.parentDcId = existingDC?._id
        raisePayload.productDetails = raisePayload.productDetails
          .filter((p: any) => Number(p.quantity || p.strength || 0) > 0)
          .map((p: any) => ({
            ...p,
            shortageQuantity: Number(p.quantity || p.strength || 0),
            deliveredQuantity: 0,
          }))
      }

      let dc: DC
      
      // If DC exists, update it; otherwise create new one
      if (existingDC && !isTermWiseDcRecord(existingDC)) {
        // Update existing My Clients DC
        await apiRequest(`/dc/${existingDC._id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...raisePayload,
            requestedQuantity: totalQuantity || 1, // Explicitly set requestedQuantity
            financeRemarks: raisePayload.financeRemarks,
            splApproval: raisePayload.splApproval,
            dcDate: raisePayload.dcDate,
            dcRemarks: raisePayload.dcRemarks,
            dcCategory: raisePayload.dcCategory,
            productDetails: raisePayload.productDetails,
            status: 'pending_dc', // Set status to pending_dc
          }),
        })
        dc = existingDC
      } else {
        // Create new DC
        dc = await apiRequest<DC>(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(raisePayload),
        })
      }

      // Leave Closed Sales: DcOrder must no longer be dc_requested/dc_accepted
      await apiRequest(`/dc-orders/${selectedDeal._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'dc_sent_to_senior',
          ...closedSalesContact2Payload(),
        }),
      })

      alert(existingDC ? 'DC updated and sent to Senior Coordinator successfully! It will appear in Pending DC list.' : 'DC created and sent to Senior Coordinator successfully! It will appear in Pending DC list.')
      setOpenRaiseDCDialog(false)
      // Reload to refresh the DC map
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to submit to Senior Coordinator')
    } finally {
      setSubmitting(false)
    }
  }

  // Employee submits DC request (doesn't create DC, just requests it)
  const handleRequestDC = async () => {
    if (!selectedDeal) return

    if (!validateDcDetailsFields()) {
      return
    }

    // Check if employee is assigned - prioritize deal's assigned employee
    let employeeId = null
    
    // First, check if deal already has an assigned employee
    if (selectedDeal.assigned_to) {
      if (typeof selectedDeal.assigned_to === 'object' && '_id' in selectedDeal.assigned_to) {
        employeeId = selectedDeal.assigned_to._id
      } else if (typeof selectedDeal.assigned_to === 'string') {
        employeeId = selectedDeal.assigned_to
      }
    }
    
    // If no employee from deal, use the selected employee from dropdown (only if deal doesn't have one)
    if (!employeeId && selectedEmployeeId) {
      employeeId = selectedEmployeeId
    }

    // Only require employee assignment if deal truly doesn't have one
    if (!employeeId) {
      alert('Please assign an employee before requesting DC')
      return
    }

    setSaving(true)
    try {
      // Calculate requested quantity from product rows (units ordered — not strength)
      const totalQuantity = productRows.reduce((sum, row) => sum + (row.quantity || 0), 0)
      
      // Prepare DC request data to store in DcOrder
      const dcRequestData = {
        dcDate: dcDate || undefined,
        dcRemarks: dcRemarks || undefined,
        dcCategory: dcCategory || undefined,
        requestedQuantity: totalQuantity || 1,
        productDetails: productRows.map(row => ({
          product: row.product,
          class: row.class,
          category: row.category,
          productCategory: row.productCategory || undefined,
          specs: row.specs || 'Regular',
          subject: row.subject || undefined,
          strength: Number(row.strength) || 0,
          quantity: Number(row.quantity) || 0,
          level: row.level || getDefaultLevel(row.product || 'Abacus'),
          term: row.term || 'Term 1',
          unit_price: Number(row.unit_price) || Number(row.price) || 0,
          price: Number(row.unit_price) || Number(row.price) || 0,
          total:
            (Number(row.quantity) || 0) *
            (Number(row.unit_price) || Number(row.price) || 0),
          closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
        })),
        employeeId: employeeId,
      }

      // Update DcOrder with DC request data and set status to 'dc_requested'
      await apiRequest(`/dc-orders/${selectedDeal._id}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          status: 'dc_requested',
          dcRequestData: dcRequestData, // Store request data for coordinator to review
        }),
      })

      alert('DC request submitted successfully! Coordinator/Admin will review and approve it.')
      setOpenRaiseDCDialog(false)
      // Reload to refresh the list
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to submit DC request')
    } finally {
      setSaving(false)
    }
  }

  // Coordinator/Admin accepts DC request and creates/updates DC (but keeps it in Closed Sales for later updates)
  const handleAcceptDC = async () => {
    if (!selectedDeal) return

    if (!validateDcDetailsFields()) {
      return
    }

    setSaving(true)
    try {
      // Get DC request data from DcOrder (or use current form data if it's an accepted request being updated)
      const dcRequestData = (selectedDeal as any).dcRequestData || {}
      
      // Use current form values (already validated) — do not fall back to empty request data
      const finalDcDate = String(dcDate).trim()
      const finalDcRemarks = dcRemarks.trim() || undefined
      const finalDcCategory = String(dcCategory).trim()
      const finalDcNotes = dcNotes || dcRequestData.dcNotes || undefined
      
      // Determine product details: form rows first, then latest PO snapshot (incl. pending add).
      let finalProductDetails: any[] = []
      if (productRows.length > 0) {
        finalProductDetails = productRows.map(row => ({
        product: row.product,
        class: row.class,
        category: row.category,
        productCategory: row.productCategory || undefined,
        productName: row.productName || row.product || '',
        specs: row.specs || 'Regular',
        subject: row.subject || undefined,
          strength: Number(row.strength) || 0,
          quantity: Number(row.quantity) || 0,
          level: row.level && String(row.level).trim() !== '-' ? String(row.level).trim() : '',
          term: row.term || 'Term 1',
          unit_price: Number(row.unit_price) || Number(row.price) || 0,
          price: Number(row.unit_price) || Number(row.price) || 0,
          total:
            (Number(row.quantity) || 0) *
            (Number(row.unit_price) || Number(row.price) || 0),
          closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
        }))
      } else {
        const fallbackLines = resolveClosedSalesProductLines(
          selectedDeal,
          isTermWiseDcRecord(existingDC) ? undefined : existingDC
        )
        if (fallbackLines.length > 0) {
          finalProductDetails = fallbackLines.map((p: any) => ({
            product: p.product_name || p.product || p.productName || 'Abacus',
            class: p.class || '1',
            category: p.category || (selectedDeal?.school_type === 'Existing' ? 'Old Students' : 'new Students'),
            productCategory: p.productCategory || undefined,
            productName: p.product_name || p.product || p.productName || 'Abacus',
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            strength: Number(p.strength) || Number(p.quantity) || 0,
            quantity: Number(p.quantity) || Number(p.strength) || 0,
            level: p.level && String(p.level).trim() !== '-' ? String(p.level).trim() : '',
            term: p.term || 'Term 1',
            unit_price: Number(p.unit_price) || Number(p.price) || 0,
            price: Number(p.unit_price) || Number(p.price) || 0,
            total:
              (Number(p.quantity) || Number(p.strength) || 0) *
              (Number(p.unit_price) || Number(p.price) || 0),
            closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
          }))
        }
      }
      
      const finalRequestedQuantity = finalProductDetails.length > 0
        ? finalProductDetails.reduce((sum: number, p: any) => sum + (Number(p.quantity) || 0), 0)
        : 1
      
      // Prepare payload to create/update DC.
      // Accept must keep the sale on Closed Sales for later Update / Send to Senior.
      // Do NOT default to pending_dc (that is only for Send to Senior / Submit to Manager).
      const raisePayload: any = {
        dcOrderId: selectedDeal._id,
        dcDate: finalDcDate,
        dcRemarks: finalDcRemarks,
        dcCategory: finalDcCategory,
        requestedQuantity: finalRequestedQuantity,
        productDetails: finalProductDetails,
        status: 'created',
      }

      // Include employeeId from request data or deal
      if (dcRequestData.employeeId) {
        raisePayload.employeeId = dcRequestData.employeeId
      } else if (selectedDeal.assigned_to) {
        const employeeId = typeof selectedDeal.assigned_to === 'object' 
          ? selectedDeal.assigned_to._id 
          : selectedDeal.assigned_to
        if (employeeId) {
          raisePayload.employeeId = employeeId
        }
      }

      let dc: DC
      
      // If DC exists, update it; otherwise create new one
      if (existingDC && !isTermWiseDcRecord(existingDC)) {
        // Update existing My Clients DC
        await apiRequest(`/dc/${existingDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(raisePayload),
        })
        dc = existingDC
      } else {
        // Create new DC
        dc = await apiRequest<DC>(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(raisePayload),
        })
      }

      // Update DcOrder to Saved DC. Do not use status `saved` — that is My Clients.
      // Saved DC page loads GET /dc-orders?status=dc_approved. Keep DC document as `created`.
      await apiRequest(`/dc-orders/${selectedDeal._id}`, {
          method: 'PUT',
          body: JSON.stringify({
          status: 'dc_approved',
          workflowStage: 'ClosedSales',
          ...closedSalesContact2Payload(),
          dcRequestData: {
            dcDate: finalDcDate,
            dcRemarks: finalDcRemarks,
            dcNotes: finalDcNotes,
            dcCategory: finalDcCategory,
            requestedQuantity: finalRequestedQuantity,
            productDetails: finalProductDetails,
            employeeId: raisePayload.employeeId,
          },
        }),
      })

      alert('DC request accepted! It will appear in Saved DC. From there, send it to Senior Coordinator (Pending DC).')
      setOpenRaiseDCDialog(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to accept DC request')
    } finally {
      setSaving(false)
    }
  }

  // Coordinator/Admin sends DC request to Senior Coordinator (Pending DC)
  const handleSendToSeniorCoordinator = async () => {
    if (!selectedDeal) return

    if (!validateDcDetailsFields()) {
      return
    }

    // Validate that all product fields are filled
    if (productRows.length === 0) {
      alert('Please add at least one product before sending to Senior Coordinator')
      return
    }

    // Check each product row for required fields
    const invalidRows: string[] = []
    productRows.forEach((row, idx) => {
      const rowNum = idx + 1
      if (!row.product || row.product.trim() === '') {
        invalidRows.push(`Row ${rowNum}: Product is required`)
      }
      if (row.product && hasProductSpecs(row.product) && (!row.specs || row.specs.trim() === '')) {
        invalidRows.push(`Row ${rowNum}: Specs is required`)
      }
      if (!row.quantity || Number(row.quantity) <= 0) {
        invalidRows.push(`Row ${rowNum}: Quantity must be greater than 0`)
      }
      // Level is required only when the product has configured levels
      if (
        row.product &&
        getProductLevels(row.product).length > 0 &&
        (!row.level || row.level.trim() === '')
      ) {
        invalidRows.push(`Row ${rowNum}: Level is required`)
      }
      if (!row.term || row.term.trim() === '') {
        invalidRows.push(`Row ${rowNum}: Term is required`)
      }
    })

    if (invalidRows.length > 0) {
      alert('Please fill in all required fields:\n\n' + invalidRows.join('\n'))
      return
    }

    setSaving(true)
    try {
      // Get DC request data from DcOrder
      const dcRequestData = (selectedDeal as any).dcRequestData || {}
      
      // Prepare payload to create DC and submit to manager
      // Always use current productRows and form fields to ensure all changes are saved
      const raisePayload: any = {
        dcOrderId: selectedDeal._id, // Use DcOrder ID (will be resolved from term2DCId if needed)
        dcDate: String(dcDate).trim(),
        dcRemarks: dcRemarks.trim() || undefined,
        dcCategory: String(dcCategory).trim(),
        requestedQuantity: productRows.length > 0 
          ? productRows.reduce((sum, row) => sum + (row.quantity || 0), 0) || 1
          : (dcRequestData.requestedQuantity || 1),
        // Always use current productRows to save all edited product details
        productDetails: productRows.length > 0 
          ? productRows.map(row => ({
              product: row.product || '',
              class: row.class || '1',
              category: row.category || (selectedDeal?.school_type === 'Existing' ? 'Old Students' : 'new Students'),
              productCategory: row.productCategory || undefined,
          specs: row.specs || 'Regular',
          subject: row.subject || undefined,
          strength: Number(row.strength) || 0,
          quantity: Number(row.quantity) || 0,
          level: row.level || getDefaultLevel(row.product || 'Abacus'),
              term: row.term || 'Term 1',
              unit_price: Number(row.unit_price) || Number(row.price) || 0,
              price: Number(row.unit_price) || Number(row.price) || 0,
              total:
                (Number(row.quantity) || 0) *
                (Number(row.unit_price) || Number(row.price) || 0),
              closeLeadDestination: CLOSE_LEAD_DESTINATION.MY_CLIENT,
            }))
          : (dcRequestData.productDetails || []),
      }

      // Include employeeId from request data
      if (dcRequestData.employeeId) {
        raisePayload.employeeId = dcRequestData.employeeId
      }

      // Set status to pending_dc when raising from Closed Sales
      // Status will only change to sent_to_manager when "Submit to Warehouse" is pressed in Pending DC page
      raisePayload.status = 'pending_dc'

      // Create or update the My Clients DC only — never the Term-Wise DC
      let dc: DC
      if (existingDC && !isTermWiseDcRecord(existingDC)) {
        await apiRequest(`/dc/${existingDC._id}`, {
          method: 'PUT',
          body: JSON.stringify(raisePayload),
        })
        dc = existingDC
      } else {
        dc = await apiRequest<DC>(`/dc/raise`, {
          method: 'POST',
          body: JSON.stringify(raisePayload),
        })
      }

      // Update DcOrder status to 'dc_sent_to_senior' (removes from closed sales)
      await apiRequest(`/dc-orders/${selectedDeal._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'dc_sent_to_senior',
          ...closedSalesContact2Payload(),
        }),
      })

      alert('DC request sent to Senior Coordinator! It will appear in Pending DC list.')
      setOpenRaiseDCDialog(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to send to Senior Coordinator')
    } finally {
      setSaving(false)
    }
  }

  // Get products display string
  const getProductsDisplay = (deal: DcOrder) => {
    const dc = dealDCs[deal._id] as any
    const lines = resolveClosedSalesProductLines(deal, dc)
    if (!lines.length) return '-'
    return lines.map((p: any) => {
      const productName = p.product_name || p.product || 'Unknown'
      const qty = typeof p.quantity === 'number' ? p.quantity : Number(p.quantity) || 0
      const subject = typeof p.subject === 'string' && p.subject.trim() && p.subject !== '-'
        ? ` ${p.subject.trim()}`
        : ''
      const level = typeof p.level === 'string' && p.level.trim() && p.level !== '-'
        ? ` ${p.level.trim()}`
        : ''
      return `${productName}${subject}${level}${qty ? ` - ${qty}` : ''}`
    }).join(', ')
  }

  // Get unique zones and executives for dropdowns
  const uniqueZones = useMemo(() => {
    const zones = new Set<string>()
    items.forEach(item => {
      if (item.zone) zones.add(item.zone)
    })
    return Array.from(zones).sort()
  }, [items])

  const uniqueExecutives = useMemo(() => {
    const execs = new Set<string>()
    items.forEach(item => {
      if (item.assigned_to?.name) execs.add(item.assigned_to.name)
    })
    return Array.from(execs).sort()
  }, [items])

  // Filter items based on search criteria
  const filteredItems = useMemo(() => {
    let filtered = [...items]

    // Filter by school name
    if (searchSchoolName.trim()) {
      const searchLower = searchSchoolName.toLowerCase().trim()
      filtered = filtered.filter(item => 
        item.school_name?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by mobile
    if (searchMobile.trim()) {
      const searchLower = searchMobile.trim()
      filtered = filtered.filter(item => 
        item.contact_mobile?.includes(searchLower)
      )
    }

    // Filter by date range
    if (searchFromDate) {
      const fromDate = new Date(searchFromDate)
      fromDate.setHours(0, 0, 0, 0)
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt || item.created_at || 0)
        itemDate.setHours(0, 0, 0, 0)
        return itemDate >= fromDate
      })
    }

    if (searchToDate) {
      const toDate = new Date(searchToDate)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt || item.created_at || 0)
        return itemDate <= toDate
      })
    }

    // Filter by zone
    if (searchZone) {
      filtered = filtered.filter(item => item.zone === searchZone)
    }

    // Filter by executive
    if (searchExecutive) {
      filtered = filtered.filter(item => item.assigned_to?.name === searchExecutive)
    }

    // Filter by town
    if (searchTown.trim()) {
      const searchLower = searchTown.toLowerCase().trim()
      filtered = filtered.filter(item => {
        const location = item.location || item.address || ''
        return location.toLowerCase().includes(searchLower)
      })
    }

    // Sort by most recent date first
    return filtered.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at || 0).getTime()
      const dateB = new Date(b.createdAt || b.created_at || 0).getTime()
      return dateB - dateA // Most recent first
    })
  }, [items, searchSchoolName, searchMobile, searchFromDate, searchToDate, searchZone, searchExecutive, searchTown])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-6">Closed Leads List</h1>
      
      {/* Search/Filter Section */}
      <Card className="p-5 shadow-sm border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input 
            placeholder="By School Name" 
            value={searchSchoolName}
            onChange={(e) => setSearchSchoolName(e.target.value)}
          />
          <Input 
            placeholder="By Contact Mobile No" 
            value={searchMobile}
            onChange={(e) => setSearchMobile(e.target.value)}
          />
          <Input 
            type="date" 
            placeholder="From Date"
            value={searchFromDate}
            onChange={(e) => setSearchFromDate(e.target.value)}
          />
          <Input 
            type="date" 
            placeholder="To Date"
            value={searchToDate}
            onChange={(e) => setSearchToDate(e.target.value)}
          />
          <Select value={searchZone || 'all'} onValueChange={(value) => setSearchZone(value === 'all' ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Zone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {uniqueZones.map(zone => (
                <SelectItem key={zone} value={zone}>{zone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={searchExecutive || 'all'} onValueChange={(value) => setSearchExecutive(value === 'all' ? '' : value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Executive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Executives</SelectItem>
              {uniqueExecutives.map(exec => (
                <SelectItem key={exec} value={exec}>{exec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input 
            placeholder="By Town" 
            value={searchTown}
            onChange={(e) => setSearchTown(e.target.value)}
          />
          <Button 
            className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
            onClick={() => {
              // Reset all filters
              setSearchSchoolName('')
              setSearchMobile('')
              setSearchFromDate('')
              setSearchToDate('')
              setSearchZone('')
              setSearchExecutive('')
              setSearchTown('')
            }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto shadow-sm border-slate-200">
        {loading && <div className="p-6 text-slate-600">Loading...</div>}
        {!loading && filteredItems.length === 0 && <div className="p-6 text-slate-500">No closed deals found.</div>}
        {!loading && filteredItems.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-800">
                <th className="py-3 px-4 text-left font-semibold text-sm">Created On</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">School Type</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Zone</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Town</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">School Code</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">School Name</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Executive</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Mobile</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">Products</th>
                <th className="py-3 px-4 text-left font-semibold text-sm">PO</th>
                <th className="py-3 px-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((d) => (
                <tr key={d._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 text-slate-700">
                    {d.created_at ? new Date(d.created_at).toLocaleString() : 
                     d.createdAt ? new Date(d.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-700">{d.school_type || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.zone || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.location || d.address?.split(',')[0] || '-'}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium text-blue-700">{d.school_code || '-'}</td>
                  <td className="py-3 px-4 text-slate-700 font-medium">{d.school_name || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.assigned_to?.name || '-'}</td>
                  <td className="py-3 px-4 text-slate-700">{d.contact_mobile || '-'}</td>
                  <td className="py-3 px-4 text-slate-700 text-xs">{getProductsDisplay(d)}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      // Check for PO photo in pod_proof_url or in associated DC
                      const dc = dealDCs[d._id] as any
                      const poUrl = d.pod_proof_url || dc?.poPhotoUrl || dc?.poDocument
                      const poDisplayUrl = poUrl ? resolveUploadUrl(poUrl) : ''

                      if (poUrl) {
                        // Check if it's a PDF
                        const isPDF = poUrl.toLowerCase().endsWith('.pdf') || 
                                     poUrl.includes('application/pdf') ||
                                     (poUrl.startsWith('data:') && poUrl.includes('application/pdf'))
                        
                        if (isPDF) {
                          // Show PDF icon/button
                          return (
                            <div className="flex items-center justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setSelectedPOPhotoUrl(poDisplayUrl)
                                  setOpenPOPhotoDialog(true)
                                }}
                              >
                                View PO
                              </Button>
                            </div>
                          )
                        } else {
                          // Show image thumbnail
                          return (
                            <div className="flex items-center justify-center">
                              <img
                                src={poDisplayUrl}
                                alt="PO Document"
                                className="w-14 h-14 object-contain rounded border border-slate-200 cursor-pointer hover:opacity-75 hover:border-slate-400 transition-all shadow-sm bg-white p-1"
                                onClick={() => {
                                  setSelectedPOPhotoUrl(poDisplayUrl)
                                  setOpenPOPhotoDialog(true)
                                }}
                                title="Click to view full size"
                                onError={(e) => {
                                  // If image fails to load, show a button instead
                                  const target = e.currentTarget
                                  target.style.display = 'none'
                                  const parent = target.parentElement
                                  if (parent) {
                                    const button = document.createElement('button')
                                    button.className = 'text-xs text-slate-600 hover:text-slate-800 underline cursor-pointer px-2 py-1 border rounded'
                                    button.textContent = 'View PO'
                                    button.onclick = (ev) => {
                                      ev.preventDefault()
                                      setSelectedPOPhotoUrl(poDisplayUrl)
                                      setOpenPOPhotoDialog(true)
                                      return false
                                    }
                                    parent.appendChild(button)
                                  }
                                }}
                              />
                            </div>
                          )
                        }
                      } else {
                        return <span className="text-xs text-slate-400">-</span>
                      }
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1.5">
                      {/* Show Raise DC button for both DcOrders and closed leads */}
                      {(canRequestDC || canApproveDC) && (
                        <Button
                          size="sm"
                          variant={d.status === 'dc_accepted' ? 'default' : 'destructive'}
                          className={
                            d.status === 'dc_accepted' 
                              ? '!bg-blue-600 hover:!bg-blue-700 !text-white !shadow-sm !from-blue-600 !to-blue-700 hover:!from-blue-700 hover:!to-blue-800' 
                              : ''
                          }
                          onClick={() => openRaiseDC(d)}
                        >
                          {d.status === 'dc_requested' ? 'Raise DC' : d.status === 'dc_accepted' ? 'Update DC' : 'Raise DC'}
                        </Button>
                      )}
                      {!isManager && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-300 hover:bg-slate-50 text-slate-700"
                          onClick={() => openViewLocation(d)}
                        >
                          View Location
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Raise DC Modal */}
      <Dialog open={openRaiseDCDialog} onOpenChange={setOpenRaiseDCDialog}>
        <DialogContent 
          className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto bg-white border-slate-200 shadow-xl"
          showCloseButton={true}
        >
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xl font-semibold">
              {selectedDeal?.school_name || 'Client'} - {
                selectedDeal?.status === 'dc_requested' ? 'Raise DC' : 
                selectedDeal?.status === 'dc_accepted' ? 'Update DC' : 
                'Raise DC'
              }
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-1">
              {selectedDeal?.status === 'dc_requested' 
                ? 'Review DC request from employee. You can accept it (to update later) or send to Senior Coordinator.'
                : selectedDeal?.status === 'dc_accepted'
                ? 'Update DC details. You can save changes or submit to Senior Coordinator.'
                : canRequestDC 
                  ? 'Fill in DC details and submit request for Coordinator/Admin approval'
                  : 'Fill in DC details and submit to Manager'}
            </DialogDescription>
          </DialogHeader>
          {selectedDeal ? (
            <div className="space-y-6 py-6">
              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                  <strong>Debug:</strong> School: {selectedDeal.school_name || 'EMPTY'}, Contact: {selectedDeal.contact_person || 'EMPTY'}, Products: {selectedDeal.products?.length || 0}
                </div>
              )}
              {/* Lead Information and More Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Lead Information */}
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xl mb-2">Lead Information</h3>
                    <p className="text-sm text-slate-500">Client and contact details</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">School Type</Label>
                    <Input 
                      value={selectedDeal.school_type || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="School Type"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">School Name</Label>
                    <Input 
                      value={selectedDeal.school_name || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="School Name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">School Code</Label>
                    <Input 
                      value={selectedDeal.dc_code || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="School Code"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Contact Person Name</Label>
                    <Input 
                      value={selectedDeal.contact_person || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Contact Person Name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Contact Mobile</Label>
                    <Input 
                      value={selectedDeal.contact_mobile || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Contact Mobile"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Assigned To</Label>
                    {(() => {
                      // Check if deal has assigned employee - be more lenient with the check
                      const assignedTo = selectedDeal.assigned_to
                      
                      // Check if we have a valid assigned employee
                      let hasAssignedEmployee = false
                      let employeeName = ''
                      
                      if (assignedTo) {
                        if (typeof assignedTo === 'object' && assignedTo !== null) {
                          // It's an object - check if it has name or _id
                          if ('name' in assignedTo && assignedTo.name) {
                            hasAssignedEmployee = true
                            employeeName = String(assignedTo.name)
                          } else if ('_id' in assignedTo) {
                            // Has _id but might not have name - still consider it assigned
                            hasAssignedEmployee = true
                            employeeName = 'Employee (ID: ' + String(assignedTo._id) + ')'
                          }
                        } else if (typeof assignedTo === 'string') {
                          // It's a string ID - not ideal but if it exists, try to find name
                          hasAssignedEmployee = false // Will show dropdown but pre-select
                        }
                      }
                      
                      console.log('Modal - assignedTo:', assignedTo)
                      console.log('Modal - hasAssignedEmployee:', hasAssignedEmployee)
                      console.log('Modal - employeeName:', employeeName)
                      
                      if (hasAssignedEmployee && employeeName) {
                        // Show assigned employee name (read-only)
                        return (
                          <Input 
                            value={employeeName} 
                            disabled 
                            className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                            placeholder="Assigned To"
                          />
                        )
                      } else {
                        // Show dropdown if no employee is assigned
                        return (
                          <>
                            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} required>
                              <SelectTrigger className="bg-white text-slate-900 border-slate-200 h-11 text-sm">
                                <SelectValue placeholder="Select Employee *" />
                              </SelectTrigger>
                              <SelectContent>
                                {employees.length === 0 ? (
                                  <div className="px-2 py-1.5 text-sm text-slate-500">Loading employees...</div>
                                ) : (
                                  employees.map((emp) => (
                                    <SelectItem key={emp._id} value={emp._id}>
                                      {emp.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            {!selectedEmployeeId && (
                              <p className="text-xs text-red-500 mt-1">Please assign an employee to continue</p>
                            )}
                          </>
                        )
                      }
                    })()}
                  </div>
                </div>

                {/* More Information */}
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-slate-900 text-xl mb-2">More Information</h3>
                    <p className="text-sm text-slate-500">Additional location and details</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Town</Label>
                    <Input 
                      value={selectedDeal.location || selectedDeal.address?.split(',')[0] || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Town"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Address</Label>
                    <Textarea 
                      value={selectedDeal.address || selectedDeal.location || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 text-sm" 
                      rows={4} 
                      placeholder="Address"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Zone</Label>
                    <Input 
                      value={selectedDeal.zone || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Zone"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Cluster</Label>
                    <Input 
                      value={selectedDeal.cluster || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Cluster"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Remarks</Label>
                    <Textarea 
                      value={selectedDeal.remarks || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 text-sm" 
                      rows={3} 
                      placeholder="Remarks"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery and Address Section - Transport Details */}
              <div className="border-t border-slate-200 pt-6 mt-6">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 text-xl mb-2">Delivery and Address</h3>
                  <p className="text-sm text-slate-500">Transport details for this order</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Transport Name</Label>
                    <Input 
                      value={selectedDeal.transport_name || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Transport Name"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Transport Location</Label>
                    <Input 
                      value={selectedDeal.transport_location || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Transport Location"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Transportation Landmark</Label>
                    <Input 
                      value={selectedDeal.transportation_landmark || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Transportation Landmark"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Pincode</Label>
                    <Input 
                      value={selectedDeal.pincode || ''} 
                      disabled 
                      className="bg-slate-50 text-slate-900 border-slate-200 h-11 text-sm" 
                      placeholder="Pincode"
                    />
                  </div>
                </div>
              </div>

              {/* Products Table - Editable */}
              <div className="border-t border-slate-200 pt-8 mt-8">
                <div className="mb-6">
                  <div>
                    <Label className="text-xl font-bold text-slate-900">Products & Quantities</Label>
                    <p className="text-sm text-slate-500 mt-1">Product details and quantities</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-300">
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Product</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Class</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Category</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Product Category</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Specs</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Subject</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Quantity</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Level</th>
                        <th className="py-4 px-5 text-left text-slate-700 font-bold text-xs uppercase tracking-wider">Term</th>
                        <th className="py-4 px-5 text-center text-slate-700 font-bold text-xs uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productRows.map((row, idx) => (
                        <tr key={row.id} className="bg-white hover:bg-blue-50/30 transition-all duration-150 border-b border-slate-100">
                          <td className="py-4 px-5">
                            <Select
                              value={row.product}
                              onValueChange={(value) => {
                              const updated = [...productRows]
                                updated[idx].product = value
                                // Default level based on product
                                updated[idx].level = getDefaultLevel(value)
                                // Default product category if configured
                                if (hasProductCategories(value)) {
                                  const cats = getProductCategories(value)
                                  updated[idx].productCategory = cats[0] || ''
                                } else {
                                  updated[idx].productCategory = undefined
                                }
                                // Default specs based on product
                                const specs = getProductSpecs(value)
                                updated[idx].specs = specs[0] || ''
                                // Default subject if product has subjects
                                if (hasProductSubjects(value)) {
                                  const subjects = getProductSubjects(value)
                                  updated[idx].subject = subjects[0] || ''
                                } else {
                                  updated[idx].subject = undefined
                                }
                              setProductRows(updated)
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm bg-white border-slate-200">
                                <SelectValue placeholder="Select Product" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProducts.map((product) => (
                                  <SelectItem key={product} value={product}>
                                    {product}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-4 px-5">
                            <Input
                              value={row.class}
                              onChange={(e) => {
                              const updated = [...productRows]
                                updated[idx].class = e.target.value
                              setProductRows(updated)
                              }}
                              className="h-9 text-sm bg-white border-slate-200 w-20"
                              placeholder="Class"
                            />
                          </td>
                          <td className="py-4 px-5">
                            <Select
                              value={row.category}
                              onValueChange={(value) => {
                                const updated = [...productRows]
                                updated[idx].category = value
                                setProductRows(updated)
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-32">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categoryOptions.map(cat => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-4 px-5">
                        {hasProductCategories(row.product) ? (
                                  <Select
                                    value={row.productCategory?.trim() || ''}
                            onValueChange={(value) => {
                              const updated = [...productRows]
                                      updated[idx].productCategory = typeof value === 'string' ? value.trim() : value
                              setProductRows(updated)
                              }}
                          >
                            <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-32">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {getProductCategories(row.product).map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                          </td>
                          <td className="py-4 px-5">
                            {hasProductSpecs(row.product) ? (
                            <Select
                              value={row.specs || undefined}
                              onValueChange={(value) => {
                              const updated = [...productRows]
                                updated[idx].specs = value
                              setProductRows(updated)
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-36">
                                <SelectValue placeholder="Select Specs" />
                              </SelectTrigger>
                              <SelectContent>
                                {getProductSpecs(row.product).map((spec) => (
                                  <SelectItem key={spec} value={spec}>
                                    {spec}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            {hasProductSubjects(row.product) && getProductSubjects(row.product).length > 0 ? (
                              <Select
                              value={row.subject || ''}
                                onValueChange={(value) => {
                                const updated = [...productRows]
                                  updated[idx].subject = value
                                setProductRows(updated)
                              }}
                              >
                                <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-32">
                                  <SelectValue placeholder="Subject" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getProductSubjects(row.product).map((subj) => (
                                    <SelectItem key={subj} value={subj}>
                                      {subj}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <Input
                              type="number"
                              value={row.quantity || ''}
                              onChange={(e) => {
                                let value = e.target.value
                                // Remove leading zeros (but allow single '0')
                                if (value.length > 1) {
                                  value = value.replace(/^0+/, '') || '0'
                                }
                                // Convert to number, use 0 if empty
                                const numValue = value === '' ? 0 : Number(value)
                                const updated = [...productRows]
                                updated[idx].quantity = numValue
                                setProductRows(updated)
                              }}
                              onBlur={(e) => {
                                // Normalize on blur to remove any remaining leading zeros
                                const numValue = Number(e.target.value) || 0
                                if (numValue !== row.quantity) {
                                  const updated = [...productRows]
                                  updated[idx].quantity = numValue
                                  setProductRows(updated)
                                }
                              }}
                              className="h-9 text-sm bg-white border-slate-200 w-24"
                              min="0"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-4 px-5">
                            {row.product && getProductLevels(row.product).length > 0 ? (
                              <Select
                                value={row.level || getDefaultLevel(row.product)}
                                onValueChange={(value) => {
                                  const updated = [...productRows]
                                  updated[idx].level = value
                                  setProductRows(updated)
                                }}
                              >
                                <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-20">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {getProductLevels(row.product).map((level) => (
                                    <SelectItem key={level} value={level}>
                                      {level}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-4 px-5">
                            <Select
                              value={row.term || 'Term 1'}
                              onValueChange={(value) => {
                              const updated = [...productRows]
                                updated[idx].term = value
                              setProductRows(updated)
                              }}
                            >
                              <SelectTrigger className="h-9 text-sm bg-white border-slate-200 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Term 1">Term 1</SelectItem>
                                <SelectItem value="Term 2">Term 2</SelectItem>
                                <SelectItem value="Both">Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-4 px-5 text-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 w-9 p-0 rounded-full transition-all duration-200"
                                onClick={() => {
                                  setProductRows(productRows.filter((_, i) => i !== idx))
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="bg-gradient-to-r from-slate-100 to-slate-200 border-t-2 border-slate-400 font-bold">
                        <td colSpan={5} className="px-5 py-4 text-right">
                          <span className="text-slate-800 text-base">Grand Total:</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-slate-800 text-base">
                            {productRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)}
                          </span>
                        </td>
                        <td colSpan={4} className="px-5 py-4"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DC Details */}
              <div className="space-y-6 border-t border-slate-200 pt-8 mt-8">
                <div>
                  <h3 className="font-bold text-slate-900 text-xl mb-2">DC Details</h3>
                  <p className="text-sm text-slate-500">Enter delivery challan information</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-sm font-semibold mb-2.5 block text-slate-700">Contact Person 2 *</Label>
                    <Input
                      id="closed-sales-contact-person-2"
                      value={selectedDeal.contact_person2 || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setSelectedDeal((prev) => (prev ? { ...prev, contact_person2: value } : prev))
                        if (dcDetailsErrors.contact_person2) {
                          setDcDetailsErrors((prev) => {
                            const next = { ...prev }
                            delete next.contact_person2
                            return next
                          })
                        }
                      }}
                      required
                      className={`h-11 text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500 bg-white ${dcDetailsErrors.contact_person2 ? 'border-red-500' : ''}`}
                      placeholder="Contact Person 2"
                    />
                    {dcDetailsErrors.contact_person2 && (
                      <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.contact_person2}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2.5 block text-slate-700">Contact Mobile 2 *</Label>
                    <Input
                      id="closed-sales-contact-mobile-2"
                      value={selectedDeal.contact_mobile2 || ''}
                      onChange={(e) => {
                        const value = sanitizeMobileInput(e.target.value)
                        setSelectedDeal((prev) => (prev ? { ...prev, contact_mobile2: value } : prev))
                        if (dcDetailsErrors.contact_mobile2) {
                          setDcDetailsErrors((prev) => {
                            const next = { ...prev }
                            delete next.contact_mobile2
                            return next
                          })
                        }
                      }}
                      inputMode="numeric"
                      maxLength={10}
                      required
                      className={`h-11 text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500 bg-white ${dcDetailsErrors.contact_mobile2 ? 'border-red-500' : ''}`}
                      placeholder="10-digit mobile number"
                    />
                    {dcDetailsErrors.contact_mobile2 && (
                      <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.contact_mobile2}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2.5 block text-slate-700">DC Date *</Label>
                    <Input
                      type="date"
                      value={dcDate}
                      onChange={(e) => {
                        setDcDate(e.target.value)
                        if (dcDetailsErrors.dcDate) {
                          setDcDetailsErrors((prev) => {
                            const next = { ...prev }
                            delete next.dcDate
                            return next
                          })
                        }
                      }}
                      placeholder="mm/dd/yyyy"
                      className={`h-11 text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500 bg-white ${dcDetailsErrors.dcDate ? 'border-red-500' : ''}`}
                    />
                    {dcDetailsErrors.dcDate && (
                      <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcDate}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2.5 block text-slate-700">DC Category *</Label>
                    <Select
                      value={dcCategory}
                      onValueChange={(v) => {
                        setDcCategory(v)
                        if (dcDetailsErrors.dcCategory) {
                          setDcDetailsErrors((prev) => {
                            const next = { ...prev }
                            delete next.dcCategory
                            return next
                          })
                        }
                      }}
                    >
                      <SelectTrigger className={`h-11 text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500 bg-white ${dcDetailsErrors.dcCategory ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder="Select DC Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                        <SelectItem value="Full Year">Full Year</SelectItem>
                      </SelectContent>
                    </Select>
                    {dcDetailsErrors.dcCategory && (
                      <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcCategory}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2.5 block text-slate-700">DC Remarks</Label>
                    <Input
                      value={dcRemarks}
                      onChange={(e) => {
                        setDcRemarks(e.target.value)
                        if (dcDetailsErrors.dcRemarks) {
                          setDcDetailsErrors((prev) => {
                            const next = { ...prev }
                            delete next.dcRemarks
                            return next
                          })
                        }
                      }}
                      placeholder="Enter remarks"
                      className={`h-11 text-sm border-slate-200 hover:border-blue-400 focus:border-blue-500 focus:ring-blue-500 bg-white ${dcDetailsErrors.dcRemarks ? 'border-red-500' : ''}`}
                    />
                    {dcDetailsErrors.dcRemarks && (
                      <p className="text-xs text-red-600 mt-1">{dcDetailsErrors.dcRemarks}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <DialogFooter className="flex justify-between items-center border-t border-slate-200 pt-6 mt-4">
                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                    onClick={() => setOpenRaiseDCDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  {/* Employee: Show "Raise DC" button to request DC */}
                  {canRequestDC && selectedDeal?.status !== 'dc_requested' && selectedDeal?.status !== 'dc_accepted' && (
                  <Button
                      variant="destructive"
                      onClick={handleRequestDC}
                      disabled={saving || submitting}
                    >
                      {saving ? 'Submitting...' : 'Raise DC'}
                    </Button>
                  )}
                  
                  {/* Coordinator/Admin: Show "Accept" and "Send to Senior Coordinator" buttons for DC requests */}
                  {canApproveDC && selectedDeal?.status === 'dc_requested' && (
                    <>
                      <Button
                    variant="outline"
                        className="border-green-600 text-green-700 hover:bg-green-50 shadow-sm"
                        onClick={handleAcceptDC}
                        disabled={saving || submitting}
                      >
                        {saving ? 'Processing...' : 'Accept'}
                  </Button>
                      <Button
                        className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
                        onClick={handleSendToSeniorCoordinator}
                        disabled={submitting || saving}
                      >
                        {submitting ? 'Sending...' : 'Send to Senior Coordinator'}
                      </Button>
                    </>
                  )}
                  
                  {/* Coordinator/Admin: Show "Update" and "Send to Senior Coordinator" buttons for accepted DCs */}
                  {canApproveDC && selectedDeal?.status === 'dc_accepted' && (
                    <>
                  <Button
                    variant="default"
                        className="!bg-blue-600 hover:!bg-blue-700 !text-white !shadow-sm !from-blue-600 !to-blue-700 hover:!from-blue-700 hover:!to-blue-800"
                        onClick={handleAcceptDC}
                    disabled={saving || submitting}
                  >
                        {saving ? 'Updating...' : 'Update DC'}
                  </Button>
                  <Button
                    className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
                        onClick={handleSendToSeniorCoordinator}
                    disabled={submitting || saving}
                  >
                        {submitting ? 'Sending...' : 'Send to Senior Coordinator'}
                  </Button>
                    </>
                  )}
                  
                  {/* Coordinator/Admin: Show "Accept" and "Send to Senior Coordinator" buttons for other deals (not requested yet) */}
                  {canApproveDC && selectedDeal?.status !== 'dc_requested' && selectedDeal?.status !== 'dc_accepted' && (
                    <>
                  <Button
                    variant="outline"
                        className="border-green-600 text-green-700 hover:bg-green-50 shadow-sm"
                        onClick={handleAcceptDC}
                    disabled={saving || submitting}
                  >
                        {saving ? 'Processing...' : 'Accept'}
                  </Button>
                  <Button
                    className="bg-slate-700 hover:bg-slate-800 text-white shadow-sm"
                        onClick={handleSendToSeniorCoordinator}
                    disabled={submitting || saving}
                  >
                        {submitting ? 'Sending...' : 'Send to Senior Coordinator'}
                  </Button>
                    </>
                  )}
                </div>
              </DialogFooter>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              <p>Loading deal details...</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Location Modal */}
      <Dialog open={openLocationDialog} onOpenChange={setOpenLocationDialog}>
        <DialogContent className="sm:max-w-[600px] border-slate-200 shadow-xl">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xl font-semibold">View Location</DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-1">
              Location details for {selectedDeal?.school_name || 'this deal'}
            </DialogDescription>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Address</Label>
                <Textarea value={selectedDeal.address || selectedDeal.location || 'N/A'} disabled rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Zone</Label>
                  <Input value={selectedDeal.zone || '-'} disabled />
                </div>
                <div>
                  <Label>Location/Town</Label>
                  <Input value={selectedDeal.location || '-'} disabled />
                </div>
              </div>
              {selectedDeal.address && (
                <div>
                  <Label>Map</Label>
                  <div className="mt-2 p-4 bg-slate-100 rounded text-center text-sm text-slate-500 border border-slate-200">
                    Map view would be integrated here
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button 
              variant="outline" 
              className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm" 
              onClick={() => setOpenLocationDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Photo Modal */}
      <Dialog open={openPOPhotoDialog} onOpenChange={setOpenPOPhotoDialog}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw] max-h-[90vh] overflow-auto bg-white border-slate-200 shadow-xl">
          <DialogHeader className="pb-4 border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xl font-semibold">
              Purchase Order (PO) Document
            </DialogTitle>
            <DialogDescription className="text-slate-600 text-sm mt-1">
              View full-size PO document
            </DialogDescription>
          </DialogHeader>
          {selectedPOPhotoUrl && (() => {
            const displayUrl = resolveUploadUrl(selectedPOPhotoUrl)
            // Check if it's a PDF
            const isPDF = displayUrl.toLowerCase().endsWith('.pdf') || 
                         displayUrl.includes('application/pdf') ||
                         (selectedPOPhotoUrl.startsWith('data:') && selectedPOPhotoUrl.includes('application/pdf'))
            
            if (isPDF) {
              // Display PDF in iframe
              return (
                <div className="py-4 flex items-center justify-center bg-slate-50 rounded-lg">
                  <iframe
                    src={selectedPOPhotoUrl.startsWith('data:') ? selectedPOPhotoUrl : displayUrl}
                    className="w-full h-[70vh] rounded-lg shadow-lg border border-slate-200"
                    title="PO Document PDF"
                    style={{ minHeight: '500px' }}
                  />
                </div>
              )
            } else {
              // Display image
              return (
                <div className="py-4 flex items-center justify-center bg-slate-50 rounded-lg">
                  <img
                    src={selectedPOPhotoUrl.startsWith('data:') ? selectedPOPhotoUrl : displayUrl}
                    alt="PO Document Full Size"
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border border-slate-200"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                          <div class="text-center p-8">
                            <p class="text-red-600 mb-4">Failed to load document</p>
                            <a href="${displayUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 underline">
                              Open in new tab
                            </a>
                          </div>
                        `
                      }
                    }}
                  />
                </div>
              )
            }
          })()}
          <DialogFooter className="pt-4 border-t border-slate-200">
            <div className="flex gap-2 justify-between w-full">
              <Button
                variant="outline"
                className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                onClick={() => {
                  if (selectedPOPhotoUrl) {
                    // For data URLs, create a blob and open it
                    if (selectedPOPhotoUrl.startsWith('data:')) {
                      const byteString = atob(selectedPOPhotoUrl.split(',')[1])
                      const mimeString = selectedPOPhotoUrl.split(',')[0].split(':')[1].split(';')[0]
                      const ab = new ArrayBuffer(byteString.length)
                      const ia = new Uint8Array(ab)
                      for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i)
                      }
                      const blob = new Blob([ab], { type: mimeString })
                      const url = URL.createObjectURL(blob)
                      window.open(url, '_blank')
                    } else {
                      window.open(resolveUploadUrl(selectedPOPhotoUrl), '_blank')
                    }
                  }
                }}
              >
                Open in New Tab
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm"
                onClick={() => setOpenPOPhotoDialog(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}