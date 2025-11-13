'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { Pencil, CreditCard, X, Upload, FileText } from 'lucide-react'

type Row = {
  _id: string
  dcNo: string
  dcDate?: string
  dcCategory?: string
  dcFinYear?: string
  schoolName?: string
  schoolCode?: string
  zone?: string
  executive?: string
  transport?: string
  lrNo?: string
  lrDate?: string
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
  const [loading, setLoading] = useState(true)
  const [editingDC, setEditingDC] = useState<Row | null>(null)
  const [editForm, setEditForm] = useState({
    transport: '',
    lrNo: '',
    boxes: '',
    dcCategory: '',
    transportArea: '',
    lrDate: '',
    deliveryStatus: '',
    remarks: '',
  })
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfDC, setPdfDC] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null)
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    zone: '',
    employee: '',
    schoolCode: '',
    schoolName: '',
    fromDate: '',
    toDate: '',
  })

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && qs.append(k, v))
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
        zone: dc.dcOrderId?.zone || '',
        executive: dc.employeeId?.name || dc.dcOrderId?.assigned_to?.name || '',
          transport: dc.transport || '',
          lrNo: dc.lrNo || '',
          lrDate: dc.lrDate || '',
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
            // Also copy PDF data from the matching DC
            row.poDocument = matchingDC.poDocument || matchingDC.poPhotoUrl || row.poDocument
            row.poPhotoUrl = matchingDC.poPhotoUrl || matchingDC.poDocument || row.poPhotoUrl
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
      
      setRows(allData)
      
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

  function actionPlaceholder(msg: string) {
    toast.message(msg)
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
        deliveryStatus: fullDC?.deliveryStatus || row.deliveryStatus || '',
        remarks: fullDC?.deliveryNotes || fullDC?.remarks || row.remarks || '',
      })
      // Reset PDF upload state
      setUploadedPdf(null)
      setPdfPreview(null)
      // Set preview if PDF exists
      const existingPdf = fullDC?.poDocument || fullDC?.poPhotoUrl || row.poDocument || row.poPhotoUrl
      if (existingPdf) {
        setPdfPreview(existingPdf)
      }
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

  const handleSaveEdit = async () => {
    if (!editingDC) return
    
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
        hasPdf: !!uploadedPdf
      })
      
      const updateData: any = {
        transport: editForm.transport || undefined,
        lrNo: editForm.lrNo || undefined,
        boxes: editForm.boxes || undefined,
        dcCategory: editForm.dcCategory || undefined,
        transportArea: editForm.transportArea || undefined,
        lrDate: editForm.lrDate || undefined,
        deliveryStatus: editForm.deliveryStatus || undefined,
        deliveryNotes: editForm.remarks || undefined,
      }
      
      // If PDF is uploaded, convert to base64 and include it
      if (uploadedPdf) {
        const base64Pdf = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const result = reader.result as string
            resolve(result)
          }
          reader.onerror = reject
          reader.readAsDataURL(uploadedPdf)
        })
        updateData.poDocument = base64Pdf
        updateData.poPhotoUrl = base64Pdf // Also update poPhotoUrl for backward compatibility
      }
      
      // Remove undefined and empty string values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined || updateData[key] === '') {
          delete updateData[key]
        }
      })
      
      const response = await apiRequest(`/dc/${dcIdToUpdate}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      })
      
      console.log('Update response:', response)
      toast.success('DC updated successfully')
      setEditingDC(null)
      setUploadedPdf(null)
      setPdfPreview(null)
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
        setPdfUrl(url)
        setPdfDC(row)
      } else {
        toast.error('No PDF document available for this DC')
      }
    } catch (err: any) {
      console.error('Error opening PDF:', err)
      // Fallback to row data
      const url = row.poPhotoUrl || row.poDocument
      if (url) {
        setPdfUrl(url)
        setPdfDC(row)
      } else {
        toast.error('No PDF document available for this DC')
      }
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">DC Completed List</h1>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-4">
          <Input placeholder="Select Zone" value={filters.zone} onChange={(e) => setFilters({ ...filters, zone: e.target.value })} />
          <Input placeholder="Select Employee" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} />
          <Input placeholder="By School Code" value={filters.schoolCode} onChange={(e) => setFilters({ ...filters, schoolCode: e.target.value })} />
          <Input placeholder="By School Name" value={filters.schoolName} onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })} />
          <Input type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
          <Input type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        </div>
        <div className="mt-3">
          <Button onClick={load}>Search</Button>
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
                <TableHead>Zone</TableHead>
                <TableHead>Executive</TableHead>
                <TableHead>Completed Date</TableHead>
                <TableHead>LR Info</TableHead>
                <TableHead>LR Date</TableHead>
                <TableHead>Action 1</TableHead>
                <TableHead>Action 2</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Delivery Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16} className="text-center text-neutral-500">No records</TableCell>
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
                  <TableCell className="whitespace-nowrap">{r.zone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.executive || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.lrNo || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.lrDate ? new Date(r.lrDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openPDF(r) 
                        }}
                        title="View PDF"
                      >
                        PDF
                      </Button>
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openEditDialog(r) }}><Pencil size={14} /></Button>
                      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); actionPlaceholder('Action: payment') }}><CreditCard size={14} /></Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); actionPlaceholder('Stock Return') }}>Stock Return</Button>
                  </TableCell>
                  <TableCell className="truncate max-w-[240px]">{r.remarks || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.deliveryStatus || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingDC} onOpenChange={(open) => {
        if (!open) {
          setEditingDC(null)
          setUploadedPdf(null)
          setPdfPreview(null)
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
                <Label>Transport</Label>
                <Input
                  value={editForm.transport}
                  onChange={(e) => setEditForm({ ...editForm, transport: e.target.value })}
                  placeholder="Transport"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>LR No</Label>
                <Input
                  value={editForm.lrNo}
                  onChange={(e) => setEditForm({ ...editForm, lrNo: e.target.value })}
                  placeholder="LR No"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Boxes</Label>
                <Input
                  value={editForm.boxes}
                  onChange={(e) => setEditForm({ ...editForm, boxes: e.target.value })}
                  placeholder="Boxes"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>DC Category</Label>
                <Select value={editForm.dcCategory} onValueChange={(v) => setEditForm({ ...editForm, dcCategory: v })}>
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
                <Label>Transport Area</Label>
                <Input
                  value={editForm.transportArea}
                  onChange={(e) => setEditForm({ ...editForm, transportArea: e.target.value })}
                  placeholder="Transport Area"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>LR Date</Label>
                <Input
                  type="date"
                  value={editForm.lrDate}
                  onChange={(e) => setEditForm({ ...editForm, lrDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
                <Label>Delivery Status</Label>
                <Select value={editForm.deliveryStatus} onValueChange={(v) => setEditForm({ ...editForm, deliveryStatus: v })}>
                  <SelectTrigger className="mt-1">
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
                <Label>Remarks</Label>
                <Input
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  placeholder="Remarks"
                  className="mt-1"
                />
              </div>
              <div className="col-span-2">
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
                      id="pdf-upload"
                    />
                    <Label
                      htmlFor="pdf-upload"
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingDC(null)
              setUploadedPdf(null)
              setPdfPreview(null)
            }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving...' : 'Update'}
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
