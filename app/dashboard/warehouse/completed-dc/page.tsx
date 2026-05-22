'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import {
  STUDENT_TYPE_OPTIONS,
  STUDENT_TYPE_PLACEHOLDER,
  followUpStudentTypeSelectValue,
  parseFollowUpStudentTypeSelectValue,
  isShortageStudentType,
} from '@/lib/dcStudentTypeOptions'
import { SCHOOL_TYPE_OPTIONS } from '@/lib/warehouseOptions'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Pencil, X, Upload, FileText, Download } from 'lucide-react'
import jsPDF from 'jspdf'

type Row = {
  _id: string
  dcNo: string
  dcDate?: string
  dcCategory?: string
  dcFinYear?: string
  schoolName?: string
  schoolCode?: string
  schoolType?: string
  zone?: string
  executive?: string
  transport?: string
  lrNo?: string
  lrDate?: string
  lrCost?: string
  boxes?: string
  transportArea?: string
  deliveryStatus?: string
  remarks?: string
  completedDate?: string
  poPhotoUrl?: string
  poDocument?: string
  dcId?: string // The actual DC model ID (if this row is from DcOrder)
  isDcOrder?: boolean // Flag to indicate if this is from DcOrder model
}

export default function CompletedDCPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [allRows, setAllRows] = useState<Row[]>([]) // Store all data for filtering
  const [backendSearching, setBackendSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingDC, setEditingDC] = useState<Row | null>(null)
  const [editForm, setEditForm] = useState({
    transport: '',
    lrNo: '',
    boxes: '',
    dcCategory: '',
    transportArea: '',
    lrDate: '',
    lrCost: '',
    deliveryStatus: '',
    remarks: '',
  })
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDC, setPdfDC] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null)
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [replacingPdfFor, setReplacingPdfFor] = useState<Row | null>(null)
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false)
  const [shortageTargetDC, setShortageTargetDC] = useState<any | null>(null)
  const [shortageRows, setShortageRows] = useState<Array<{
    id: string
    product: string
    class: string
    category: string
    term: string
    orderedQuantity: number
    deliveredQuantity: number
    shortageQuantity: number
  }>>([])
  const [shortageRemarks, setShortageRemarks] = useState('')
  const [savingShortage, setSavingShortage] = useState(false)
  const [followUpStudentTypeByDcId, setFollowUpStudentTypeByDcId] = useState<Record<string, string>>({})
  const [filters, setFilters] = useState({
    zone: '',
    employee: '',
    schoolCode: '',
    schoolName: '',
    schoolType: '',
    dcNo: '',
    dcCategory: '',
    lrNo: '',
    deliveryStatus: '',
    fromDate: '',
    toDate: '',
  })

  const applyFilters = (data: Row[]) => {
    let filtered = [...data]
    
    // Apply each filter
    if (filters.zone) {
      filtered = filtered.filter(r => 
        (r.zone || '').toLowerCase().includes(filters.zone.toLowerCase())
      )
    }
    
    if (filters.employee) {
      filtered = filtered.filter(r => 
        (r.executive || '').toLowerCase().includes(filters.employee.toLowerCase())
      )
    }
    
    if (filters.schoolCode) {
      filtered = filtered.filter(r => 
        (r.schoolCode || '').toLowerCase().includes(filters.schoolCode.toLowerCase())
      )
    }
    
    if (filters.schoolName) {
      filtered = filtered.filter(r => 
        (r.schoolName || '').toLowerCase().includes(filters.schoolName.toLowerCase())
      )
    }
    
    if (filters.schoolType) {
      filtered = filtered.filter(r =>
        (r.schoolType || '').toLowerCase() === filters.schoolType.toLowerCase()
      )
    }
    
    if (filters.dcNo) {
      filtered = filtered.filter(r => 
        (r.dcNo || '').toLowerCase().includes(filters.dcNo.toLowerCase())
      )
    }
    
    if (filters.dcCategory) {
      filtered = filtered.filter(r => 
        (r.dcCategory || '').toLowerCase().includes(filters.dcCategory.toLowerCase())
      )
    }
    
    if (filters.lrNo) {
      filtered = filtered.filter(r => 
        (r.lrNo || '').toLowerCase().includes(filters.lrNo.toLowerCase())
      )
    }
    
    if (filters.deliveryStatus) {
      filtered = filtered.filter(r => 
        (r.deliveryStatus || '').toLowerCase().includes(filters.deliveryStatus.toLowerCase())
      )
    }
    
    if (filters.fromDate) {
      filtered = filtered.filter(r => {
        if (!r.dcDate) return false
        const rowDate = new Date(r.dcDate)
        const filterDate = new Date(filters.fromDate)
        return rowDate >= filterDate
      })
    }
    
    if (filters.toDate) {
      filtered = filtered.filter(r => {
        if (!r.dcDate) return false
        const rowDate = new Date(r.dcDate)
        const filterDate = new Date(filters.toDate)
        filterDate.setHours(23, 59, 59, 999) // Include the entire day
        return rowDate <= filterDate
      })
    }
    
    // Sort by DC creation/delivery date descending so latest DC appears at the top
    filtered.sort((a, b) => {
      const aTime = a.dcDate ? new Date(a.dcDate).getTime() : 0
      const bTime = b.dcDate ? new Date(b.dcDate).getTime() : 0
      return bTime - aTime
    })
    
    setRows(filtered)
  }

  // Apply filters when filters state changes
  useEffect(() => {
    if (allRows.length > 0) {
      applyFilters(allRows)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, allRows])

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    // Don't send filters to API - we'll filter client-side
    // show only active (not on hold)
    qs.append('hold', 'false')
    try {
      // Fetch from both DcOrder and DC model
      let dcOrderData: Row[] = []
      let dcModelData: any[] = []
      
      try {
        dcOrderData = await apiRequest<Row[]>(`/warehouse/dc/list?${qs.toString()}`)
        console.log('Loaded DcOrder data:', dcOrderData?.length || 0, 'entries')
      } catch (err: any) {
        console.warn('Failed to load warehouse DC list:', err)
        dcOrderData = []
      }
      
      try {
        // Try dedicated endpoint first, fallback to filtered endpoint
        try {
          const response = await apiRequest<any>(`/dc/completed`)
          console.log('🔍 Raw API response from /dc/completed:', {
            type: typeof response,
            isArray: Array.isArray(response),
            hasData: response?.data !== undefined,
            responseKeys: response && typeof response === 'object' ? Object.keys(response) : null
          })
          
          // Handle paginated response or direct array
          if (Array.isArray(response)) {
            dcModelData = response
          } else if (response?.data && Array.isArray(response.data)) {
            dcModelData = response.data
          } else {
            console.warn('⚠️ Unexpected response format, treating as empty')
            dcModelData = []
          }
          
          console.log('✅ Loaded DC model data from /dc/completed:', dcModelData?.length || 0, 'entries')
        } catch (dedicatedErr) {
          // Fallback to filtered endpoint
          console.warn('Dedicated endpoint failed, trying filtered endpoint:', dedicatedErr)
          const fallbackResponse = await apiRequest<any>(`/dc?status=completed`)
          
          if (Array.isArray(fallbackResponse)) {
            dcModelData = fallbackResponse
          } else if (fallbackResponse?.data && Array.isArray(fallbackResponse.data)) {
            dcModelData = fallbackResponse.data
          } else {
            dcModelData = []
          }
          
          console.log('✅ Loaded DC model data from /dc?status=completed:', dcModelData?.length || 0, 'entries')
        }
        
        if (dcModelData && dcModelData.length > 0) {
          console.log('Sample completed DC:', {
            id: dcModelData[0]._id,
            customerName: dcModelData[0].customerName,
            status: dcModelData[0].status,
            completedAt: dcModelData[0].completedAt
          })
        } else {
          console.warn('⚠️ No completed DCs found in API response')
        }
      } catch (err: any) {
        console.error('❌ Failed to load completed DCs:', {
          error: err?.message,
          status: err?.status,
          details: err
        })
        dcModelData = []
        toast.error(`Failed to load completed DCs: ${err?.message || 'Unknown error'}`)
      }

      // Ensure dcModelData is an array
      if (!Array.isArray(dcModelData)) {
        console.error('❌ dcModelData is not an array:', typeof dcModelData, dcModelData)
        dcModelData = []
      }
      
      // Transform DC model entries to match Row format
      console.log('🔄 Transforming DC model data to Row format...', {
        dcModelDataLength: dcModelData?.length || 0,
        isArray: Array.isArray(dcModelData),
        firstItem: dcModelData?.[0] ? {
          _id: dcModelData[0]._id,
          status: dcModelData[0].status,
          customerName: dcModelData[0].customerName,
          dcOrderId: dcModelData[0].dcOrderId
        } : null
      })
      const transformedDCs: Row[] = (dcModelData || []).map((dc: any) => {
        const dcId = dc._id?.toString() || dc._id
        // Debug lrCost
        if (dc.lrCost !== undefined && dc.lrCost !== null) {
          console.log(`DC ${dcId} has lrCost:`, dc.lrCost)
        }
        return {
          _id: dcId,
          dcId: dcId, // This is a DC entry
          isDcOrder: false,
        dcNo: dc.createdAt 
            ? `${new Date(dc.createdAt).getFullYear().toString().slice(-2)}-${(new Date(dc.createdAt).getFullYear() + 1).toString().slice(-2)}/${dcId.slice(-4)}`
            : `DC-${dcId.slice(-6)}`,
        dcDate: dc.dcDate || dc.createdAt,
        dcCategory: dc.dcCategory || 'Term 2',
        dcFinYear: dc.createdAt 
          ? `${new Date(dc.createdAt).getFullYear()}-${new Date(dc.createdAt).getFullYear() + 1}`
          : '',
        schoolName: dc.dcOrderId?.school_name || dc.customerName || '',
        schoolCode: dc.dcOrderId?.dc_code || '',
        schoolType: dc.dcOrderId?.school_type || '',
        zone: dc.dcOrderId?.zone || '',
        executive: dc.employeeId?.name || dc.dcOrderId?.assigned_to?.name || '',
          transport: dc.transport || '',
          lrNo: dc.lrNo || '',
          lrDate: dc.lrDate || '',
          lrCost: dc.lrCost !== undefined && dc.lrCost !== null ? String(dc.lrCost) : '',
          boxes: dc.boxes || '',
          transportArea: dc.transportArea || '',
          deliveryStatus: dc.deliveryStatus || '',
          remarks: dc.deliveryNotes || dc.remarks || '',
          completedDate: dc.completedAt || '',
          poPhotoUrl: dc.poPhotoUrl || dc.poDocument || '',
          poDocument: dc.poDocument || dc.poPhotoUrl || '',
        }
      })
      
      // Mark DcOrder entries and find their corresponding DC IDs
      const dcOrderRows: Row[] = (dcOrderData || []).map((row: any) => {
        const rowId = row._id?.toString() || row._id
        return {
          ...row,
          _id: rowId, // This is a DcOrder ID
          isDcOrder: true,
        }
      })
      
      // Find DC entries for DcOrder rows
      for (const row of dcOrderRows) {
        try {
          // Find DC that has this dcOrderId
          const matchingDC = dcModelData.find((dc: any) => {
            if (!dc.dcOrderId) return false
            // Handle both populated object and ID string
            let dcOrderIdValue: string
            if (typeof dc.dcOrderId === 'object' && dc.dcOrderId._id) {
              dcOrderIdValue = dc.dcOrderId._id.toString()
            } else if (typeof dc.dcOrderId === 'object' && dc.dcOrderId.toString) {
              dcOrderIdValue = dc.dcOrderId.toString()
            } else {
              dcOrderIdValue = String(dc.dcOrderId)
            }
            return dcOrderIdValue === row._id.toString()
          })
          if (matchingDC) {
            row.dcId = matchingDC._id?.toString() || matchingDC._id
            // Also copy PDF data and other fields from the matching DC
            row.poDocument = matchingDC.poDocument || matchingDC.poPhotoUrl || row.poDocument
            row.poPhotoUrl = matchingDC.poPhotoUrl || matchingDC.poDocument || row.poPhotoUrl
            row.lrCost = matchingDC.lrCost || row.lrCost
            row.lrNo = matchingDC.lrNo || row.lrNo
            row.deliveryStatus = matchingDC.deliveryStatus || row.deliveryStatus
            row.schoolType = matchingDC.dcOrderId?.school_type || row.schoolType
            row.zone = matchingDC.dcOrderId?.zone || row.zone
            console.log(`Found DC ${row.dcId} for DcOrder ${row._id}`)
          } else {
            console.warn(`No DC found for DcOrder ${row._id} - this entry cannot be updated`)
          }
        } catch (e) {
          console.warn('Error finding DC for DcOrder:', e)
        }
      }

      // Combine both lists (DcOrder entries first, then DC entries)
      // Remove duplicates - if a DC entry exists, prefer it over DcOrder entry
      const allDataMap = new Map<string, Row>()
      
      // First add DC entries (these are authoritative)
      transformedDCs.forEach(dc => {
        allDataMap.set(dc._id, dc)
      })
      
      console.log('📦 Added DC entries to map:', transformedDCs.length)
      
      // Then add DcOrder entries only if they don't have a corresponding DC or if DC doesn't exist
      dcOrderRows.forEach(dcOrder => {
        if (dcOrder.dcId) {
          // If we found a DC for this DcOrder, use the DC entry instead
          if (!allDataMap.has(dcOrder.dcId)) {
            // DC entry doesn't exist in our list, so add the DcOrder entry
            allDataMap.set(dcOrder._id, dcOrder)
          }
          // If DC entry exists, we skip the DcOrder entry (DC is authoritative)
        } else {
          // No DC found, add the DcOrder entry
          allDataMap.set(dcOrder._id, dcOrder)
        }
      })
      
      const allData = Array.from(allDataMap.values())
      
      // Store all data for filtering
      setAllRows(allData)
      
      // Apply filters to the data
      applyFilters(allData)
      
      console.log('✅ Final data to display:', {
        totalRows: allData.length,
        dcEntries: transformedDCs.length,
        dcOrderEntries: dcOrderRows.length,
        sampleRow: allData[0] ? {
          id: allData[0]._id,
          schoolName: allData[0].schoolName,
          isDcOrder: allData[0].isDcOrder,
          dcNo: allData[0].dcNo,
          completedDate: allData[0].completedDate
        } : null,
        allRowIds: allData.slice(0, 5).map(r => r._id)
      })
      
      if (allData.length === 0) {
        console.warn('⚠️ No data to display! Check:')
        console.warn('  - dcModelData length:', dcModelData?.length || 0)
        console.warn('  - dcOrderData length:', dcOrderData?.length || 0)
        console.warn('  - transformedDCs length:', transformedDCs.length)
        console.warn('  - dcOrderRows length:', dcOrderRows.length)
      }
      
      // Store all data and apply filters
      setAllRows(allData)
      applyFilters(allData)
      
      if (allData.length === 0) {
        // Don't show error if filters are applied - might be intentional
        if (Object.values(filters).some(v => v)) {
          // Filters applied but no results
        } else {
          // No filters but no data - might be normal
        }
      }
    } catch (err: any) {
      console.error('Error loading DCs:', err)
      toast.error(err?.message || 'Failed to load DCs')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const searchBySchoolCode = async (code: string) => {
    if (!code || code.length < 3) return
    setBackendSearching(true)
    try {
      const results = await apiRequest<any[]>(`/dc-orders?school_code=${encodeURIComponent(code)}`)
      if (results?.length) {
        setAllRows((prev) => {
          const existingIds = new Set(prev.map((i) => i._id))
          const mapped: Row[] = results
            .filter((r) => !existingIds.has(r._id))
            .map((r) => ({
              _id: r._id,
              dcNo: r.dc_code || '-',
              dcDate: r.createdAt || undefined,
              dcCategory: r.dcCategory || '',
              schoolName: r.school_name || '',
              schoolCode: r.school_code || '',
              schoolType: r.school_type || '',
              zone: r.zone || '',
              executive: r.assigned_to?.name || '',
              remarks: r.remarks || '',
              completedDate: r.updatedAt || undefined,
              poPhotoUrl: r.pod_proof_url || '',
              poDocument: r.pod_proof_url || '',
              isDcOrder: true,
            }))
          return [...prev, ...mapped]
        })
      }
    } catch (e) {
      // silently fail — local results still shown
    } finally {
      setBackendSearching(false)
    }
  }

  useEffect(() => {
    const code = filters.schoolCode
    const isCodeLike = /^[a-zA-Z]{2,5}\d*/i.test(code)
    if (!isCodeLike) return
    const t = setTimeout(() => searchBySchoolCode(code), 500)
    return () => clearTimeout(t)
  }, [filters.schoolCode])

  function actionPlaceholder(msg: string) {
    toast.message(msg)
  }

  const openRecordShortageDialog = async (row: Row) => {
    if (!row.dcId) {
      toast.error('DC id missing for this row')
      return
    }
    try {
      const fullDC = await apiRequest<any>(`/dc/${row.dcId}`)
      const dcOrderId = typeof fullDC.dcOrderId === 'object' ? fullDC.dcOrderId?._id : fullDC.dcOrderId
      const related = dcOrderId ? await apiRequest<any[]>(`/dc?dcOrderId=${encodeURIComponent(dcOrderId)}`) : []
      const consumed = new Map<string, number>()
      ;(Array.isArray(related) ? related : [])
        .filter((x: any) => x?.dcType === 'shortage')
        .filter((x: any) => {
          const parentId = typeof x?.parentDcId === 'object' ? x?.parentDcId?._id : x?.parentDcId
          return String(parentId || '') === String(fullDC._id)
        })
        .forEach((x: any) => {
          ;(x.productDetails || []).forEach((p: any) => {
            const key = `${(p.product || p.productName || '').toLowerCase()}::${(p.class || '').toLowerCase()}::${(p.category || '').toLowerCase()}::${(p.term || 'term 1').toLowerCase()}`
            const qty = Number(p.quantity || p.strength || 0)
            consumed.set(key, (consumed.get(key) || 0) + qty)
          })
        })

      const mappedRows = (Array.isArray(fullDC.productDetails) ? fullDC.productDetails : []).map((p: any, idx: number) => {
        const orderedQuantity = Number(p.quantity || p.strength || 0)
        const deliveredQuantity = Number(p.deliveredQuantity ?? orderedQuantity)
        const key = `${(p.product || p.productName || '').toLowerCase()}::${(p.class || '').toLowerCase()}::${(p.category || '').toLowerCase()}::${(p.term || 'term 1').toLowerCase()}`
        const alreadyRaised = Number(consumed.get(key) || 0)
        const calculatedShortage = Math.max(orderedQuantity - deliveredQuantity - alreadyRaised, 0)
        return {
          id: `${idx}-${p.product || p.productName || 'product'}`,
          product: p.product || p.productName || '',
          class: p.class || '1',
          category: p.category || 'new Students',
          term: p.term || 'Term 1',
          orderedQuantity,
          deliveredQuantity,
          shortageQuantity: Number(p.shortageQuantity ?? calculatedShortage),
        }
      })
      setShortageTargetDC(fullDC)
      setShortageRows(mappedRows)
      setShortageRemarks('')
      setShortageDialogOpen(true)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load DC details')
    }
  }

  const followUpRowKey = (row: Row) => row.dcId || row._id

  const handleFollowUpStudentTypeContinue = (row: Row) => {
    const id = followUpRowKey(row)
    const sel = followUpStudentTypeByDcId[id]
    if (!sel) {
      toast.error('Select a student type first')
      return
    }
    if (isShortageStudentType(sel)) {
      openRecordShortageDialog(row)
      return
    }
    toast.info('This student type is not available yet. Only Shortage is supported today.')
  }

  const submitShortageDC = async () => {
    if (!shortageTargetDC?._id) return
    const payloadRows = shortageRows
      .filter((r) => Number(r.shortageQuantity) > 0)
      .map((r) => ({
        product: r.product,
        class: r.class,
        category: r.category,
        term: r.term,
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
      await apiRequest(`/dc/${shortageTargetDC._id}/record-shortage`, {
        method: 'POST',
        body: JSON.stringify({
          productDetails: payloadRows,
          dcCategory: 'Shortage',
          dcRemarks: shortageRemarks || undefined,
        }),
      })
      toast.success('Shortage DC created successfully')
      setShortageDialogOpen(false)
      const targetId = shortageTargetDC._id
      setShortageTargetDC(null)
      setFollowUpStudentTypeByDcId((p) => {
        if (!targetId) return p
        const next = { ...p }
        delete next[targetId]
        return next
      })
      await load()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create shortage DC')
    } finally {
      setSavingShortage(false)
    }
  }

  const openEditDialog = async (row: Row) => {
    if (!row._id) {
      toast.error('Invalid DC ID. Cannot edit.')
      return
    }
    
    try {
      // Determine which ID to use for fetching
      const dcIdToFetch = row.dcId || row._id // Use dcId if available (for DcOrder entries), otherwise use _id
      
      // Try to fetch full DC details, but use row data as fallback
      let fullDC: any = null
      try {
        console.log('Fetching DC details for:', dcIdToFetch, 'isDcOrder:', row.isDcOrder)
        fullDC = await apiRequest<any>(`/dc/${dcIdToFetch}`)
        console.log('Fetched DC:', fullDC)
      } catch (err: any) {
        console.warn('Failed to fetch full DC details, using row data:', err)
        // Use row data as fallback
        fullDC = row
      }
      
      if (!fullDC) {
        toast.error('DC not found')
        return
      }
      
      // Preserve all row properties including isDcOrder and dcId
      setEditingDC({
        ...row,
        isDcOrder: row.isDcOrder,
        dcId: row.dcId,
      })
      setEditForm({
        transport: fullDC?.transport || row.transport || '',
        lrNo: fullDC?.lrNo || row.lrNo || '',
        boxes: fullDC?.boxes || row.boxes || '',
        dcCategory: fullDC?.dcCategory || row.dcCategory || 'Term 2',
        transportArea: fullDC?.transportArea || row.transportArea || '',
        lrDate: fullDC?.lrDate 
          ? new Date(fullDC.lrDate).toISOString().split('T')[0] 
          : row.lrDate 
            ? new Date(row.lrDate).toISOString().split('T')[0] 
            : '',
        lrCost: fullDC?.lrCost || row.lrCost || '',
        deliveryStatus: fullDC?.deliveryStatus || row.deliveryStatus || '',
        remarks: fullDC?.deliveryNotes || fullDC?.remarks || row.remarks || '',
      })
    } catch (err: any) {
      console.error('Error opening edit dialog:', err)
      toast.error(err?.message || 'Failed to load DC details')
    }
  }

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file')
        return
      }
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      setUploadedPdf(file)
      // Create preview URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setPdfPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const openReplacePdfDialog = async (row: Row) => {
    try {
      // Determine which ID to use for fetching
      const dcIdToFetch = row.dcId || row._id
      
      // Fetch the latest DC data to ensure we have the most recent PDF
      let fullDC: any = null
      try {
        fullDC = await apiRequest<any>(`/dc/${dcIdToFetch}`)
      } catch (err: any) {
        console.warn('Failed to fetch latest DC data, using row data:', err)
        fullDC = row
      }
      
      setReplacingPdfFor(row)
      setUploadedPdf(null)
      // Set preview if PDF exists
      const existingPdf = fullDC?.poDocument || fullDC?.poPhotoUrl || row.poDocument || row.poPhotoUrl
      if (existingPdf) {
        setPdfPreview(existingPdf)
      } else {
        setPdfPreview(null)
      }
    } catch (err: any) {
      console.error('Error opening replace PDF dialog:', err)
      toast.error(err?.message || 'Failed to load DC details')
    }
  }

  const generateDeliveryChallanPDF = async (dcId: string, formData: any) => {
    try {
      // Fetch full DC details with populated data
      const fullDC = await apiRequest<any>(`/dc/${dcId}`)
      
      if (!fullDC) {
        throw new Error('DC not found')
      }

      // Get address from dcOrderId (delivery and address)
      let address = ''
      if (fullDC.dcOrderId) {
        const dcOrder = typeof fullDC.dcOrderId === 'object' ? fullDC.dcOrderId : await apiRequest<any>(`/dc-orders/${fullDC.dcOrderId}`)
        if (dcOrder) {
          const addressParts = []
          if (dcOrder.transport_location) addressParts.push(dcOrder.transport_location)
          if (dcOrder.transport_name) addressParts.push(dcOrder.transport_name)
          if (dcOrder.transportation_landmark) addressParts.push(dcOrder.transportation_landmark)
          if (dcOrder.pincode) addressParts.push(dcOrder.pincode)
          address = addressParts.join(', ')
          
          // If no transport address, try regular address field
          if (!address && dcOrder.address) {
            address = dcOrder.address
          }
        }
      }

      // Get school information
      const dcOrderData = typeof fullDC.dcOrderId === 'object' ? fullDC.dcOrderId : null
      const schoolName = dcOrderData?.school_name || fullDC.customerName || ''
      const schoolCode = dcOrderData?.school_code || ''
      const phoneNo = dcOrderData?.contact_mobile || fullDC.customerPhone || ''
      const schoolType = dcOrderData?.school_type || 'Existing'
      const dcNo = fullDC.dc_code || (fullDC.dcNo ? fullDC.dcNo : fullDC._id.toString().slice(-6))
      const dcDate = fullDC.dcDate ? new Date(fullDC.dcDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')

      // Get product details
      const productDetails = fullDC.productDetails || []
      
      // Group products by class and student type (category)
      const groupedProducts: any[] = []
      productDetails.forEach((p: any) => {
        const classNum = p.class || '1'
        // Determine student type from category field
        // If category contains "New" or is "New Students", use "New Students", otherwise "Existing Students"
        let studentType = 'Existing Students'
        if (p.category) {
          if (p.category.toLowerCase().includes('new') || p.category === 'New Students') {
            studentType = 'New Students'
          } else {
            studentType = 'Existing Students'
          }
        }
        const productName = p.productName || p.product || ''
        const quantity = p.quantity || 0
        
        if (productName && quantity > 0) {
          groupedProducts.push({
            class: classNum,
            studentType,
            product: productName,
            qty: quantity
          })
        }
      })

      // Calculate total quantity
      const totalQty = groupedProducts.reduce((sum, p) => sum + (p.qty || 0), 0)

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      let yPos = 20

      // Header - Company Info (top left)
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text('II Floor, A.N.K Towers,', 10, yPos)
      pdf.text('KPHB Colony, Hyderabad-72', 10, yPos + 4)
      pdf.text('Land line: 040-64592499', 10, yPos + 8)
      pdf.text('Mobile: 09348 0999 33', 10, yPos + 12)

      // Delivery Challan Banner
      yPos = 50
      pdf.setFillColor(0, 102, 204) // Blue color
      pdf.rect(10, yPos, pageWidth - 20, 10, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Delivery Challan', pageWidth / 2, yPos + 7, { align: 'center' })

      yPos += 20

      // DC Information and Transit Information side by side
      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')

      // DC Information (Left)
      const leftX = 10
      const rightX = pageWidth / 2 + 5
      let infoY = yPos

      pdf.setFont('helvetica', 'bold')
      pdf.text('DC Information', leftX, infoY)
      pdf.setFont('helvetica', 'normal')
      infoY += 6

      pdf.text(`DC No: ${dcNo}`, leftX, infoY)
      infoY += 5
      pdf.text(`DC Date: ${dcDate}`, leftX, infoY)
      infoY += 5
      pdf.text(`School Type: ${schoolType}`, leftX, infoY)
      infoY += 5
      pdf.text(`School Name: ${schoolName}${schoolCode ? ` (${schoolCode})` : ''}`, leftX, infoY)
      infoY += 5
      pdf.text(`Phone No: ${phoneNo}`, leftX, infoY)
      infoY += 5
      pdf.text(`Address: ${address || ''}`, leftX, infoY)

      // Transit Information (Right)
      infoY = yPos
      pdf.setFont('helvetica', 'bold')
      pdf.text('Transit Information', rightX, infoY)
      pdf.setFont('helvetica', 'normal')
      infoY += 6

      pdf.text(`Transport: ${formData.transport || ''}`, rightX, infoY)
      infoY += 5
      pdf.text(`Transport Area: ${formData.transportArea || ''}`, rightX, infoY)
      infoY += 5
      pdf.text(`LR No: ${formData.lrNo || ''}`, rightX, infoY)
      infoY += 5
      pdf.text(`#Boxes: ${formData.boxes || ''}`, rightX, infoY)
      infoY += 5
      const lrDate = formData.lrDate ? new Date(formData.lrDate).toLocaleDateString('en-GB') : ''
      pdf.text(`LR Date: ${lrDate}`, rightX, infoY)
      infoY += 5
      pdf.text(`Remarks: ${formData.remarks || ''}`, rightX, infoY)

      // Product Table
      yPos = infoY + 15
      const tableStartY = yPos
      const tableWidth = pageWidth - 20
      const colWidths = [20, 45, 90, 25]
      const colHeaders = ['Class', 'Student Type', 'Product', 'Qty']
      const colX = [leftX, leftX + colWidths[0], leftX + colWidths[0] + colWidths[1], leftX + colWidths[0] + colWidths[1] + colWidths[2]]

      // Table Header
      pdf.setFillColor(240, 240, 240)
      pdf.rect(leftX, yPos, tableWidth, 8, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text(colHeaders[0], colX[0], yPos + 5)
      pdf.text(colHeaders[1], colX[1], yPos + 5)
      pdf.text(colHeaders[2], colX[2], yPos + 5)
      pdf.text(colHeaders[3], colX[3], yPos + 5)

      yPos += 8

      // Table Rows
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      groupedProducts.forEach((product) => {
        if (yPos > pageHeight - 50) {
          pdf.addPage()
          yPos = 20
          // Redraw table header on new page
          pdf.setFillColor(240, 240, 240)
          pdf.rect(leftX, yPos, tableWidth, 8, 'F')
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.text(colHeaders[0], colX[0], yPos + 5)
          pdf.text(colHeaders[1], colX[1], yPos + 5)
          pdf.text(colHeaders[2], colX[2], yPos + 5)
          pdf.text(colHeaders[3], colX[3], yPos + 5)
          yPos += 8
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(8)
        }
        
        // Handle text wrapping for long product names
        const maxProductWidth = colWidths[2] - 2
        const productLines = pdf.splitTextToSize(product.product, maxProductWidth)
        const rowHeight = Math.max(6, productLines.length * 3 + 2)
        
        pdf.text(product.class.toString(), colX[0], yPos + 4)
        pdf.text(product.studentType, colX[1], yPos + 4)
        pdf.text(productLines, colX[2], yPos + 4)
        pdf.text(product.qty.toString(), colX[3], yPos + 4)
        yPos += rowHeight
      })

      // Total Row
      yPos += 2
      pdf.setFont('helvetica', 'bold')
      pdf.setFillColor(240, 240, 240)
      pdf.rect(leftX, yPos, tableWidth, 8, 'F')
      pdf.text('Total', colX[2], yPos + 5)
      pdf.text(totalQty.toString(), colX[3], yPos + 5)

      // Footer
      yPos = pageHeight - 30
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(0, 0, 0)
      pdf.text('Viswam Edutech Solutions Pvt. Ltd', pageWidth - 10, yPos, { align: 'right' })
      
      // Footer bar
      yPos = pageHeight - 20
      pdf.setFillColor(0, 102, 204)
      
      // Footer text with proper wrapping
      const footerText = 'Viswam Edutech Solutions Pvt. Ltd. Third Floor, PLOT NO 88, VISWAM TOWERS, The Matrusri Cooperative House Building Soceity Ltd, Miyapur, Hyderabad, Telangana, 500049'
      const maxFooterWidth = pageWidth - 30 // Leave margins on both sides
      const footerLines = pdf.splitTextToSize(footerText, maxFooterWidth)
      
      // Calculate footer bar height based on number of lines
      const lineHeight = 3.5
      const footerBarHeight = Math.max(10, footerLines.length * lineHeight + 4) // Minimum 10mm, or based on content
      
      pdf.rect(10, yPos, pageWidth - 20, footerBarHeight, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(7)
      
      // Center the text vertically in the footer bar
      const totalFooterHeight = footerLines.length * lineHeight
      let footerY = yPos + (footerBarHeight - totalFooterHeight) / 2 + lineHeight
      
      footerLines.forEach((line: string) => {
        pdf.text(line, pageWidth / 2, footerY, { align: 'center' })
        footerY += lineHeight
      })

      // Convert PDF to base64
      const pdfBlob = pdf.output('blob')
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(pdfBlob)
      })

      return base64Pdf
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      throw new Error(error?.message || 'Failed to generate PDF')
    }
  }

  const handleReplacePdf = async () => {
    if (!replacingPdfFor || !uploadedPdf) {
      toast.error('Please select a PDF file to upload')
      return
    }
    
    // Determine which ID to use for updating
    let dcIdToUpdate: string | undefined
    
    if (replacingPdfFor.isDcOrder) {
      if (!replacingPdfFor.dcId) {
        toast.error('No corresponding DC found for this DcOrder entry. Cannot update.')
        return
      }
      dcIdToUpdate = replacingPdfFor.dcId
    } else {
      dcIdToUpdate = replacingPdfFor._id || replacingPdfFor.dcId
    }
    
    if (!dcIdToUpdate) {
      toast.error('Invalid DC ID. Cannot update.')
      return
    }
    
    setSaving(true)
    try {
      // Convert PDF to base64
      const base64Pdf = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(uploadedPdf)
      })
      
      const updateData = {
        poDocument: base64Pdf,
        poPhotoUrl: base64Pdf, // Also update poPhotoUrl for backward compatibility
      }
      
      const response = await apiRequest(`/dc/${dcIdToUpdate}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })
      
      console.log('PDF replacement response:', response)
      toast.success('PDF replaced successfully')
      setReplacingPdfFor(null)
      setUploadedPdf(null)
      setPdfPreview(null)
      await load() // Reload to show updated data
    } catch (err: any) {
      console.error('PDF replacement error:', err)
      const errorMessage = err?.message || err?.response?.data?.message || 'Failed to replace PDF'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingDC) return
    
    // Validate all fields are filled
    if (!editForm.transport || !editForm.transport.trim()) {
      toast.error('Transport is required')
      return
    }
    if (!editForm.lrNo || !editForm.lrNo.trim()) {
      toast.error('LR No is required')
      return
    }
    if (!editForm.boxes || !editForm.boxes.trim()) {
      toast.error('Boxes is required')
      return
    }
    if (!editForm.dcCategory) {
      toast.error('DC Category is required')
      return
    }
    if (!editForm.transportArea || !editForm.transportArea.trim()) {
      toast.error('Transport Area is required')
      return
    }
    if (!editForm.lrDate) {
      toast.error('LR Date is required')
      return
    }
    if (!editForm.lrCost || !editForm.lrCost.trim()) {
      toast.error('LR Cost is required')
      return
    }
    if (!editForm.deliveryStatus) {
      toast.error('Delivery Status is required')
      return
    }
    if (!editForm.remarks || !editForm.remarks.trim()) {
      toast.error('Remarks is required')
      return
    }
    
    // Determine which ID to use for updating
    // For DC entries: use _id directly
    // For DcOrder entries: use dcId (the corresponding DC ID)
    let dcIdToUpdate: string | undefined
    
    if (editingDC.isDcOrder) {
      // This is a DcOrder entry - we need the corresponding DC ID
      if (!editingDC.dcId) {
        toast.error('No corresponding DC found for this DcOrder entry. Cannot update. Please ensure a DC exists for this order.')
        return
      }
      dcIdToUpdate = editingDC.dcId
    } else {
      // This is a DC entry - use its own ID
      dcIdToUpdate = editingDC._id || editingDC.dcId
    }
    
    // Validate DC ID exists
    if (!dcIdToUpdate) {
      toast.error('Invalid DC ID. Cannot update.')
      return
    }
    
    setSaving(true)
    try {
      console.log('Updating DC:', {
        dcIdToUpdate,
        isDcOrder: editingDC.isDcOrder,
        originalId: editingDC._id,
        dcId: editingDC.dcId,
        data: editForm,
      })
      
      const updateData: any = {
        transport: editForm.transport || undefined,
        lrNo: editForm.lrNo || undefined,
        boxes: editForm.boxes || undefined,
        dcCategory: editForm.dcCategory || undefined,
        transportArea: editForm.transportArea || undefined,
        lrDate: editForm.lrDate || undefined,
        lrCost: editForm.lrCost || undefined,
        deliveryStatus: editForm.deliveryStatus || undefined,
        deliveryNotes: editForm.remarks || undefined,
      }
      
      // Remove undefined and empty string values (but keep lrCost even if empty since it's mandatory)
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || (updateData[key] === '' && key !== 'lrCost')) {
          delete updateData[key]
        }
      })
      
      // Ensure lrCost is always included if it was in editForm
      if (editForm.lrCost && editForm.lrCost.trim()) {
        updateData.lrCost = editForm.lrCost.trim()
      }
      
      const response = await apiRequest(`/dc/${dcIdToUpdate}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })
      
      console.log('Update response:', response)
      
      // Generate PDF after successful update
      try {
        toast.info('Generating PDF...')
        const pdfBase64 = await generateDeliveryChallanPDF(dcIdToUpdate, editForm)
        
        // Save PDF to database
        const pdfUpdateData = {
          poDocument: pdfBase64,
          poPhotoUrl: pdfBase64, // Also update poPhotoUrl for backward compatibility
        }
        
        await apiRequest(`/dc/${dcIdToUpdate}`, {
          method: 'PUT',
          body: JSON.stringify(pdfUpdateData),
        })
        
        toast.success('DC updated and PDF generated successfully')
      } catch (pdfError: any) {
        console.error('PDF generation error:', pdfError)
        toast.warning('DC updated but PDF generation failed: ' + (pdfError?.message || 'Unknown error'))
      }
      
      setEditingDC(null)
      await load() // Reload to show updated data
    } catch (err: any) {
      console.error('Update error:', err)
      const errorMessage = err?.message || err?.response?.data?.message || 'Failed to update DC'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const openPDF = async (row: Row) => {
    try {
      // Determine which ID to use for fetching
      const dcIdToFetch = row.dcId || row._id
      
      // Fetch the latest DC data to ensure we have the most recent PDF
      let latestDC: any = null
      try {
        latestDC = await apiRequest<any>(`/dc/${dcIdToFetch}`)
      } catch (err: any) {
        console.warn('Failed to fetch latest DC data, using row data:', err)
        // Fallback to row data if fetch fails
        latestDC = row
      }
      
      // Try to get PDF from the latest DC data, then fallback to row data
      const url = latestDC?.poDocument || latestDC?.poPhotoUrl || row.poDocument || row.poPhotoUrl
      
      if (url) {
        setPdfUrl(resolveUploadUrl(url))
        setPdfDC(row)
      } else {
        toast.error('No PDF document available for this DC')
      }
    } catch (err: any) {
      console.error('Error opening PDF:', err)
      // Fallback to row data
      const url = row.poPhotoUrl || row.poDocument
      if (url) {
        setPdfUrl(resolveUploadUrl(url))
        setPdfDC(row)
      } else {
        toast.error('No PDF document available for this DC')
      }
    }
  }

  const downloadCSV = () => {
    if (rows.length === 0) {
      toast.error('No data to export')
      return
    }

    // Define CSV headers
    const headers = [
      'S.No',
      'DC No',
      'DC Date',
      'DC Category',
      'DC Fin Year',
      'School Name',
      'School Code',
      'School Type',
      'Zone',
      'Executive',
      'Completed Date',
      'LR No',
      'LR Date',
      'LR Cost',
      'Remarks',
      'Delivery Status'
    ]

    // Convert rows to CSV format
    const csvRows = [
      headers.join(','),
      ...rows.map((r, idx) => {
        const row = [
          (idx + 1).toString(),
          r.dcNo || '',
          r.dcDate ? new Date(r.dcDate).toLocaleDateString() : '',
          r.dcCategory || 'Term 2',
          r.dcFinYear || '',
          `"${(r.schoolName || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
          r.schoolCode || '',
          r.schoolType || '',
          r.zone || '',
          r.executive || '',
          r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '',
          r.lrNo || '',
          r.lrDate ? new Date(r.lrDate).toLocaleDateString() : '',
          r.lrCost || '',
          `"${(r.remarks || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
          r.deliveryStatus || ''
        ]
        return row.join(',')
      })
    ]

    // Create CSV content
    const csvContent = csvRows.join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `completed-dc-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success('CSV file downloaded successfully')
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">DC Completed List</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Input placeholder="Zone" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} />
          <Input placeholder="Employee/Executive" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} />
          <Input placeholder="School Code" value={filters.schoolCode} onChange={(e) => setFilters({ ...filters, schoolCode: e.target.value })} />
          <Input placeholder="School Name" value={filters.schoolName} onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })} />
          <Select
            value={filters.schoolType || 'all'}
            onValueChange={(v) => setFilters({ ...filters, schoolType: v === 'all' ? '' : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="School Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All School Types</SelectItem>
              {SCHOOL_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="DC No" value={filters.dcNo} onChange={(e) => setFilters({ ...filters, dcNo: e.target.value })} />
          <Select value={filters.dcCategory || 'all'} onValueChange={(v) => setFilters({ ...filters, dcCategory: v === 'all' ? '' : v })}>
            <SelectTrigger>
              <SelectValue placeholder="DC Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Term 1">Term 1</SelectItem>
              <SelectItem value="Term 2">Term 2</SelectItem>
              <SelectItem value="Term 3">Term 3</SelectItem>
              <SelectItem value="Full Year">Full Year</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="LR No" value={filters.lrNo} onChange={(e) => setFilters({ ...filters, lrNo: e.target.value })} />
          <Select value={filters.deliveryStatus || 'all'} onValueChange={(v) => setFilters({ ...filters, deliveryStatus: v === 'all' ? '' : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Delivery Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="In Transit">In Transit</SelectItem>
              <SelectItem value="Delivered">Delivered</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label htmlFor="completed-dc-from">From Date</Label>
            <Input
              id="completed-dc-from"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="completed-dc-to">To Date</Label>
            <Input
              id="completed-dc-to"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={load}>Search</Button>
          {backendSearching && <span className="text-xs text-neutral-500">Searching backend...</span>}
          <Button onClick={() => {
            setFilters({
              zone: '',
              employee: '',
              schoolCode: '',
              schoolName: '',
              schoolType: '',
              dcNo: '',
              dcCategory: '',
              lrNo: '',
              deliveryStatus: '',
              fromDate: '',
              toDate: '',
            })
          }} variant="outline">Clear Filters</Button>
          <Button onClick={downloadCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mt-4">
          <Table className="min-w-[1400px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">S.No</TableHead>
                <TableHead>DC No</TableHead>
                <TableHead>DC Date</TableHead>
                <TableHead>DC Category</TableHead>
                <TableHead>DC Fin Year</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>School Type</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Executive</TableHead>
                <TableHead>Completed Date</TableHead>
                <TableHead>LR Info</TableHead>
                <TableHead>LR Date</TableHead>
                <TableHead>LR Cost</TableHead>
                <TableHead>Action 1</TableHead>
                <TableHead>Action 2</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Delivery Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={18} className="text-center text-neutral-500">No records</TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow 
                  key={r._id} 
                  className="cursor-pointer hover:bg-neutral-50"
                  onClick={(e) => {
                    // Don't trigger if clicking on buttons
                    if ((e.target as HTMLElement).closest('button')) return
                    openPDF(r)
                  }}
                >
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcNo}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcDate ? new Date(r.dcDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcCategory || 'Term 2'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcFinYear || '-'}</TableCell>
                  <TableCell className="truncate max-w-[220px]">{r.schoolName || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolCode || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.schoolType || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.zone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.executive || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.lrNo || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.lrDate ? new Date(r.lrDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.lrCost || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEditDialog(r) }}><Pencil size={14} /></Button>
                      {(r.poDocument || r.poPhotoUrl) && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            openPDF(r) 
                          }}
                          title="View PDF"
                        >
                          View PDF
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openReplacePdfDialog(r) 
                        }}
                        title="Replace PDF"
                      >
                        Replace PDF
                      </Button>
                      <div
                        className="flex flex-col gap-1 min-w-[200px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Select
                          value={followUpStudentTypeSelectValue(followUpStudentTypeByDcId[followUpRowKey(r)])}
                          onValueChange={(v) =>
                            setFollowUpStudentTypeByDcId((p) => ({
                              ...p,
                              [followUpRowKey(r)]: parseFollowUpStudentTypeSelectValue(v),
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs border-orange-200">
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
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFollowUpStudentTypeContinue(r)
                          }}
                          className="border-orange-200 text-orange-700 hover:bg-orange-50"
                        >
                          Continue
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); actionPlaceholder('Stock Return') }}>Stock Return</Button>
                  </TableCell>
                  <TableCell className="truncate max-w-[240px]">{r.remarks || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.deliveryStatus ? (
                      <Badge variant="outline">{r.deliveryStatus}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={shortageDialogOpen} onOpenChange={setShortageDialogOpen}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Shortage DC</DialogTitle>
            <DialogDescription>Original DC details are read-only. Enter shortage quantity by product.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
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
                            const next = [...prev]
                            next[idx] = { ...next[idx], shortageQuantity: capped }
                            return next
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
              <Input value={shortageRemarks} onChange={(e) => setShortageRemarks(e.target.value)} placeholder="Optional shortage note" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShortageDialogOpen(false)} disabled={savingShortage}>Cancel</Button>
            <Button onClick={submitShortageDC} disabled={savingShortage}>
              {savingShortage ? 'Creating...' : 'Create Shortage DC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDC} onOpenChange={(open) => {
        if (!open) {
          setEditingDC(null)
        }
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DC Information Update</DialogTitle>
            <DialogDescription>
              Update DC details for DC No: {editingDC?.dcNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center mb-4">
              <div className="text-lg font-semibold">DC No: {editingDC?.dcNo}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Transport <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.transport}
                  onChange={(e) => setEditForm({ ...editForm, transport: e.target.value })}
                  placeholder="Transport"
                  className={`mt-1 ${!editForm.transport || !editForm.transport.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <Label>LR No <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.lrNo}
                  onChange={(e) => setEditForm({ ...editForm, lrNo: e.target.value })}
                  placeholder="LR No"
                  className={`mt-1 ${!editForm.lrNo || !editForm.lrNo.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <Label>Boxes <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.boxes}
                  onChange={(e) => setEditForm({ ...editForm, boxes: e.target.value })}
                  placeholder="Boxes"
                  className={`mt-1 ${!editForm.boxes || !editForm.boxes.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <Label>DC Category <span className="text-red-500">*</span></Label>
                <Select value={editForm.dcCategory} onValueChange={(v) => setEditForm({ ...editForm, dcCategory: v })} required>
                  <SelectTrigger className={`mt-1 ${!editForm.dcCategory ? 'border-red-500' : ''}`}>
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
                <Label>Transport Area <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.transportArea}
                  onChange={(e) => setEditForm({ ...editForm, transportArea: e.target.value })}
                  placeholder="Transport Area"
                  className={`mt-1 ${!editForm.transportArea || !editForm.transportArea.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <Label>LR Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={editForm.lrDate}
                  onChange={(e) => setEditForm({ ...editForm, lrDate: e.target.value })}
                  className={`mt-1 ${!editForm.lrDate ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <Label>LR Cost <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={editForm.lrCost}
                  onChange={(e) => setEditForm({ ...editForm, lrCost: e.target.value })}
                  placeholder="LR Cost"
                  className={`mt-1 ${!editForm.lrCost || !editForm.lrCost.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div className="col-span-2">
                <Label>Delivery Status <span className="text-red-500">*</span></Label>
                <Select value={editForm.deliveryStatus} onValueChange={(v) => setEditForm({ ...editForm, deliveryStatus: v })} required>
                  <SelectTrigger className={`mt-1 ${!editForm.deliveryStatus ? 'border-red-500' : ''}`}>
                    <SelectValue placeholder="Select Delivery Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Remarks <span className="text-red-500">*</span></Label>
                <Input
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Remarks"
                  className={`mt-1 ${!editForm.remarks || !editForm.remarks.trim() ? 'border-red-500' : ''}`}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingDC(null)
            }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace PDF Dialog */}
      <Dialog open={!!replacingPdfFor} onOpenChange={(open) => {
        if (!open) {
          setReplacingPdfFor(null)
          setUploadedPdf(null)
          setPdfPreview(null)
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Replace PDF Document</DialogTitle>
            <DialogDescription>
              Replace PDF document for DC No: {replacingPdfFor?.dcNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>PDF Document</Label>
              <div className="mt-1 space-y-2">
                {pdfPreview && (
                  <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded border">
                    <FileText className="h-4 w-4 text-neutral-600" />
                    <span className="text-sm text-neutral-700 flex-1">
                      {uploadedPdf ? uploadedPdf.name : 'Current PDF document'}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setUploadedPdf(null)
                        setPdfPreview(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                    id="pdf-replace-upload"
                  />
                  <Label
                    htmlFor="pdf-replace-upload"
                    className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-md cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">{uploadedPdf ? 'Change PDF' : pdfPreview ? 'Replace PDF' : 'Upload PDF'}</span>
                  </Label>
                  {pdfPreview && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(pdfPreview, '_blank')
                      }}
                    >
                      View PDF
                    </Button>
                  )}
                </div>
                <p className="text-xs text-neutral-500">Upload a PDF file (max 10MB)</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setReplacingPdfFor(null)
              setUploadedPdf(null)
              setPdfPreview(null)
            }}>Cancel</Button>
            <Button onClick={handleReplacePdf} disabled={saving || !uploadedPdf}>
              {saving ? 'Replacing...' : 'Replace PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={!!pdfUrl} onOpenChange={(open) => {
        if (!open) {
          setPdfUrl(null)
          setPdfDC(null)
        }
      }}>
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>DC Document</DialogTitle>
            <DialogDescription>
              Viewing document for DC: {pdfDC?.dcNo || 'N/A'}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full h-[80vh] flex items-center justify-center bg-neutral-100 rounded">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full border-0"
                title="DC Document"
              />
            ) : (
              <div className="text-neutral-500">No document available</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfUrl(null)}>
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
