'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, XCircle, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { getCurrentUser } from '@/lib/auth'
import { formatFlowProductName } from '@/lib/clientDcProductRows'

type PendingEdit = {
  school_name?: string
  contact_person?: string
  contact_mobile?: string
  contact_person2?: string
  contact_mobile2?: string
  email?: string
  address?: string
  school_type?: string
  zone?: string
  location?: string
  products?: Array<{
    product_name: string
    quantity: number
    unit_price: number
    term?: string
    productCategory?: string
    subject?: string
  }>
  pod_proof_url?: string
  remarks?: string
  total_amount?: number
  // Transport fields
  transport_name?: string
  transport_location?: string
  transportation_landmark?: string
  // Delivery and Address fields
  property_number?: string
  floor?: string
  tower_block?: string
  nearby_landmark?: string
  area?: string
  city?: string
  pincode?: string
  requestedBy?: { _id: string; name?: string; email?: string }
  requestedAt?: string
  status?: 'pending' | 'approved' | 'rejected'
  approvedBy?: { _id: string; name?: string }
  approvedAt?: string
  rejectionReason?: string
}

type DcOrder = {
  _id: string
  dc_code?: string
  school_name?: string
  school_code?: string
  school_type?: string
  contact_person?: string
  contact_mobile?: string
  email?: string
  address?: string
  location?: string
  zone?: string
  cluster?: string
  products?: Array<{ product_name: string; quantity: number; productCategory?: string; subject?: string }>
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
  pendingEdit?: PendingEdit
  // Delivery and Address fields
  property_number?: string
  floor?: string
  tower_block?: string
  nearby_landmark?: string
  area?: string
  city?: string
  pincode?: string
}

type Employee = {
  _id: string
  name: string
}

export default function ExecutiveManagerClosedSalesPage() {
  const [items, setItems] = useState<DcOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [viewEditDialogOpen, setViewEditDialogOpen] = useState(false)
  const [selectedEdit, setSelectedEdit] = useState<{ dcOrder: DcOrder; pendingEdit: PendingEdit } | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [assignedExecutives, setAssignedExecutives] = useState<string[]>([])

  // Load assigned executives
  useEffect(() => {
    const loadAssignedExecutives = async () => {
      try {
        const currentUser = getCurrentUser()
        if (currentUser?._id) {
          const empData = await apiRequest<Employee[]>(`/executive-managers/${currentUser._id}/employees`).catch(() => [])
          const executiveIds = (empData || []).map(emp => emp._id)
          setAssignedExecutives(executiveIds)
          console.log('Assigned executives:', executiveIds)
        }
      } catch (error) {
        console.error('Failed to load assigned executives:', error)
      }
    }
    loadAssignedExecutives()
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      // Get all DC orders to find items with pending edit requests
      let data: DcOrder[] = []
      try {
        const apiCallWithTimeout = (url: string, timeout = 15000) => {
          return Promise.race([
            apiRequest<any>(url),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ])
        }
        
        // Fetch all DC orders with pending edit requests
        // First, try to get all DC orders (without limit to ensure we get all pending edits)
        let allRes
        try {
          // Try fetching with a very high limit first
          allRes = await apiCallWithTimeout(`/dc-orders?limit=10000`)
        } catch (e) {
          console.warn('Failed to fetch with high limit, trying default:', e)
          // Fallback to default limit
          allRes = await apiCallWithTimeout(`/dc-orders`)
        }
        const allArray = Array.isArray(allRes) ? allRes : (allRes?.data || [])
        console.log(`Fetched ${allArray.length} DC orders total`)
        
        // Get items with pending edit requests from assigned executives only
        const itemsWithPendingEdit = allArray.filter((d: any) => {
          const hasPending = d.pendingEdit && d.pendingEdit.status === 'pending'
          if (!hasPending) return false
          
          // If no executives loaded yet, show all pending edits (will filter after executives are loaded)
          if (assignedExecutives.length === 0) {
            console.log('No assigned executives loaded yet, showing all pending edits temporarily')
            return true
          }
          
          // Check if the edit was requested by an assigned executive
          // Handle both populated object and string ID formats
          let requestedById = null
          if (d.pendingEdit.requestedBy) {
            if (typeof d.pendingEdit.requestedBy === 'object' && d.pendingEdit.requestedBy._id) {
              requestedById = String(d.pendingEdit.requestedBy._id)
            } else if (typeof d.pendingEdit.requestedBy === 'string') {
              requestedById = String(d.pendingEdit.requestedBy)
            }
          }
          
          // Also check if the DC Order is assigned to an assigned executive
          let assignedToId = null
          if (d.assigned_to) {
            if (typeof d.assigned_to === 'object' && d.assigned_to._id) {
              assignedToId = String(d.assigned_to._id)
            } else if (typeof d.assigned_to === 'string') {
              assignedToId = String(d.assigned_to)
            }
          }
          
          // Also check employeeId if it exists (for DCs linked to employees)
          let employeeId = null
          if (d.employeeId) {
            if (typeof d.employeeId === 'object' && d.employeeId._id) {
              employeeId = String(d.employeeId._id)
            } else if (typeof d.employeeId === 'string') {
              employeeId = String(d.employeeId)
            }
          }
          
          // Convert assigned executives to strings for comparison
          const assignedExecutivesStr = assignedExecutives.map(id => String(id))
          
          // Check if any of these IDs match assigned executives
          const requestedByMatches = requestedById && assignedExecutivesStr.includes(requestedById)
          const assignedToMatches = assignedToId && assignedExecutivesStr.includes(assignedToId)
          const employeeIdMatches = employeeId && assignedExecutivesStr.includes(employeeId)
          
          const isFromAssignedExecutive = requestedByMatches || assignedToMatches || employeeIdMatches
          
          // If requestedBy is not set but we have assignedTo or employeeId match, still show it
          // This handles cases where requestedBy might not be populated correctly
          if (hasPending && !requestedById && (assignedToMatches || employeeIdMatches)) {
            console.log('Found pending edit without requestedBy, but matches assignedTo/employeeId:', {
              id: d._id,
              school_name: d.school_name,
              assignedToId: assignedToId,
              employeeId: employeeId,
              assignedExecutives: assignedExecutives
            })
          }
          
          if (hasPending && !isFromAssignedExecutive) {
            console.log('Pending edit NOT from assigned executive:', {
              id: d._id,
              school_name: d.school_name,
              requestedById: requestedById,
              assignedToId: assignedToId,
              employeeId: employeeId,
              assignedExecutives: assignedExecutives,
              pendingEdit: d.pendingEdit
            })
          }
          
          return isFromAssignedExecutive
        })
        
        console.log(`Found ${itemsWithPendingEdit.length} items with pending edit requests`)
        data = itemsWithPendingEdit
      } catch (e) {
        console.error('Error loading PO edit requests:', e)
        data = []
      }
      
      // Normalize data
      const normalizedData = data.map((deal: any) => ({
        ...deal,
        school_name: deal.school_name || deal.schoolName || '',
        school_code: deal.school_code || deal.schoolCode || '',
        contact_person: deal.contact_person || deal.contactPerson || '',
        contact_mobile: deal.contact_mobile || deal.contactMobile || deal.mobile || '',
        zone: deal.zone || '',
        location: deal.location || deal.address || '',
        address: deal.address || deal.location || '',
        products: deal.products || [],
        assigned_to: deal.assigned_to || deal.assignedTo,
        school_type: deal.school_type || deal.schoolType || '',
        dc_code: deal.dc_code || deal.dcCode || '',
        remarks: deal.remarks || '',
        cluster: deal.cluster || '',
        pod_proof_url: deal.pod_proof_url || deal.podProofUrl || null,
        pendingEdit: deal.pendingEdit || null,
        // Delivery and Address fields
        property_number: deal.property_number || '',
        floor: deal.floor || '',
        tower_block: deal.tower_block || '',
        nearby_landmark: deal.nearby_landmark || '',
        area: deal.area || '',
        city: deal.city || '',
        pincode: deal.pincode || '',
      }))
      
      // Sort by edit request date (most recent first)
      const sortedData = normalizedData.sort((a: any, b: any) => {
        const dateA = new Date(a.pendingEdit?.requestedAt || a.createdAt || a.created_at || 0).getTime()
        const dateB = new Date(b.pendingEdit?.requestedAt || b.createdAt || b.created_at || 0).getTime()
        return dateB - dateA
      })
      
      setItems(sortedData)
    } catch (e: any) {
      console.error('Failed to load closed sales:', e)
      toast.error(e?.message || 'Failed to load closed sales')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Load initially and reload when assigned executives are loaded
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedExecutives.length]) // Reload when executives list changes

  const getProductsDisplay = (deal: DcOrder) => {
    if (!deal.products || !Array.isArray(deal.products)) return '-'
    return deal.products
      .map((p) => {
        const label = formatFlowProductName(p.product_name, p.productCategory, p.subject)
        return `${label}${p.quantity ? ` - ${p.quantity}` : ''}`
      })
      .join(', ')
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$2-$1').replace(', ', ' ')
  }

  const openEditViewDialog = async (dcOrder: DcOrder) => {
    if (dcOrder.pendingEdit) {
      // Fetch full DcOrder to ensure we have all fields including delivery address
      try {
        const fullDcOrder = await apiRequest<DcOrder>(`/dc-orders/${dcOrder._id}`)
        console.log('Full DcOrder loaded:', {
          property_number: fullDcOrder.property_number,
          floor: fullDcOrder.floor,
          pendingEdit_property_number: fullDcOrder.pendingEdit?.property_number,
          pendingEdit_floor: fullDcOrder.pendingEdit?.floor,
        })
        console.log('Full pendingEdit object:', JSON.stringify(fullDcOrder.pendingEdit, null, 2))
        const pendingEditData = fullDcOrder.pendingEdit || dcOrder.pendingEdit
        setSelectedEdit({ 
          dcOrder: {
            ...dcOrder,
            // Ensure delivery address fields are included from main DcOrder
            property_number: fullDcOrder.property_number || dcOrder.property_number || '',
            floor: fullDcOrder.floor || dcOrder.floor || '',
            tower_block: fullDcOrder.tower_block || dcOrder.tower_block || '',
            nearby_landmark: fullDcOrder.nearby_landmark || dcOrder.nearby_landmark || '',
            area: fullDcOrder.area || dcOrder.area || '',
            city: fullDcOrder.city || dcOrder.city || '',
            pincode: fullDcOrder.pincode || dcOrder.pincode || '',
          }, 
          pendingEdit: {
            ...pendingEditData,
            // Ensure delivery address fields are included from pendingEdit
            property_number: pendingEditData?.property_number || '',
            floor: pendingEditData?.floor || '',
            tower_block: pendingEditData?.tower_block || '',
            nearby_landmark: pendingEditData?.nearby_landmark || '',
            area: pendingEditData?.area || '',
            city: pendingEditData?.city || '',
            pincode: pendingEditData?.pincode || '',
          }
        })
      } catch (e) {
        console.error('Failed to load full DcOrder:', e)
        // Fallback to using the dcOrder we have
        setSelectedEdit({ 
          dcOrder, 
          pendingEdit: {
            ...dcOrder.pendingEdit,
            // Ensure delivery address fields exist even if empty
            property_number: dcOrder.pendingEdit?.property_number || '',
            floor: dcOrder.pendingEdit?.floor || '',
            tower_block: dcOrder.pendingEdit?.tower_block || '',
            nearby_landmark: dcOrder.pendingEdit?.nearby_landmark || '',
            area: dcOrder.pendingEdit?.area || '',
            city: dcOrder.pendingEdit?.city || '',
            pincode: dcOrder.pendingEdit?.pincode || '',
          }
        })
      }
      setViewEditDialogOpen(true)
    }
  }

  const handleApproveEdit = async (dcOrderId: string) => {
    setApproving(dcOrderId)
    try {
      await apiRequest(`/dc-orders/${dcOrderId}/approve-edit`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'approve' }),
      })
      toast.success('PO edit request approved successfully! Changes have been applied to the database and will be reflected in all closed sales views.')
      setViewEditDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve edit request')
    } finally {
      setApproving(null)
    }
  }

  const handleRejectEdit = async (dcOrderId: string) => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    
    setRejecting(dcOrderId)
    try {
      await apiRequest(`/dc-orders/${dcOrderId}/approve-edit`, {
        method: 'PUT',
        body: JSON.stringify({ 
          action: 'reject',
          rejectionReason: rejectionReason.trim(),
        }),
      })
      toast.success('Edit request rejected')
      setViewEditDialogOpen(false)
      setRejectionReason('')
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reject edit request')
    } finally {
      setRejecting(null)
    }
  }

  // Filter to show only items with pending edit requests
  const editRequestItems = items.filter((item) => 
    item.pendingEdit && item.pendingEdit.status === 'pending'
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">PO Edit Request</h1>
        <p className="text-sm text-neutral-600 mt-1">Review and approve/reject PO edit requests from Executives</p>
      </div>

      {/* Search/Filter Section */}
      <Card className="p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input placeholder="By School Name" />
          <Input placeholder="By Contact Mobile No" />
          <Input type="date" placeholder="From Date" />
          <Input type="date" placeholder="To Date" />
          <Input placeholder="Select Zone" />
          <Input placeholder="Select Executive" />
          <Input placeholder="By Town" />
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">Search</Button>
        </div>
      </Card>

      {/* PO Edit Requests Table */}
      <Card className="p-0 overflow-x-auto shadow-sm">
        {loading && <div className="p-6 text-neutral-600">Loading...</div>}
        {!loading && editRequestItems.length === 0 && (
          <div className="p-6 text-neutral-500 text-center">
            <p>No pending PO edit requests found.</p>
            <p className="text-sm mt-2">Executives can submit edit requests from their Client DC page.</p>
          </div>
        )}
        {!loading && editRequestItems.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow className="bg-neutral-50">
                <TableHead className="font-semibold">S.No</TableHead>
                <TableHead className="font-semibold">Created On</TableHead>
                <TableHead className="font-semibold">School Type</TableHead>
                <TableHead className="font-semibold">Zone</TableHead>
                <TableHead className="font-semibold">Town</TableHead>
                <TableHead className="font-semibold">School Code</TableHead>
                <TableHead className="font-semibold">School Name</TableHead>
                <TableHead className="font-semibold">Executive</TableHead>
                <TableHead className="font-semibold">Mobile</TableHead>
                <TableHead className="font-semibold">Products</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editRequestItems.map((d, index) => (
                <TableRow
                  key={d._id}
                  className={`bg-orange-50 border-l-4 border-orange-500 ${index % 2 === 0 ? '' : 'bg-orange-100/50'}`}
                >
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{formatDate(d.created_at || d.createdAt)}</TableCell>
                  <TableCell>{d.school_type || '-'}</TableCell>
                  <TableCell>{d.zone || '-'}</TableCell>
                  <TableCell>{d.location || d.address?.split(',')[0] || '-'}</TableCell>
                  <TableCell className="font-medium text-blue-700">{d.school_code || '-'}</TableCell>
                  <TableCell className="font-medium">{d.school_name || '-'}</TableCell>
                  <TableCell>{d.assigned_to?.name || d.pendingEdit?.requestedBy?.name || '-'}</TableCell>
                  <TableCell>{d.contact_mobile || '-'}</TableCell>
                  <TableCell className="text-xs">{getProductsDisplay(d)}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      Edit Pending
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditViewDialog(d)}
                      className="border-orange-300 hover:bg-orange-100"
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Take Action
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* View Edit Dialog */}
      <Dialog open={viewEditDialogOpen} onOpenChange={setViewEditDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] lg:max-w-[1000px] max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>PO Edit Request - {selectedEdit?.dcOrder.school_name || 'Client'}</DialogTitle>
            <DialogDescription>
              Review the PO edit changes requested by Executive. Delivery address has already been saved directly. Approve or reject the other changes.
            </DialogDescription>
          </DialogHeader>
          
          {selectedEdit && (
            <div className="space-y-6 py-4">
              {/* PO Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>School Name</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.school_name || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Contact Person</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.contact_person || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Contact Mobile</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.contact_mobile || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Contact Person 2</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.contact_person2 || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Contact Mobile 2</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.contact_mobile2 || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.email || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Zone</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.zone || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input 
                    value={selectedEdit.pendingEdit.location || ''} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Address</Label>
                  <Textarea 
                    value={selectedEdit.pendingEdit.address || ''} 
                    disabled 
                    className="bg-neutral-50" 
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <Input 
                    type="number"
                    value={selectedEdit.pendingEdit.total_amount || 0} 
                    disabled 
                    className="bg-neutral-50" 
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea 
                    value={selectedEdit.pendingEdit.remarks || ''} 
                    disabled 
                    className="bg-neutral-50" 
                    rows={3}
                  />
                </div>
              </div>

              {/* Delivery and Address - Already saved directly (no approval needed) */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <Label className="text-lg font-semibold">Delivery and Address</Label>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">Already Saved</span>
                </div>
                <p className="text-xs text-neutral-500 mb-4">Delivery address was saved directly to the database and does not require approval.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Property Number</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.property_number || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Floor</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.floor || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Tower/Block</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.tower_block || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Nearby Landmark</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.nearby_landmark || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Area</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.area || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.city || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                  <div>
                    <Label>Pincode</Label>
                    <Input 
                      value={selectedEdit.dcOrder?.pincode || ''} 
                      disabled 
                      className="bg-neutral-50" 
                    />
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="border-t pt-4">
                <Label className="text-lg font-semibold mb-4 block">Products</Label>
                <div className="space-y-2">
                  {selectedEdit.pendingEdit.products && selectedEdit.pendingEdit.products.length > 0 ? (
                    selectedEdit.pendingEdit.products.map((p, idx) => (
                      <div key={idx} className="p-3 bg-neutral-50 rounded border">
                        <div className="text-sm">
                          <span className="font-medium">Product:</span>{' '}
                          {formatFlowProductName(p.product_name, p.productCategory, p.subject)}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Quantity:</span> {p.quantity}
                        </div>
                        {p.unit_price && (
                          <div className="text-sm">
                            <span className="font-medium">Unit Price:</span> {p.unit_price}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-neutral-400 p-3 bg-neutral-50 rounded">No products</div>
                  )}
                </div>
              </div>

              {/* Request Info */}
              <div className="border-t pt-4">
                <div className="text-sm text-neutral-600">
                  <p><strong>Requested by:</strong> {selectedEdit.pendingEdit.requestedBy?.name || 'Unknown'}</p>
                  <p><strong>Requested at:</strong> {formatDate(selectedEdit.pendingEdit.requestedAt)}</p>
                </div>
              </div>

              {/* Rejection Reason Input */}
              <div className="border-t pt-4">
                <Label>Rejection Reason (if rejecting)</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewEditDialogOpen(false)
                setRejectionReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRejectEdit(selectedEdit!.dcOrder._id)}
              disabled={rejecting === selectedEdit?.dcOrder._id || !rejectionReason.trim()}
            >
              {rejecting === selectedEdit?.dcOrder._id ? (
                'Rejecting...'
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
            <Button
              onClick={() => handleApproveEdit(selectedEdit!.dcOrder._id)}
              disabled={approving === selectedEdit?.dcOrder._id}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approving === selectedEdit?.dcOrder._id ? (
                'Approving...'
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

