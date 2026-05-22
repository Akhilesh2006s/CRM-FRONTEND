'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Pencil } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SCHOOL_TYPE_OPTIONS, loadZoneClusterOptions } from '@/lib/warehouseOptions'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProducts } from '@/hooks/useProducts'

type ProductDetail = {
  product: string
  class: string
  category: string
  specs: string
  subject?: string
  quantity: number // Requested quantity (read-only)
  strength?: number
  price?: number
  total?: number
  level?: string
  availableQuantity?: number // Available quantity in warehouse (from inventory, auto-filled)
  deliverableQuantity?: number // Final deliverable quantity (calculated)
  remainingQuantity?: number // Remaining in warehouse after delivery (Available - Deliverable)
}

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  level?: string
  specs?: string
  subject?: string
  currentStock: number
}

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
    school_type?: string
    address?: string
    location?: string
    transport_name?: string
    transport_location?: string
    transportation_landmark?: string
    pincode?: string
    contact_person?: string
    contact_mobile?: string
    zone?: string
    cluster_code?: string
  } | string
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  requestedQuantity?: number
  availableQuantity?: number
  deliverableQuantity?: number
  poPhotoUrl?: string
  managerId?: {
    _id: string
    name?: string
  }
  managerRequestedAt?: string
  productDetails?: ProductDetail[]
  dcDate?: string
  dcRemarks?: string
  dcCategory?: string
  dcNotes?: string
  contactPerson?: string
  contactMobile?: string
  zone?: string
  cluster?: string
  remarks?: string
  transport?: string
  lrNo?: string
  lrDate?: string
  boxes?: string
  transportArea?: string
  deliveryStatus?: string
}

export default function WarehouseDcAtWarehouse() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<DC[]>([])
  const [zones, setZones] = useState<string[]>([])
  const [clustersByZone, setClustersByZone] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [productRows, setProductRows] = useState<ProductDetail[]>([])
  const [dcDate, setDcDate] = useState('')
  const [dcRemarks, setDcRemarks] = useState('')
  const [dcCategory, setDcCategory] = useState('')
  const [dcNotes, setDcNotes] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [zone, setZone] = useState('')
  const [cluster, setCluster] = useState('')
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [onHoldProcessing, setOnHoldProcessing] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [insufficientQuantity, setInsufficientQuantity] = useState(false)
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseItem[]>([])
  
  const { productNames: availableProducts } = useProducts()

  const clusterOptions = useMemo(() => {
    if (!zone) return []
    return (clustersByZone[zone] || []).map((c) => ({ value: c, label: c }))
  }, [zone, clustersByZone])

  const zoneOptions = useMemo(
    () => zones.map((z) => ({ value: z, label: z })),
    [zones]
  )

  useEffect(() => {
    loadZoneClusterOptions()
      .then(({ zones: z, clustersByZone: map }) => {
        setZones(z)
        setClustersByZone(map)
      })
      .catch(() => {})
  }, [])
  const availableClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'NA']
  const availableCategories = ['New Students', 'Existing Students', 'Both', 'Training-Material']

  // Get current user to check role
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'
  const isWarehouseExecutive = currentUser?.role === 'Warehouse Executive'
  const isWarehouseManager = currentUser?.role === 'Warehouse Manager'
  const canAccessWarehouse = isManager || isAdmin || isWarehouseExecutive || isWarehouseManager

  async function load() {
    try {
      const data = await apiRequest<DC[]>(`/dc/pending-warehouse`)
      // Ensure data is an array before setting
      const dataArray = Array.isArray(data) ? data : []
      setRows(dataArray)
    } catch (err: any) {
      console.error('Failed to load DC list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const openDcId = searchParams?.get('openDcId')
    if (!openDcId || loading || rows.length === 0) return
    const dc = rows.find((r) => r._id === openDcId)
    if (dc) {
      openProcessDialog(dc)
      router.replace('/dashboard/warehouse/dc-at-warehouse')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, rows, loading])

  const openProcessDialog = async (dc: DC) => {
    try {
      setOpenDialog(true) // Open dialog first to show loading state
      // Fetch warehouse inventory first
      const inventory = await apiRequest<WarehouseItem[]>('/warehouse')
      // Ensure inventory is an array before setting
      const inventoryArray = Array.isArray(inventory) ? inventory : []
      setWarehouseInventory(inventoryArray)
      
      // Fetch full DC details to get productDetails and dcOrderId with delivery/address info
      const fullDC = await apiRequest<DC>(`/dc/${dc._id}`)
      setSelectedDC(fullDC)
      
      // Extract delivery and address info from dcOrderId
      const dcOrder = typeof fullDC.dcOrderId === 'object' ? fullDC.dcOrderId : null
      
      // Helper function to find matching inventory item
      const findInventoryItem = (productName: string, category?: string, level?: string, specs?: string, subject?: string): WarehouseItem | null => {
        // Normalize subject for comparison (handle empty strings, null, undefined)
        const normalizedSubject = subject && subject.trim() !== '' ? subject.trim() : undefined
        const normalizedSpecs = (specs && specs.trim() !== '') ? specs.trim() : 'Regular'
        
        // If subject is provided, we MUST match it exactly - don't fall back to items without subjects
        if (normalizedSubject !== undefined) {
          // Try exact match with subject (productName, category, level, specs, subject)
          let match = inventoryArray.find(item => {
            const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
            const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
            return (
              item.productName?.toLowerCase() === productName?.toLowerCase() &&
              (item.category || '') === (category || '') &&
              (item.level || '') === (level || '') &&
              itemSpecs === normalizedSpecs &&
              itemSubject === normalizedSubject // Exact subject match required
            )
          })
          
          // If no exact match with category, try without category (productName, level, specs, subject)
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject // Exact subject match required
              )
            })
          }
          
          // If no exact match with subject, try case-insensitive subject match (with category)
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim().toLowerCase() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.category || '') === (category || '') &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject?.toLowerCase() // Case-insensitive subject match
              )
            })
          }
          
          // If no match, try case-insensitive subject match without category
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim().toLowerCase() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject?.toLowerCase() // Case-insensitive subject match
              )
            })
          }
          
          return match || null
        }
        
        // If no subject is provided, try matching without subject
        // Try exact match first (productName, category, level, specs, no subject)
        let match = inventoryArray.find(item => {
          const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
          const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
          return (
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '') &&
            (item.level || '') === (level || '') &&
            itemSpecs === normalizedSpecs &&
            itemSubject === undefined // No subject in inventory item
          )
        })
        
        // If no exact match, try productName, category, level, and specs (ignore subject)
        if (!match) {
          match = inventoryArray.find(item => {
            const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
            return (
              item.productName?.toLowerCase() === productName?.toLowerCase() &&
              (item.category || '') === (category || '') &&
              (item.level || '') === (level || '') &&
              itemSpecs === normalizedSpecs
            )
          })
        }
        
        // If no exact match, try productName, category, and level (without specs/subject)
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '') &&
            (item.level || '') === (level || '')
          )
        }
        
        // If no exact match, try productName and category only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '')
          )
        }
        
        // If still no match, try productName only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase()
          )
        }
        
        return match || null
      }
      
      // Load product details
      if (fullDC.productDetails && Array.isArray(fullDC.productDetails) && fullDC.productDetails.length > 0) {
        console.log('Loading productDetails for DC @ Warehouse:', JSON.stringify(fullDC.productDetails, null, 2))
        setProductRows(fullDC.productDetails.map((p, idx) => {
          const productName = p.product || 'ABACUS'
          const category = p.category
          const level = p.level
          
          // Use specs and subject DIRECTLY from DC productDetails (saved from pending DC stage)
          // This is the actual data that was entered/edited by the employee/manager
          // DO NOT override with inventory values - use what's in the DC
          // Check for undefined/null explicitly, not just falsy (empty string is valid)
          const specsValue = (p.specs !== undefined && p.specs !== null && p.specs !== '') 
            ? p.specs 
            : ((p as any).specs !== undefined && (p as any).specs !== null && (p as any).specs !== '')
              ? (p as any).specs
              : 'Regular'
          const subjectValue = (p.subject !== undefined && p.subject !== null && p.subject !== '')
            ? p.subject
            : ((p as any).subject !== undefined && (p as any).subject !== null && (p as any).subject !== '')
              ? (p as any).subject
              : undefined
          
          // Find matching inventory item ONLY for getting available quantity
          // Use the specs and subject from DC to find the correct inventory item
          const inventoryItem = findInventoryItem(
            productName,
            category,
            level,
            specsValue,
            subjectValue
          )
          
          console.log(`Product ${idx + 1} raw data from DC:`, {
            product: productName,
            category,
            level,
            specsFromDC: specsValue,
            subjectFromDC: subjectValue,
            fullProductDetail: p,
            inventoryMatch: inventoryItem ? {
              productName: inventoryItem.productName,
              category: inventoryItem.category,
              level: inventoryItem.level,
              specs: inventoryItem.specs,
              subject: inventoryItem.subject,
              stock: inventoryItem.currentStock
            } : null
          })
          
          // Get requested quantity - use the larger of quantity or strength
          // Sometimes backend has quantity: 1 but strength: 500, so we use the larger value
          const qty = (p.quantity !== undefined && p.quantity !== null) ? Number(p.quantity) : 0
          const str = (p.strength !== undefined && p.strength !== null) ? Number(p.strength) : 0
          const requestedQty = Math.max(qty, str) // Use the larger value
          const availableQty = inventoryItem ? inventoryItem.currentStock : (p.availableQuantity !== undefined && p.availableQuantity !== null ? Number(p.availableQuantity) : 0)
          // Use deliverable quantity from database if available, otherwise calculate it
          // The deliverable quantity from database is the value set by the manager/employee
          const deliverableQty = (p.deliverableQuantity !== undefined && p.deliverableQuantity !== null) 
            ? Number(p.deliverableQuantity) 
            : Math.min(requestedQty, availableQty) // Fallback: calculate if not in database
          const remainingQty = availableQty - deliverableQty
          
          console.log(`Product ${idx + 1} quantity calculation:`, {
            'p.quantity': p.quantity,
            'p.strength': p.strength,
            'p.deliverableQuantity (from database)': p.deliverableQuantity,
            'requestedQty (calculated)': requestedQty,
            'availableQty (from inventory)': availableQty,
            'deliverableQty (from database or calculated)': deliverableQty
          })
          
          const productRow = {
            product: productName,
            class: p.class || 'NA',
            category: p.category || 'Training-Material',
            specs: specsValue, // Use specs from DC productDetails (saved from pending DC)
            subject: subjectValue, // Use subject from DC productDetails (saved from pending DC)
            quantity: requestedQty, // Requested quantity (read-only)
            availableQuantity: availableQty, // Available in warehouse (from inventory, auto-filled)
            deliverableQuantity: deliverableQty, // Deliverable quantity (from database, or calculated if not available)
            remainingQuantity: remainingQty, // Remaining in warehouse after delivery
            strength: p.strength || 0,
            price: p.price || 0,
            total: p.total || 0,
            level: p.level || 'L2',
          }
          console.log(`Product ${idx + 1} final row:`, productRow)
          return productRow
        }))
      } else {
        // Fallback: create from product string
        const productName = fullDC.product || 'ABACUS'
        const inventoryItem = findInventoryItem(productName, 'Training-Material', undefined, undefined, undefined)
        const requestedQty = fullDC.requestedQuantity || 0
        const availableQty = inventoryItem ? inventoryItem.currentStock : 0
        const deliverableQty = Math.min(requestedQty, availableQty)
        const remainingQty = availableQty - deliverableQty
        
        setProductRows([{
          product: productName,
          class: 'NA',
          category: 'Training-Material',
          specs: 'Regular',
          subject: undefined,
          quantity: requestedQty, // Requested quantity
          availableQuantity: availableQty, // From inventory
          deliverableQuantity: deliverableQty, // Calculated
          remainingQuantity: remainingQty, // Remaining
          strength: 0,
        }])
      }
      
      // Load DC details
      setDcDate(fullDC.dcDate ? new Date(fullDC.dcDate).toISOString().split('T')[0] : '')
      setDcRemarks(fullDC.dcRemarks || '')
      setDcCategory(fullDC.dcCategory || '')
      setDcNotes(fullDC.dcNotes || '')
      setContactPerson(fullDC.contactPerson || '')
      setContactMobile(fullDC.contactMobile || fullDC.customerPhone || '')
      setSchoolType(dcOrder?.school_type || '')
      setSchoolAddress(dcOrder?.address || '')
      setZone(dcOrder?.zone || fullDC.zone || '')
      setCluster(dcOrder?.cluster_code || fullDC.cluster || '')
      setRemarks(fullDC.remarks || '')
      setInsufficientQuantity(false)
      setOpenDialog(true)
    } catch (e: any) {
      console.error('Failed to load DC details:', e)
      alert(`Error loading DC: ${e?.message || 'Unknown error'}`)
    }
  }

  // Check if quantities are sufficient when product rows change
  useEffect(() => {
    if (openDialog && selectedDC && productRows.length > 0) {
      // Check if available quantities are entered and if any are insufficient
      const hasAllAvailableQty = productRows.every(p => 
        p.availableQuantity !== undefined && p.availableQuantity !== null && p.availableQuantity > 0
      )
      // Check if any product has available qty < deliverable qty
      const hasInvalidDeliverableQty = productRows.some(p => 
        (p.availableQuantity || 0) < (p.deliverableQuantity || 0)
      )
      const hasInsufficientQty = productRows.some(p => 
        (p.availableQuantity || 0) < (p.quantity || 0)
      )
      
      if (!hasAllAvailableQty) {
        setInsufficientQuantity(false) // Still entering, don't show warning yet
      } else if (hasInvalidDeliverableQty || hasInsufficientQty) {
        setInsufficientQuantity(true) // Some products have insufficient quantity or invalid deliverable qty
      } else {
        setInsufficientQuantity(false) // All products have sufficient quantity
      }
    } else {
      setInsufficientQuantity(false)
    }
  }, [productRows, openDialog, selectedDC])

  const processDC = async () => {
    if (!selectedDC) return

    // Validate required fields
    if (!schoolType || schoolType.trim() === '') {
      alert('School Type is required. Please enter the school type before submitting.')
      return
    }

    // Validate that available qty >= deliverable qty for all products
    const hasInvalidDeliverableQty = productRows.some(p => 
      (p.availableQuantity || 0) < (p.deliverableQuantity || 0)
    )
    
    if (hasInvalidDeliverableQty) {
      alert('Enough quantity is not available. Available quantity is less than deliverable quantity for one or more products. Please adjust deliverable quantities or use the "Hold DC" button to put the DC on hold.')
      return
    }

    setProcessing(true)
    try {
      // Fetch latest warehouse inventory from database first
      const inventory = await apiRequest<WarehouseItem[]>('/warehouse')
      // Ensure inventory is an array before using
      const inventoryArray = Array.isArray(inventory) ? inventory : []
      
      // Helper function to find matching inventory item
      const findInventoryItem = (productName: string, category?: string, level?: string, specs?: string, subject?: string): WarehouseItem | null => {
        // Normalize subject for comparison (handle empty strings, null, undefined)
        const normalizedSubject = subject && subject.trim() !== '' ? subject.trim() : undefined
        const normalizedSpecs = (specs && specs.trim() !== '') ? specs.trim() : 'Regular'
        
        // If subject is provided, we MUST match it exactly - don't fall back to items without subjects
        if (normalizedSubject !== undefined) {
          // Try exact match with subject (productName, category, level, specs, subject)
          let match = inventoryArray.find(item => {
            const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
            const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
            return (
              item.productName?.toLowerCase() === productName?.toLowerCase() &&
              (item.category || '') === (category || '') &&
              (item.level || '') === (level || '') &&
              itemSpecs === normalizedSpecs &&
              itemSubject === normalizedSubject // Exact subject match required
            )
          })
          
          // If no exact match with category, try without category (productName, level, specs, subject)
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject // Exact subject match required
              )
            })
          }
          
          // If no exact match with subject, try case-insensitive subject match (with category)
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim().toLowerCase() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.category || '') === (category || '') &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject?.toLowerCase() // Case-insensitive subject match
              )
            })
          }
          
          // If no match, try case-insensitive subject match without category
          if (!match) {
            match = inventoryArray.find(item => {
              const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim().toLowerCase() : undefined
              const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
              return (
                item.productName?.toLowerCase() === productName?.toLowerCase() &&
                (item.level || '') === (level || '') &&
                itemSpecs === normalizedSpecs &&
                itemSubject === normalizedSubject?.toLowerCase() // Case-insensitive subject match
              )
            })
          }
          
          return match || null
        }
        
        // If no subject is provided, try matching without subject
        // Try exact match first (productName, category, level, specs, no subject)
        let match = inventoryArray.find(item => {
          const itemSubject = item.subject && item.subject.trim() !== '' ? item.subject.trim() : undefined
          const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
          return (
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '') &&
            (item.level || '') === (level || '') &&
            itemSpecs === normalizedSpecs &&
            itemSubject === undefined // No subject in inventory item
          )
        })
        
        // If no exact match, try productName, category, level, and specs (ignore subject)
        if (!match) {
          match = inventoryArray.find(item => {
            const itemSpecs = (item.specs && item.specs.trim() !== '') ? item.specs.trim() : 'Regular'
            return (
              item.productName?.toLowerCase() === productName?.toLowerCase() &&
              (item.category || '') === (category || '') &&
              (item.level || '') === (level || '') &&
              itemSpecs === normalizedSpecs
            )
          })
        }
        
        // If no exact match, try productName, category, and level (without specs/subject)
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '') &&
            (item.level || '') === (level || '')
          )
        }
        
        // If no exact match, try productName and category only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase() &&
            (item.category || '') === (category || '')
          )
        }
        
        // If still no match, try productName only
        if (!match) {
          match = inventoryArray.find(item => 
            item.productName?.toLowerCase() === productName?.toLowerCase()
          )
        }
        
        return match || null
      }

      // Update available quantities from inventory and recalculate remaining qty for all products
      const updatedProductRows = productRows.map(p => {
        // Find matching inventory item to get latest available quantity
        const inventoryItem = findInventoryItem(
          p.product || '',
          p.category,
          p.level,
          p.specs,
          p.subject
        )
        
        // Use inventory quantity if found, otherwise keep existing available quantity
        const availableQty = inventoryItem ? inventoryItem.currentStock : (p.availableQuantity || 0)
        const deliverableQty = p.deliverableQuantity || 0
        // Calculate remaining qty = available qty - deliverable qty (only if available >= deliverable)
        const remainingQty = availableQty >= deliverableQty ? availableQty - deliverableQty : 0
        
        return {
          ...p,
          availableQuantity: availableQty,
          remainingQuantity: remainingQty,
        }
      })

      // Use the updated product rows with recalculated remaining qty
      // Update the productRows state to reflect the recalculated values
      setProductRows(updatedProductRows)

      // Calculate totals - use the larger of quantity or strength for each product
      const totalRequestedQty = updatedProductRows.reduce((sum, p) => {
        const qty = p.quantity || 0
        const str = p.strength || 0
        return sum + Math.max(qty, str) // Use the larger value
      }, 0)
      const totalAvailableQty = updatedProductRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
      const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)
      // Update DC with product details including available quantities
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            class: p.class,
            category: p.category,
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            quantity: p.quantity, // Requested quantity (original)
            availableQuantity: p.availableQuantity, // Available in warehouse
            deliverableQuantity: p.deliverableQuantity, // Final deliverable
            remainingQuantity: p.remainingQuantity, // Remaining in warehouse after delivery
            strength: p.strength,
            price: p.price,
            total: p.total,
            level: p.level,
          })),
          requestedQuantity: totalRequestedQty,
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          dcDate: dcDate || undefined,
          dcRemarks: dcRemarks || undefined,
          dcCategory: dcCategory || undefined,
          dcNotes: dcNotes || undefined,
          contactPerson: contactPerson || undefined,
          contactMobile: contactMobile || undefined,
          zone: zone || undefined,
          cluster_code: cluster || undefined,
          school_type: schoolType || undefined,
          remarks: remarks || undefined,
          dcOrderId: selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' 
            ? { ...selectedDC.dcOrderId, school_type: schoolType || undefined, address: schoolAddress || undefined, zone: zone || undefined, cluster_code: cluster || undefined }
            : selectedDC.dcOrderId,
        }),
      })
      
      // Process the DC in warehouse (this will set status to 'completed')
      await apiRequest(`/dc/${selectedDC._id}/warehouse-process`, {
        method: 'POST',
        body: JSON.stringify({
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          remarks,
        }),
      })
      
      alert('DC processed successfully! It will appear in Completed DC page.')
      setOpenDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to process DC')
    } finally {
      setProcessing(false)
    }
  }

  const putOnHold = async () => {
    if (!selectedDC) return

    // Validate required fields
    if (!schoolType || schoolType.trim() === '') {
      alert('School Type is required. Please enter the school type before putting the DC on hold.')
      return
    }

    // Validate that available quantities exist (they're auto-filled from inventory)
    const productsWithoutAvailableQty = productRows.filter(p => 
      p.availableQuantity === undefined || p.availableQuantity === null
    )
    
    if (productsWithoutAvailableQty.length > 0) {
      alert('Available quantities are being loaded from inventory. Please wait or refresh the page.')
      return
    }
    
    if (productRows.length === 0) {
      alert('No products found. Please refresh the page.')
      return
    }

    // Recalculate remaining qty for each product: remaining qty = available qty - deliverable qty
    // Note: Hold DC is allowed even when available qty < deliverable qty (that's the purpose of putting it on hold)
    const updatedProductRows = productRows.map(p => {
      const availableQty = p.availableQuantity || 0
      const deliverableQty = p.deliverableQuantity || 0
      // Calculate remaining qty = available qty - deliverable qty (only if available >= deliverable)
      const remainingQty = availableQty >= deliverableQty ? availableQty - deliverableQty : 0
      
      return {
        ...p,
        remainingQuantity: remainingQty,
      }
    })

    // Calculate totals - use the larger of quantity or strength for each product
    const totalRequestedQty = productRows.reduce((sum, p) => {
      const qty = p.quantity || 0
      const str = p.strength || 0
      return sum + Math.max(qty, str) // Use the larger value
    }, 0)
    const totalAvailableQty = productRows.reduce((sum, p) => sum + (p.availableQuantity || 0), 0)
    const totalDeliverableQty = updatedProductRows.reduce((sum, p) => sum + (p.deliverableQuantity || 0), 0)

    setOnHoldProcessing(true)
    try {
      // Update DC with product details and set status to 'hold'
      const holdReason = remarks 
        ? `Insufficient quantity available. Remarks: ${remarks}`
        : 'Insufficient quantity available.';
      
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productDetails: updatedProductRows.map(p => ({
            product: p.product,
            class: p.class,
            category: p.category,
            specs: p.specs || 'Regular',
            subject: p.subject || undefined,
            quantity: p.quantity,
            availableQuantity: p.availableQuantity,
            deliverableQuantity: p.deliverableQuantity,
            remainingQuantity: p.remainingQuantity, // Save remaining qty to database
            strength: p.strength,
            price: p.price,
            total: p.total,
            level: p.level,
          })),
          requestedQuantity: totalRequestedQty,
          availableQuantity: totalAvailableQty,
          deliverableQuantity: totalDeliverableQty,
          status: 'hold',
          holdReason: holdReason,
          dcDate: dcDate || undefined,
          dcRemarks: dcRemarks || undefined,
          dcCategory: dcCategory || undefined,
          dcNotes: dcNotes || undefined,
          contactPerson: contactPerson || undefined,
          contactMobile: contactMobile || undefined,
          zone: zone || undefined,
          cluster_code: cluster || undefined,
          school_type: schoolType || undefined,
          remarks: remarks || undefined,
          dcOrderId: selectedDC.dcOrderId && typeof selectedDC.dcOrderId === 'object' 
            ? { ...selectedDC.dcOrderId, school_type: schoolType || undefined, address: schoolAddress || undefined, zone: zone || undefined, cluster_code: cluster || undefined }
            : selectedDC.dcOrderId,
        }),
      })
      
      alert('DC has been put on hold. It will appear in Hold DC page.')
      setOpenDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to put DC on hold')
    } finally {
      setOnHoldProcessing(false)
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">DC Warehouse - Pending DCs</h1>
          <p className="text-sm text-neutral-600 mt-1">Review and process DCs requested by Manager</p>
        </div>
      </div>

      <Card className="p-6 rounded-lg border border-neutral-200">
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>DC No</TableHead>
                <TableHead>Requested Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Customer Phone</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-neutral-500">No pending DCs</TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow key={r._id}>
                  <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">DC-{r._id.slice(-6)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.managerRequestedAt ? new Date(r.managerRequestedAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[160px]">{r.customerName || r.saleId?.customerName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customerPhone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {(() => {
                      // Calculate requestedQuantity from productDetails if available, otherwise use requestedQuantity field
                      if (r.productDetails && Array.isArray(r.productDetails) && r.productDetails.length > 0) {
                        const calculatedQty = r.productDetails.reduce((sum, p) => {
                          const qty = p.quantity || 0
                          const str = p.strength || 0
                          return sum + Math.max(qty, str) // Use the larger value
                        }, 0)
                        return calculatedQty > 0 ? calculatedQty : (r.requestedQuantity || '-')
                      }
                      return r.requestedQuantity || '-'
                    })()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.managerId?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {canAccessWarehouse && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => openProcessDialog(r)}>
                          Update & Submit
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1200px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">DC Form Update</DialogTitle>
            <DialogDescription>
              Update DC information and product quantities
            </DialogDescription>
          </DialogHeader>
          {selectedDC && (
            <div className="space-y-6 py-4">
              {/* School Information & More Information - Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* School Information - Left Column */}
                <Card className="p-4 border-t-4 border-t-blue-500">
                  <h3 className="font-semibold text-neutral-900 mb-4">School Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-neutral-600">Contact Person Name</Label>
                      <Input
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="Contact Person Name"
                        className="mt-1"
                      />
                    </div>
                <div>
                      <Label className="text-sm text-neutral-600">Contact Mobile</Label>
                      <Input
                        value={contactMobile}
                        onChange={(e) => setContactMobile(e.target.value)}
                        placeholder="Contact Mobile"
                        className="mt-1"
                      />
                </div>
                <div>
                      <Label className="text-sm text-neutral-600">School Type <span className="text-red-500">*</span></Label>
                      <Select value={schoolType} onValueChange={setSchoolType}>
                        <SelectTrigger className={`mt-1 ${!schoolType ? 'border-red-300' : ''}`}>
                          <SelectValue placeholder="Select School Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SCHOOL_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                <div>
                      <Label className="text-sm text-neutral-600">Executive</Label>
                      <Input
                        value={selectedDC.managerId?.name || ''}
                        disabled
                        className="mt-1 bg-neutral-50"
                      />
                    </div>
                  </div>
                </Card>

                {/* More Information - Right Column */}
                <Card className="p-4 border-t-4 border-t-blue-500">
                  <h3 className="font-semibold text-neutral-900 mb-4">More Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm text-neutral-600">School Address</Label>
                      <Textarea
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        placeholder="School Address"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-neutral-600">Zone</Label>
                      <SearchableSelect
                        className="mt-1"
                        value={zone}
                        onValueChange={(v) => {
                          setZone(v)
                          setCluster('')
                        }}
                        placeholder="Select Zone"
                        searchPlaceholder="Search zones…"
                        options={zoneOptions}
                        emptyText={zones.length === 0 ? 'Add zones under Users → Zones' : 'No results found.'}
                      />
                </div>
                <div>
                      <Label className="text-sm text-neutral-600">Cluster</Label>
                      <SearchableSelect
                        className="mt-1"
                        value={cluster}
                        onValueChange={setCluster}
                        placeholder={zone ? 'Select Cluster' : 'Select zone first'}
                        searchPlaceholder="Search clusters…"
                        options={clusterOptions}
                        disabled={!zone}
                        emptyText={
                          zone && clusterOptions.length === 0
                            ? 'Link clusters to this zone in Users → Zones'
                            : 'No results found.'
                        }
                      />
                </div>
                </div>
                </Card>
              </div>
              
              {/* Delivery & Address Information - Full Width */}
              {(() => {
                const dcOrder = typeof selectedDC.dcOrderId === 'object' ? selectedDC.dcOrderId : null
                // Get delivery and address information from database (saved in edit PO in executive)
                const transportName = dcOrder?.transport_name || selectedDC.transport || ''
                const transportLocation = dcOrder?.transport_location || selectedDC.transportArea || ''
                const transportLandmark = dcOrder?.transportation_landmark || ''
                const pincode = dcOrder?.pincode || ''
                
                return (
                  <Card className="p-4 border-t-4 border-t-green-500">
                    <h3 className="font-semibold text-neutral-900 mb-4">Delivery & Address Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Name</Label>
                        <Input
                          value={transportName}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Location</Label>
                        <Input
                          value={transportLocation}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Transport Landmark</Label>
                        <Input
                          value={transportLandmark}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-neutral-600">Pincode</Label>
                        <Input
                          value={pincode}
                          readOnly
                          disabled
                          className="mt-1 bg-neutral-50"
                          placeholder="Not provided"
                        />
                      </div>
                      {selectedDC.lrNo && (
                        <div>
                          <Label className="text-sm text-neutral-600">LR No</Label>
                          <Input
                            value={selectedDC.lrNo}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.lrDate && (
                        <div>
                          <Label className="text-sm text-neutral-600">LR Date</Label>
                          <Input
                            type="date"
                            value={selectedDC.lrDate ? new Date(selectedDC.lrDate).toISOString().split('T')[0] : ''}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.boxes && (
                        <div>
                          <Label className="text-sm text-neutral-600">Boxes</Label>
                          <Input
                            value={selectedDC.boxes}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                      {selectedDC.deliveryStatus && (
                        <div>
                          <Label className="text-sm text-neutral-600">Delivery Status</Label>
                          <Input
                            value={selectedDC.deliveryStatus}
                            readOnly
                            disabled
                            className="mt-1 bg-neutral-50"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })()}

              {/* DC Information Update - Full Width */}
              <Card className="p-4 border-t-4 border-t-blue-500">
                <h3 className="font-semibold text-neutral-900 mb-4">DC Information Update</h3>
                <div className="mb-4">
                  <div className="text-lg font-semibold text-neutral-900">DC No: DC-{selectedDC._id.slice(-6)}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-neutral-600">DC Date</Label>
                    <Input
                      type="date"
                      value={dcDate}
                      onChange={(e) => setDcDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-neutral-600">DC Category</Label>
                    <Select value={dcCategory} onValueChange={setDcCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select DC Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Term 1">Term 1</SelectItem>
                        <SelectItem value="Term 2">Term 2</SelectItem>
                        <SelectItem value="Term 3">Term 3</SelectItem>
                        <SelectItem value="Full Year">Full Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm text-neutral-600">DC Notes</Label>
                    <Textarea
                      value={dcNotes}
                      onChange={(e) => setDcNotes(e.target.value)}
                      placeholder="Notes"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                <div>
                    <Label className="text-sm text-neutral-600">DC Remarks</Label>
                    <Textarea
                      value={dcRemarks}
                      onChange={(e) => setDcRemarks(e.target.value)}
                      placeholder="DC Remarks"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>

              {/* Products Table */}
              <Card className="p-4 border-t-4 border-t-blue-500">
                <div className="mb-4">
                  <h3 className="font-semibold text-neutral-900">Products</h3>
                  <p className="text-sm text-neutral-600 mt-1">Available quantity is auto-filled from inventory and cannot be changed. Deliverable and remaining quantities are calculated automatically.</p>
                  {insufficientQuantity && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800">
                        ⚠️ Warning: Enough quantity is not available. Available quantity is less than deliverable quantity for one or more products. Please adjust deliverable quantities or use the "Hold DC" button to put the DC on hold.
                      </p>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="py-2 px-3 text-left border-r text-gray-900">Product</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Class</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Category</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Specs</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Subject</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Required Quantity</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Level</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Available Qty</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Deliverable Qty</th>
                        <th className="py-2 px-3 text-left border-r text-gray-900">Remaining Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center text-neutral-500 py-4">No products added</td>
                        </tr>
                      ) : (
                        productRows.map((row, idx) => (
                          <tr key={idx} className="border-b bg-white">
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.product}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.class}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.category}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.specs || 'Regular'}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.subject || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700 font-medium">
                                {row.quantity || 0}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className="h-8 text-xs bg-neutral-50 px-2 py-1.5 rounded border border-neutral-200 text-neutral-700">
                                {row.level || '-'}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r">
                <Input
                  type="number"
                                className="h-8 text-xs bg-neutral-50 border-neutral-300 text-neutral-700 font-medium"
                                value={row.availableQuantity !== undefined && row.availableQuantity !== null ? String(row.availableQuantity) : ''}
                                readOnly
                                disabled
                                placeholder="Auto-filled from inventory"
                  min="0"
                />
                            </td>
                            <td className="py-2 px-3 border-r">
                              <Input
                                type="number"
                                className={`h-8 text-xs border font-medium ${
                                  (row.availableQuantity || 0) < (row.deliverableQuantity || 0)
                                    ? 'bg-red-50 border-red-300 text-red-800'
                                    : 'bg-white border-neutral-300 text-neutral-700'
                                }`}
                                value={row.deliverableQuantity !== undefined && row.deliverableQuantity !== null ? String(row.deliverableQuantity) : '0'}
                                onChange={(e) => {
                                  const updated = [...productRows]
                                  const newDeliverableQty = Number(e.target.value) || 0
                                  const availableQty = updated[idx].availableQuantity || 0
                                  updated[idx].deliverableQuantity = newDeliverableQty
                                  // Calculate remaining qty = available qty - deliverable qty (only if available > deliverable)
                                  if (availableQty >= newDeliverableQty) {
                                    updated[idx].remainingQuantity = availableQty - newDeliverableQty
                                  } else {
                                    updated[idx].remainingQuantity = 0 // Can't have negative remaining
                                  }
                                  setProductRows(updated)
                                }}
                                min="0"
                                max={row.availableQuantity || 0}
                                placeholder="0"
                              />
                            </td>
                            <td className="py-2 px-3 border-r">
                              <div className={`h-8 text-xs px-2 py-1.5 rounded border font-medium ${
                                (row.remainingQuantity || 0) < 0
                                  ? 'bg-red-50 border-red-300 text-red-800'
                                  : (row.remainingQuantity || 0) === 0
                                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                                  : 'bg-blue-50 border-blue-300 text-blue-800'
                              }`}>
                                {row.remainingQuantity !== undefined && row.remainingQuantity !== null ? row.remainingQuantity : 0}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                      {/* Total Row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                        <td colSpan={5} className="px-3 py-3 text-right">
                          <span className="text-gray-700">Total:</span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-lg">
                          {productRows.reduce((sum, row) => sum + (Number(row.strength) || 0), 0)}
                        </td>
                        <td colSpan={4} className="px-3 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
              </div>
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button 
              onClick={putOnHold} 
              disabled={onHoldProcessing || processing || productRows.length === 0}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {onHoldProcessing ? 'Putting on Hold...' : 'Hold DC'}
            </Button>
            <Button 
              onClick={processDC} 
              disabled={processing || onHoldProcessing || productRows.length === 0 || insufficientQuantity}
            >
              {processing ? 'Processing...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
