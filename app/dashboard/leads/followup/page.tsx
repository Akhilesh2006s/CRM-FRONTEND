'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { apiRequest } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getCurrentUser } from '@/lib/auth'
import { useProducts } from '@/hooks/useProducts'
import { toast } from 'sonner'
import { ArrowLeft, MapPin, Edit, History, X, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { todayDateString } from '@/lib/todayDate'
import {
  formatFollowUpDate,
  isFollowUpDateOverdue,
  toFollowUpDatePayload,
} from '@/lib/followUpDate'
import {
  isFollowUpProductLineComplete,
  leadProductsToInterestedRows,
  normalizeLeadProductLineStatus,
} from '@/lib/leadProductsInterested'

type Lead = { 
  _id: string
  school_name?: string
  school_code?: string
  contact_person?: string
  contact_mobile?: string
  zone?: string
  status?: string
  priority?: string
  lead_status?: string
  follow_up_date?: string
  location?: string
  strength?: number
  createdAt?: string
  remarks?: string
  school_type?: string
  products?: Array<{
    product_name?: string
    product?: string
    term?: string
    status?: string
    strength?: number
    chance?: number
    quantity?: number
  }> | string
}

type ProductInterested = {
  product_name: string
  term: string
  status: string
  strength: string
  chance: string
}

/** Align product-line enums across Lead/DcOrder schemas */
const DEAL_PRODUCT_STATUS_ORDER = ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'] as const
const SCHOOL_LEAD_STATUSES = new Set(['Hot', 'Warm', 'Cold'])

function normalizeProductLineStatus(status?: string): string {
  const s = (status || '').trim()
  if (s === 'Management Not Met') return 'Not Met Management'
  return s
}

/** Strongest status among deal products (same ranking as follow-up snapshots) */
function deriveLeadPriorityFromDealProducts(products: { status?: string }[]): string | null {
  let best = ''
  let bestIdx = DEAL_PRODUCT_STATUS_ORDER.length
  for (const p of products) {
    const st = normalizeProductLineStatus(p.status)
    const i = (DEAL_PRODUCT_STATUS_ORDER as readonly string[]).indexOf(st)
    if (i !== -1 && i < bestIdx) {
      bestIdx = i
      best = st
    }
  }
  return best || null
}

/** Lead status on cards: school lead_status from Add New School, then legacy fields. */
function displayLeadDealPriority(lead: {
  priority?: string
  lead_status?: string
  products?: Lead['products']
}): string {
  const schoolLeadStatus = (lead.lead_status || '').trim()
  if (schoolLeadStatus) return schoolLeadStatus

  const legacyPriority = (lead.priority || '').trim()
  if (legacyPriority) return legacyPriority

  if (Array.isArray(lead.products) && lead.products.length > 0) {
    const derived = deriveLeadPriorityFromDealProducts(lead.products)
    if (derived) return derived
  }
  return 'Warm'
}

const HISTORY_SNAPSHOT_STATUSES = ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'] as const

/** Build `productsInterested`-shaped rows for synthetic history when API omits snapshots */
function formatUserDisplayName(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const u = user as { name?: string; firstName?: string; lastName?: string; email?: string }
  const name = (u.name || '').trim()
  if (name) return name
  const combined = [u.firstName, u.lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ')
  if (combined) return combined
  const email = (u.email || '').trim()
  return email || null
}

function resolveHistoryUpdatedByName(
  entry: { updatedBy?: { name?: string; firstName?: string; lastName?: string; email?: string } | string },
  leadDoc?: {
    assigned_to?: { name?: string; firstName?: string; lastName?: string; email?: string } | string
    created_by?: { name?: string; firstName?: string; lastName?: string; email?: string } | string
  },
): string | null {
  const fromEntry = formatUserDisplayName(entry.updatedBy)
  if (fromEntry) return fromEntry
  const fromAssigned = formatUserDisplayName(leadDoc?.assigned_to)
  if (fromAssigned) return fromAssigned
  const fromCreated = formatUserDisplayName(leadDoc?.created_by)
  if (fromCreated) return fromCreated
  return null
}

function leadProductsToHistorySnapshot(products: Lead['products']) {
  if (!Array.isArray(products)) return []
  return products
    .filter((p: any) => p && (p.product_name || p.product))
    .map((p: any) => {
      let status = normalizeLeadProductLineStatus(p.status) || String(p.status || '').trim() || 'Warm'
      if (!HISTORY_SNAPSHOT_STATUSES.includes(status as any)) status = 'Warm'
      return {
        product_name: String(p.product_name || p.product || '').trim(),
        term: String(p.term || 'Term 1').trim(),
        status,
        strength: Number(p.strength ?? p.quantity ?? 0) || 0,
        chance: Number(p.chance ?? 0) || 0,
      }
    })
}

export default function FollowupLeadsPage() {
  const router = useRouter()
  const currentUser = getCurrentUser()
  const { productNames: availableProductNames } = useProducts()
  const [leads, setLeads] = useState<Lead[]>([])
  const [allLeads, setAllLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<string[]>([])
  const [timeoutError, setTimeoutError] = useState(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20 // Show 20 leads per page
  
  // Filters
  const [zone, setZone] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  
  // Update Lead Modal
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [updateForm, setUpdateForm] = useState({
    follow_up_date: '',
    status: '',
    remarks: '',
    productsInterested: [] as ProductInterested[],
  })
  const [updating, setUpdating] = useState(false)
  
  // View History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyLead, setHistoryLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    loadLeads()
  }, []) // Only load once on mount - pagination is handled in applyFilters

  useEffect(() => {
    applyFilters()
  }, [allLeads, zone, schoolName, contactMobile, currentPage])

  const loadLeads = async () => {
    setLoading(true)
    setTimeoutError(false)
    
    // Set timeout for loading - reduced to 10 seconds for faster feedback
    const timeoutId = setTimeout(() => {
      setTimeoutError(true)
      setLoading(false)
      toast.error('Loading is taking longer than expected. Please check your connection or try refreshing.')
    }, 10000) // 10 second timeout
    
    try {
      if (!currentUser?._id) {
        toast.error('User not found')
        clearTimeout(timeoutId)
        return
      }

      // Fetch ALL leads assigned to current employee (not paginated) - we'll paginate after filtering
      // Use Promise.all for parallel requests
      const [leadsResponse, dcOrdersResponse] = await Promise.all([
        apiRequest<any>(`/leads?employee=${currentUser._id}&pipeline=followup&limit=500`).catch(err => {
          console.warn('Failed to fetch leads:', err)
          return { data: [], pagination: null }
        }),
        apiRequest<any>(`/dc-orders?assigned_to=${currentUser._id}&pipeline=followup&limit=500`).catch(err => {
          console.warn('Failed to fetch dc-orders:', err)
          return { data: [], pagination: null }
        })
      ])
      
      const allData = Array.isArray(leadsResponse) ? leadsResponse : (leadsResponse?.data || [])
      const dcOrders = Array.isArray(dcOrdersResponse) ? dcOrdersResponse : (dcOrdersResponse?.data || [])
      
      const CLOSED_FOLLOWUP_STATUSES = new Set([
        'saved', 'completed', 'closed', 'converted', 'client',
        'in_transit', 'dc_requested', 'dc_accepted', 'dc_approved', 'dc_sent_to_senior',
      ])
      const isOpenFollowUpStatus = (status?: string) => {
        const s = (status || '').toLowerCase()
        if (!s) return true
        if (CLOSED_FOLLOWUP_STATUSES.has(s)) return false
        return s === 'pending' || s === 'processing'
      }

      // Filter out closed/saved/completed leads from allData and ensure school_code is included
      const activeLeads = (Array.isArray(allData) ? allData : []).filter((lead: Lead) => {
        return isOpenFollowUpStatus(lead.status)
      }).map((lead: any) => {
        // First try to get school_code from the lead itself
        let schoolCode = lead.school_code || lead.schoolCode
        
        // If lead doesn't have school_code, try to find matching DcOrder by school_name and contact_mobile
        if (!schoolCode && dcOrders && dcOrders.length > 0) {
          const matchingOrder = dcOrders.find((order: any) => {
            const schoolMatch = (order.school_name || '').toLowerCase().trim() === (lead.school_name || '').toLowerCase().trim()
            const mobileMatch = (order.contact_mobile || '').trim() === (lead.contact_mobile || '').trim()
            return schoolMatch && mobileMatch && (order.school_code || order.dc_code)
          })
          
          if (matchingOrder) {
            schoolCode = matchingOrder.school_code || matchingOrder.dc_code
          }
        }
        
        return {
          ...lead,
          school_code: schoolCode,
        }
      })
      
      // Convert dc-orders to lead format and exclude closed/saved leads
      const leadsFromOrders: Lead[] = dcOrders
        .filter((order: any) => isOpenFollowUpStatus(order.status))
        .map((order: any) => {
          const mapped: Lead = {
          _id: order._id,
          school_name: order.school_name,
          school_code: order.school_code,
          contact_person: order.contact_person,
          contact_mobile: order.contact_mobile,
          zone: order.zone,
          status: order.status,
          follow_up_date: order.follow_up_date || order.estimated_delivery_date,
          location: order.location,
          strength: order.strength,
          createdAt: order.createdAt,
          remarks: order.remarks,
          school_type: order.school_type,
          products: Array.isArray(order.products) ? order.products : undefined,
          lead_status: order.lead_status,
          priority: order.priority,
          }
          return mapped
        })
      
      // Combine and filter followup leads
      const combinedLeads = [...activeLeads, ...leadsFromOrders]
      
      // Filter leads that need follow-up - exclude closed/saved/completed leads
      const followUpLeads = combinedLeads.filter((lead: Lead) => isOpenFollowUpStatus(lead.status))
      
      // Remove duplicates by _id
      const uniqueLeads = followUpLeads.filter((lead, index, self) =>
        index === self.findIndex((l) => l._id === lead._id)
      )
      
      setAllLeads(uniqueLeads)
      
      // Don't set pagination here - it will be set in applyFilters after filtering
      // Reset to page 1 if current page would be empty
      const totalFiltered = uniqueLeads.length
      const totalPagesFiltered = Math.ceil(totalFiltered / itemsPerPage)
      if (currentPage > totalPagesFiltered && totalPagesFiltered > 0) {
        setCurrentPage(1)
      }
      
      // Extract unique zones
      const uniqueZones = Array.from(new Set(uniqueLeads.map(l => l.zone).filter(Boolean))) as string[]
      setZones(uniqueZones.sort())
      
      clearTimeout(timeoutId)
    } catch (err: any) {
      clearTimeout(timeoutId)
      if (err.message?.includes('timeout') || err.message?.includes('Connection')) {
        setTimeoutError(true)
        toast.error('Connection timeout. Please check your internet connection and try again.')
      } else {
        toast.error('Failed to load followup leads')
      }
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...allLeads]

    if (zone && zone !== 'all') filtered = filtered.filter(l => l.zone?.toLowerCase().includes(zone.toLowerCase()))
    if (contactMobile) filtered = filtered.filter(l => l.contact_mobile?.includes(contactMobile))
    if (schoolName) filtered = filtered.filter(l => l.school_name?.toLowerCase().includes(schoolName.toLowerCase()))

    // Sort by createdAt descending so latest leads appear on top
    filtered.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })

    setLeads(filtered)
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return '-'
    }
  }

  /** Lead status badge on a history row (matches server resolveHistoryPriorityForResponse). */
  function resolveHistoryEntryLeadStatus(
    item: { priority?: string; productsInterested?: { status?: string }[] },
    lead?: { lead_status?: string; priority?: string }
  ): string {
    const stored = (item.priority || '').trim()
    const schoolStatus = (lead?.lead_status || '').trim()

    if (SCHOOL_LEAD_STATUSES.has(stored)) return stored
    if (SCHOOL_LEAD_STATUSES.has(schoolStatus)) return schoolStatus

    const rows = Array.isArray(item.productsInterested) ? item.productsInterested : []
    const fromProducts = deriveLeadPriorityFromDealProducts(rows)
    if (fromProducts && rows.length > 0) return fromProducts

    if (stored) return stored

    const legacy = (lead?.priority || '').trim()
    if (legacy) return legacy

    return 'Warm'
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority?.toLowerCase()) {
      case 'hot':
        return 'bg-red-100 text-red-800'
      case 'warm':
        return 'bg-orange-100 text-orange-800'
      case 'cold':
        return 'bg-blue-100 text-blue-800'
      case 'visit again':
        return 'bg-yellow-100 text-yellow-800'
      case 'not met management':
        return 'bg-blue-100 text-blue-800'
      case 'not interested':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const openUpdateModal = (lead: Lead) => {
    setSelectedLead(lead)
    // Clear form for creating a new follow-up entry (don't pre-fill with old data)
    setUpdateForm({
      follow_up_date: '',
      status: displayLeadDealPriority(lead), // Reflects per-product + deal priority
      remarks: '',
      productsInterested: leadProductsToInterestedRows(lead),
    })
    setUpdateModalOpen(true)
  }

  const closeUpdateModal = () => {
    setUpdateModalOpen(false)
    setSelectedLead(null)
    setUpdateForm({
      follow_up_date: '',
      status: '',
      remarks: '',
      productsInterested: [],
    })
  }

  const handleUpdateLead = async () => {
    if (!selectedLead) return
    
    // Validate all required fields
    if (!updateForm.follow_up_date || !updateForm.follow_up_date.trim()) {
      toast.error('Next Follow-up Date is required')
      return
    }
    if (updateForm.follow_up_date < todayDateString()) {
      toast.error('Follow-up date cannot be in the past')
      return
    }
    if (!updateForm.remarks || !updateForm.remarks.trim()) {
      toast.error('Remarks is required')
      return
    }

    const selectedProducts = updateForm.productsInterested.filter(
      (p) => p.product_name && p.product_name.trim()
    )
    if (selectedProducts.length === 0) {
      toast.error('Add at least one product in Products Interested')
      return
    }
    const incomplete = selectedProducts.find((p) => !isFollowUpProductLineComplete(p))
    if (incomplete) {
      if ((Number(incomplete.strength) || 0) <= 0 || (Number(incomplete.chance) || 0) <= 0) {
        toast.error(
          `Enter Strength and Chance % for "${incomplete.product_name}" (required for every product)`
        )
      } else if (incomplete.status === 'Hot' && Number(incomplete.chance) < 80) {
        toast.error(`Chance % for "${incomplete.product_name}" must be at least 80 when status is Hot`)
      } else if (incomplete.status === 'Warm' && Number(incomplete.chance) < 20) {
        toast.error(`Chance % for "${incomplete.product_name}" must be at least 20 when status is Warm`)
      } else {
        toast.error('Complete Strength and Chance % for each product')
      }
      return
    }
    
    setUpdating(true)
    try {
      // All fields are required, so include them all
      const validProducts = selectedProducts
        .map((p) => ({
          product_name: p.product_name.trim(),
          term: p.term || 'Term 1',
          status: normalizeLeadProductLineStatus(p.status) || p.status || 'Warm',
          strength: Number(p.strength) || 0,
          chance: Number(p.chance) || 0,
          important: false,
          quantity: Number(p.strength) || 0,
          unit_price: 0,
        }))

      const derivedPriority = deriveLeadPriorityFromDealProducts(validProducts)
      const schoolLeadStatus = (selectedLead.lead_status || '').trim()
      const payload: any = {
        follow_up_date: toFollowUpDatePayload(updateForm.follow_up_date),
        remarks: updateForm.remarks,
      }
      if (SCHOOL_LEAD_STATUSES.has(schoolLeadStatus)) {
        payload.lead_status = schoolLeadStatus
        payload.priority = schoolLeadStatus
      } else {
        payload.priority =
          derivedPriority || selectedLead.priority || updateForm.status || 'Warm'
      }

      payload.productsInterested = validProducts
      
      console.log('Updating lead with payload:', payload)
      
      // Try to update via dc-orders API first (since that's where history is tracked)
      let updated = false
      try {
        const response = await apiRequest(`/dc-orders/${selectedLead._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        console.log('Update response:', response)
        updated = true
      } catch (err: any) {
        console.log('dc-orders update failed, trying leads API:', err?.message)
        // If not found in dc-orders, try leads API
        try {
          await apiRequest(`/leads/${selectedLead._id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          })
          updated = true
        } catch (leadErr: any) {
          console.error('Both update attempts failed:', leadErr)
          throw leadErr
        }
      }
      
      if (updated) {
        toast.success('Follow-up created successfully!')
        closeUpdateModal()
        // Reload leads to get updated data
        await loadLeads()
      }
    } catch (err: any) {
      console.error('Update error:', err)
      toast.error(err?.message || 'Failed to update lead')
    } finally {
      setUpdating(false)
    }
  }

  const openHistoryModal = async (lead: Lead) => {
    setHistoryLead(lead)
    setHistoryModalOpen(true)
    setHistory([])
    
    // Fetch update history from API
    try {
      let historyData: any[] = []
      let fullDcOrder: any = null

      // Try to get history from dc-orders API first
      try {
        console.log('Fetching history for lead:', lead._id)
        const apiHistory = await apiRequest<any[]>(`/dc-orders/${lead._id}/history`)
        console.log('API response:', apiHistory)
        
        if (apiHistory && Array.isArray(apiHistory)) {
          historyData = apiHistory
          console.log('Fetched history from API:', historyData.length, 'entries')
          
          // Log each entry for debugging
          historyData.forEach((entry, index) => {
            console.log(`Entry ${index + 1}:`, {
              date: entry.updatedAt,
              priority: entry.priority,
              remarks: entry.remarks,
              followUp: entry.follow_up_date,
            })
          })
        } else {
          console.log('API returned non-array or empty:', apiHistory)
        }
      } catch (err: any) {
        console.error('Error fetching history from dc-orders:', err)
        console.log('Error details:', err?.message, err?.response)
        // If not found in dc-orders, try leads API (though it doesn't have history)
      }
      
      // Also try to get the full lead data which might have history embedded
      try {
        fullDcOrder = await apiRequest<any>(`/dc-orders/${lead._id}`)
        console.log('Full lead data:', fullDcOrder)
        if (fullDcOrder?.updateHistory && Array.isArray(fullDcOrder.updateHistory)) {
          console.log('Found history in full lead data:', fullDcOrder.updateHistory.length, 'entries')
          // Merge with existing history, avoiding duplicates
          const existingDates = new Set(historyData.map(h => new Date(h.updatedAt).getTime()))
          fullDcOrder.updateHistory.forEach((entry: any) => {
            const entryDate = new Date(entry.updatedAt).getTime()
            if (!existingDates.has(entryDate)) {
              historyData.push(entry)
              existingDates.add(entryDate)
            }
          })
        }
      } catch (err: any) {
        console.log('Could not fetch full lead data:', err?.message)
      }
      
      // If no history from API, add creation entry from current lead data
      const mergedForDisplay = {
        ...lead,
        ...(fullDcOrder || {}),
        products: fullDcOrder?.products ?? lead.products,
        lead_status: fullDcOrder?.lead_status ?? lead.lead_status,
        priority: fullDcOrder?.priority ?? lead.priority,
      }

      if (historyData.length === 0 && lead.createdAt) {
        console.log('No history found, adding creation entry')
        const creatorName = resolveHistoryUpdatedByName({}, mergedForDisplay)
        historyData.push({
          follow_up_date: lead.follow_up_date || null,
          remarks: lead.remarks || 'Lead created',
          priority: lead.lead_status || displayLeadDealPriority(lead),
          productsInterested: leadProductsToHistorySnapshot(lead.products),
          updatedAt: lead.createdAt,
          updatedBy: creatorName ? { name: creatorName } : undefined,
        })
      }
      
      // Sort by date descending (newest first)
      historyData.sort((a, b) => {
        const dateA = new Date(a.updatedAt || 0).getTime()
        const dateB = new Date(b.updatedAt || 0).getTime()
        return dateB - dateA
      })

      historyData = historyData.map((entry) => {
        const name = resolveHistoryUpdatedByName(entry, mergedForDisplay)
        return name ? { ...entry, updatedBy: { ...(entry.updatedBy || {}), name } } : entry
      })
      
      console.log('Final history data:', historyData.length, 'entries')
      setHistoryLead(mergedForDisplay as Lead)
      setHistory(historyData)
    } catch (err: any) {
      console.error('Failed to load history:', err)
      // Even on error, show current lead data as history
      if (lead.createdAt) {
        const creatorName = resolveHistoryUpdatedByName({}, lead)
        setHistory([{
          follow_up_date: lead.follow_up_date || null,
          remarks: lead.remarks || 'Lead created',
          priority: lead.lead_status || displayLeadDealPriority(lead),
          productsInterested: leadProductsToHistorySnapshot(lead.products),
          updatedAt: lead.createdAt,
          updatedBy: creatorName ? { name: creatorName } : undefined,
        }])
      } else {
        setHistory([])
      }
    }
  }

  const closeHistoryModal = () => {
    setHistoryModalOpen(false)
    setHistoryLead(null)
    setHistory([])
  }

  const handleEditDetails = (lead: Lead) => {
    // Navigate to edit page or open edit modal
    // For now, we'll navigate to a edit page
    router.push(`/dashboard/leads/edit/${lead._id}`)
  }

  const addInterestedProduct = () => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: [
        ...prev.productsInterested,
        { product_name: '', term: 'Term 1', status: 'Warm', strength: '', chance: '' },
      ],
    }))
  }

  const removeInterestedProduct = (index: number) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.filter((_, i) => i !== index),
    }))
  }

  const updateInterestedProduct = (
    index: number,
    field: keyof ProductInterested,
    value: string | number | boolean
  ) => {
    setUpdateForm((prev) => ({
      ...prev,
      productsInterested: prev.productsInterested.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads/add">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Followup Leads</h1>
          <p className="text-sm text-neutral-600 mt-1">View and manage your followup leads</p>
        </div>
      </div>

      <Card className="p-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Zone</label>
            <Select value={zone || undefined} onValueChange={(v) => setZone(v === 'all' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Zones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                {zones
                  .filter(z => z && z.trim() !== '')
                  .map((z) => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">School Name</label>
            <Input
              placeholder="Search school..."
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700 mb-1 block">Contact Mobile</label>
            <Input
              placeholder="Search mobile..."
              value={contactMobile}
              onChange={(e) => setContactMobile(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={loadLeads} className="w-full">
              Refresh
            </Button>
          </div>
        </div>

        {/* Lead Cards */}
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Loading followup leads...</div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {allLeads.length === 0 
              ? 'No followup leads found. Create leads to see them here.'
              : 'No leads match the current filters.'}
          </div>
        ) : (
          <div className="space-y-4">
            {timeoutError && (
              <Card className="p-6 bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <h3 className="font-semibold text-yellow-900">Loading Timeout</h3>
                    <p className="text-sm text-yellow-700">The request is taking longer than expected. Please check your connection and try again.</p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => {
                        setTimeoutError(false)
                        loadLeads()
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            
            {leads.map((lead) => (
              <Card key={lead._id} className="p-5 border border-neutral-200 hover:shadow-md transition-shadow">
                <div className="space-y-4">
                  {/* Header with School Name and Location */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-lg font-bold text-orange-600">
                          {lead.school_name || 'Unnamed School'}
                        </h3>
                      </div>
                      {lead.location && (
                        <div className="flex items-center gap-1 text-sm text-neutral-600">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span>{lead.location}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600 hover:text-purple-700"
                      onClick={() => {
                        router.push(`/dashboard/leads/close/${lead._id}`)
                      }}
                    >
                      Close Lead
                    </Button>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-neutral-600">Contact:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_person || '-'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-600">Mobile:</span>
                      <span className="ml-2 font-medium text-neutral-900">{lead.contact_mobile || '-'}</span>
                    </div>
                  </div>

                  {/* Lead Details */}
                  <div className="space-y-2 text-sm">
                    {lead.remarks && (
                      <div>
                        <span className="text-neutral-600">Remarks:</span>
                        <span className="ml-2 text-neutral-900">{lead.remarks}</span>
                      </div>
                    )}
                    {lead.follow_up_date && (
                      <div>
                        <span className="text-neutral-600">Follow Up Date:</span>
                        <span className={`ml-2 font-medium ${
                          isFollowUpDateOverdue(lead.follow_up_date) ? 'text-red-600' : 'text-neutral-900'
                        }`}>
                          {formatFollowUpDate(lead.follow_up_date)}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const interested = leadProductsToInterestedRows(lead)
                      if (interested.length === 0) return null
                      return (
                        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                          <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide mb-2">
                            Products interested
                          </p>
                          <ul className="space-y-1.5">
                            {interested.map((row, pi) => (
                              <li
                                key={`${row.product_name}-${pi}`}
                                className="flex flex-wrap items-center gap-2 text-sm"
                              >
                                <span className="font-medium text-neutral-900">{row.product_name}</span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-neutral-200">
                                  {row.status}
                                </span>
                                {Number(row.strength) > 0 && (
                                  <span className="text-xs text-neutral-600">Str {row.strength}</span>
                                )}
                                {Number(row.chance) > 0 && (
                                  <span className="text-xs text-neutral-600">{row.chance}%</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })()}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      onClick={() => handleEditDetails(lead)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Details
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                      onClick={() => openUpdateModal(lead)}
                    >
                      Create Follow-up
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={() => openHistoryModal(lead)}
                    >
                      <History className="w-4 h-4 mr-2" />
                      View History
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* Update Lead Modal - Modern Professional Design */}
      <Dialog open={updateModalOpen} onOpenChange={setUpdateModalOpen}>
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] p-0 gap-0 overflow-hidden shadow-2xl border-0 flex flex-col">
          {/* Elegant Header with Gradient */}
          <div className="shrink-0 bg-gradient-to-r from-purple-600 via-purple-700 to-indigo-700 px-6 py-5">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-white text-xl font-semibold tracking-tight">
                Create Follow-up
              </DialogTitle>
              <DialogDescription className="text-purple-100 text-sm">
                Log a new interaction and track your visit history
              </DialogDescription>
            </DialogHeader>
          </div>
          
          {/* Form Content with Professional Spacing */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 bg-gradient-to-b from-white to-neutral-50">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Follow-up Date *
                  </Label>
                  <Input
                    type="date"
                    min={todayDateString()}
                    className="h-11 bg-white border-neutral-300 focus:border-purple-500 focus:ring-purple-500/20 transition-all"
                    value={updateForm.follow_up_date}
                    onChange={(e) => setUpdateForm({ ...updateForm, follow_up_date: e.target.value })}
                    required
                  />
                  <p className="text-xs text-neutral-500">Past dates cannot be selected.</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                    Products Interested *
                  </Label>
                  <Button type="button" size="sm" variant="outline" onClick={addInterestedProduct}>
                    Add Product
                  </Button>
                </div>

                <div className="rounded-md border border-neutral-200 bg-white overflow-hidden">
                  {updateForm.productsInterested.length === 0 ? (
                    <p className="text-xs text-neutral-500 p-3">No products added yet.</p>
                  ) : (
                    <>
                      <div className="sticky top-0 z-10 grid grid-cols-[minmax(140px,2fr)_minmax(120px,1.4fr)_minmax(88px,1fr)_minmax(88px,1fr)_2.5rem] gap-3 text-xs font-medium text-neutral-500 px-3 py-2 border-b border-neutral-200 bg-white">
                        <span>Product</span>
                        <span>Status</span>
                        <span className="text-center">Strength</span>
                        <span className="text-center">Chance %</span>
                        <span></span>
                      </div>

                      <div
                        className="max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain p-3 space-y-2"
                        role="region"
                        aria-label="Products list"
                      >
                      {updateForm.productsInterested.map((product, index) => (
                        <div
                          key={`product-${index}`}
                          className="grid grid-cols-[minmax(140px,2fr)_minmax(120px,1.4fr)_minmax(88px,1fr)_minmax(88px,1fr)_2.5rem] gap-3 items-center"
                        >
                          <Select
                            value={product.product_name || undefined}
                            onValueChange={(v) => updateInterestedProduct(index, 'product_name', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProductNames.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                              {product.product_name && !availableProductNames.includes(product.product_name) && (
                                <SelectItem value={product.product_name}>{product.product_name}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <Select
                            value={product.status}
                            onValueChange={(v) => updateInterestedProduct(index, 'status', v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Hot">Hot</SelectItem>
                              <SelectItem value="Warm">Warm</SelectItem>
                              <SelectItem value="Visit Again">Visit Again</SelectItem>
                              <SelectItem value="Not Met Management">Not Met Management</SelectItem>
                              <SelectItem value="Not Interested">Not Interested</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-9 text-center bg-white"
                            placeholder="Qty *"
                            value={product.strength}
                            required
                            onChange={(e) =>
                              updateInterestedProduct(index, 'strength', e.target.value)
                            }
                          />
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="h-9 text-center bg-white"
                            placeholder="% *"
                            value={product.chance}
                            required
                            onChange={(e) =>
                              updateInterestedProduct(index, 'chance', e.target.value)
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-neutral-500 hover:text-red-600"
                            onClick={() => removeInterestedProduct(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      </div>
                    </>
                  )}
                </div>
                {updateForm.productsInterested.length > 8 && (
                  <p className="text-xs text-neutral-500">
                    Scroll inside the products list to view all {updateForm.productsInterested.length} products.
                  </p>
                )}
                <p className="text-xs text-neutral-500">
                  Required: add at least one product with Strength (quantity) and Chance % for each row.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Remarks *
                </Label>
                <Textarea
                  className="min-h-[100px] bg-white border-neutral-300 focus:border-purple-500 focus:ring-purple-500/20 resize-none transition-all"
                  placeholder="Enter your remarks about this interaction..."
                  required
                  value={updateForm.remarks}
                  onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-neutral-500">Provide details about your conversation or next steps</p>
              </div>
            </div>
          </div>
          
          {/* Professional Footer */}
          <div className="shrink-0 px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={closeUpdateModal}
              className="border-neutral-300 hover:bg-neutral-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateLead} 
              disabled={updating}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 px-6"
            >
              {updating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Follow-up'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View History Modal - Modern Professional Design */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-hidden p-0 gap-0 shadow-2xl border-0">
          {/* Elegant Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 px-6 py-5 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogHeader className="space-y-1">
                <DialogTitle className="text-white text-xl font-semibold tracking-tight flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Update History
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-sm">
                  Complete timeline of all interactions and updates
                </DialogDescription>
              </DialogHeader>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-blue-800/50 h-8 w-8 p-0 rounded-full"
                onClick={closeHistoryModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* History Content with Timeline Design */}
          <div className="overflow-y-auto max-h-[calc(85vh-140px)] bg-gradient-to-b from-white via-neutral-50/50 to-white">
            {history.length === 0 ? (
              <div className="text-center py-12 px-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                  <History className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No History Yet</h3>
                <p className="text-sm text-neutral-600 max-w-sm mx-auto">
                  Update history will appear here once you start recording follow-ups and interactions.
                </p>
              </div>
            ) : (
              <div className="px-6 py-6">
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-blue-200"></div>
                  
                  {/* History Items */}
                  <div className="space-y-6">
                    {history.map((item, index) => {
                      // Use a unique key for each entry
                      const entryKey = item._id || item.updatedAt || `entry-${index}`;
                      const leadStatus = resolveHistoryEntryLeadStatus(item, historyLead ?? undefined)
                      const priorityColors = {
                        Hot: 'bg-red-100 text-red-700 border-red-200',
                        Warm: 'bg-orange-100 text-orange-700 border-orange-200',
                        Cold: 'bg-blue-100 text-blue-700 border-blue-200',
                        'Visit Again': 'bg-yellow-100 text-yellow-700 border-yellow-200',
                        'Not Met Management': 'bg-blue-100 text-blue-700 border-blue-200',
                        'Not Interested': 'bg-gray-100 text-gray-700 border-gray-200',
                        Dropped: 'bg-gray-100 text-gray-700 border-gray-200',
                      }
                      const priorityDotColors = {
                        Hot: 'bg-red-500 ring-red-200',
                        Warm: 'bg-orange-500 ring-orange-200',
                        Cold: 'bg-blue-500 ring-blue-200',
                        'Visit Again': 'bg-yellow-500 ring-yellow-200',
                        'Not Met Management': 'bg-blue-500 ring-blue-200',
                        'Not Interested': 'bg-gray-500 ring-gray-200',
                        Dropped: 'bg-gray-500 ring-gray-200',
                      }
                      
                      return (
                        <div key={entryKey} className="relative pl-12">
                          {/* Timeline Dot */}
                          <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full ${priorityDotColors[leadStatus as keyof typeof priorityDotColors] || priorityDotColors.Hot} ring-4 ring-white flex items-center justify-center shadow-lg`}>
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          </div>
                          
                          {/* History Card */}
                          <div className="bg-white rounded-lg border border-neutral-200 shadow-sm hover:shadow-md transition-shadow p-5">
                            {/* Header with Date and lead status */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    {formatDateTime(item.updatedAt)}
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityColors[leadStatus as keyof typeof priorityColors] || priorityColors.Hot}`}>
                                    {leadStatus}
                                  </span>
                                </div>
                                {(() => {
                                  const updatedByName = resolveHistoryUpdatedByName(item, historyLead ?? undefined)
                                  if (!updatedByName) return null
                                  return (
                                    <p className="text-xs text-neutral-500">
                                      Updated by{' '}
                                      <span className="font-medium text-neutral-700">{updatedByName}</span>
                                    </p>
                                  )
                                })()}
                              </div>
                            </div>
                            
                            {/* Follow-up Date */}
                            {item.follow_up_date && (
                              <div className="mb-3 p-3 bg-blue-50 rounded-md border border-blue-100">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm font-medium text-blue-900">
                                    Next Follow-up: {formatFollowUpDate(item.follow_up_date)}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {/* Remarks */}
                            {item.remarks && (
                              <div className="mt-3">
                                <div className="flex items-start gap-2">
                                  <svg className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap flex-1">
                                    {item.remarks}
                                  </p>
                                </div>
                              </div>
                            )}

                            {Array.isArray(item.productsInterested) && item.productsInterested.length > 0 && (
                              <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                                <p className="text-xs font-semibold text-violet-900 uppercase tracking-wide mb-2">
                                  Product lead status
                                </p>
                                <ul className="space-y-2">
                                  {item.productsInterested.map((row: any, pi: number) => {
                                    const st = row.status === 'Management Not Met' ? 'Not Met Management' : row.status
                                    const badgeClass =
                                      priorityColors[st as keyof typeof priorityColors] || priorityColors.Warm
                                    return (
                                      <li
                                        key={`${row.product_name}-${pi}-${row.term || ''}`}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/80 px-3 py-2 border border-neutral-100"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <span className="text-sm font-medium text-neutral-900 truncate block">
                                            {row.product_name || 'Product'}
                                          </span>
                                          <span className="text-xs text-neutral-500">
                                            {[
                                              row.term ? row.term : null,
                                              Number(row.strength) > 0 ? `Strength ${row.strength}` : null,
                                              Number(row.chance) > 0 ? `${row.chance}% chance` : null,
                                            ]
                                              .filter(Boolean)
                                              .join(' · ') || '—'}
                                          </span>
                                        </div>
                                        <span
                                          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}
                                        >
                                          {st || 'Warm'}
                                        </span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Professional Footer */}
          <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 sticky bottom-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-neutral-500">
                {history.length > 0 ? `${history.length} ${history.length === 1 ? 'update' : 'updates'} recorded` : 'No updates yet'}
              </p>
              <Button 
                variant="outline" 
                onClick={closeHistoryModal}
                className="border-neutral-300 hover:bg-white"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagination Controls */}
      {!timeoutError && totalPages > 1 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600">
              Showing page {currentPage} of {totalPages} ({totalItems} total leads)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <div className="text-sm text-neutral-600 px-3">
                Page {currentPage} / {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

