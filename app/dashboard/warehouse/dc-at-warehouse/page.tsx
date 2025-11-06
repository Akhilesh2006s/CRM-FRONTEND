'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type DC = {
  _id: string
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
  requestedQuantity?: number
  availableQuantity?: number
  deliverableQuantity?: number
  poPhotoUrl?: string
  managerId?: {
    _id: string
    name?: string
  }
  managerRequestedAt?: string
}

export default function WarehouseDcAtWarehouse() {
  const router = useRouter()
  const [rows, setRows] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [availableQuantity, setAvailableQuantity] = useState('')
  const [deliverableQuantity, setDeliverableQuantity] = useState('')
  const [remarks, setRemarks] = useState('')
  const [processing, setProcessing] = useState(false)
  const [onHoldProcessing, setOnHoldProcessing] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [insufficientQuantity, setInsufficientQuantity] = useState(false)

  // Get current user to check role
  const currentUser = getCurrentUser()
  const isManager = currentUser?.role === 'Manager'
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  async function load() {
    try {
      const data = await apiRequest<DC[]>(`/dc/pending-warehouse`)
      setRows(data)
    } catch (err: any) {
      console.error('Failed to load DC list:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openProcessDialog = (dc: DC) => {
    setSelectedDC(dc)
    setAvailableQuantity(String(dc.availableQuantity || ''))
    setDeliverableQuantity(String(dc.deliverableQuantity || dc.requestedQuantity || ''))
    setRemarks('')
    setInsufficientQuantity(false)
    setOpenDialog(true)
  }

  // Check if available quantity meets requirements when values change
  useEffect(() => {
    if (openDialog && selectedDC && availableQuantity && deliverableQuantity) {
      const availQty = Number(availableQuantity)
      const delivQty = Number(deliverableQuantity)
      if (!isNaN(availQty) && !isNaN(delivQty)) {
        if (availQty < delivQty) {
          setInsufficientQuantity(true)
        } else {
          setInsufficientQuantity(false)
        }
      }
    } else {
      setInsufficientQuantity(false)
    }
  }, [availableQuantity, deliverableQuantity, openDialog, selectedDC])

  const processDC = async () => {
    if (!selectedDC) return

    const availQty = availableQuantity ? Number(availableQuantity) : undefined
    const delivQty = deliverableQuantity ? Number(deliverableQuantity) : undefined

    if (delivQty !== undefined && delivQty < 0) {
      alert('Deliverable quantity cannot be negative')
      return
    }

    // Only proceed if available quantity is greater than deliverable quantity
    if (availQty === undefined || delivQty === undefined || availQty <= delivQty) {
      alert('Available quantity must be greater than deliverable quantity to proceed.')
      return
    }

    setProcessing(true)
    try {
      // Process the DC in warehouse (this will automatically set listedAt if available > deliverable)
      await apiRequest(`/dc/${selectedDC._id}/warehouse-process`, {
        method: 'POST',
        body: JSON.stringify({
          availableQuantity: availQty,
          deliverableQuantity: delivQty,
          remarks,
        }),
      })
      
      alert('DC processed successfully! It will appear in DC listed page.')
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

    const availQty = availableQuantity ? Number(availableQuantity) : undefined
    const delivQty = deliverableQuantity ? Number(deliverableQuantity) : undefined

    if (availQty === undefined || delivQty === undefined || availQty >= delivQty) {
      alert('Available quantity must be less than deliverable quantity to put on hold.')
      return
    }

    setOnHoldProcessing(true)
    try {
      // Update quantities and status directly
      const holdReason = `Available quantity (${availQty}) is less than deliverable quantity (${delivQty}). ${remarks ? `Remarks: ${remarks}` : ''}`
      
      // Update DC with quantities and set status to 'hold'
      // Note: warehouseId will be set by backend from req.user if needed
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          availableQuantity: availQty,
          deliverableQuantity: delivQty,
          status: 'hold',
          holdReason: holdReason,
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
                <TableHead>Product</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-neutral-500">No pending DCs</TableCell>
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
                  <TableCell className="truncate max-w-[160px]">{r.product || r.saleId?.product || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.requestedQuantity || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.managerId?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {(isManager || isAdmin) && (
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process DC - Update Quantities</DialogTitle>
            <DialogDescription>
              Check available quantity and set deliverable quantity, then submit to continue workflow.
            </DialogDescription>
          </DialogHeader>
          {selectedDC && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <div className="text-sm text-neutral-700">{selectedDC.customerName || selectedDC.saleId?.customerName || '-'}</div>
                </div>
                <div>
                  <Label>Product</Label>
                  <div className="text-sm text-neutral-700">{selectedDC.product || selectedDC.saleId?.product || '-'}</div>
                </div>
                <div>
                  <Label>Requested Quantity (from Manager)</Label>
                  <div className="text-sm text-neutral-700 font-medium">{selectedDC.requestedQuantity || '-'}</div>
                </div>
                <div>
                  <Label>Manager</Label>
                  <div className="text-sm text-neutral-700">{selectedDC.managerId?.name || '-'}</div>
                </div>
              </div>
              
              {selectedDC.poPhotoUrl && (
                <div>
                  <Label>Purchase Order</Label>
                  <div className="mt-2">
                    <img
                      src={selectedDC.poPhotoUrl}
                      alt="PO"
                      className="max-w-full h-auto max-h-48 rounded border cursor-pointer"
                      onClick={() => window.open(selectedDC.poPhotoUrl, '_blank')}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Available Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  value={availableQuantity}
                  onChange={(e) => setAvailableQuantity(e.target.value)}
                  placeholder="Enter available quantity in warehouse"
                />
                <p className="text-xs text-neutral-500 mt-1">Enter the quantity available in warehouse inventory</p>
              </div>

              <div>
                <Label>Deliverable Quantity *</Label>
                <Input
                  type="number"
                  min="0"
                  value={deliverableQuantity}
                  onChange={(e) => setDeliverableQuantity(e.target.value)}
                  placeholder="Enter deliverable quantity"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">Final quantity to be delivered (cannot exceed requested quantity)</p>
                {insufficientQuantity && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ Available quantity is not sufficient. DC will be put on hold.
                  </p>
                )}
              </div>

              <div>
                <Label>Remarks (Optional)</Label>
                <Textarea
                  placeholder="Add any remarks about quantities..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            {isManager && insufficientQuantity ? (
              <>
                <Button 
                  onClick={putOnHold} 
                  disabled={onHoldProcessing || !deliverableQuantity || !availableQuantity}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {onHoldProcessing ? 'Processing...' : 'Put on Hold'}
                </Button>
                <Button 
                  disabled={true}
                  variant="outline"
                  className="opacity-50 cursor-not-allowed"
                >
                  Update & Submit (Disabled)
                </Button>
              </>
            ) : (
              <Button 
                onClick={processDC} 
                disabled={processing || !deliverableQuantity || !availableQuantity || 
                  !(Number(availableQuantity) > Number(deliverableQuantity))}
              >
                {processing ? 'Processing...' : 'Update & Submit'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}