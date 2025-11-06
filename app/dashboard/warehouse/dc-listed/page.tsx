'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'

type DC = {
  _id: string
  dcOrderId?: {
    _id: string
    school_name?: string
    school_type?: string
    dc_code?: string
    contact_person?: string
    contact_mobile?: string
    zone?: string
    location?: string
  }
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  customerName?: string
  customerPhone?: string
  product?: string
  requestedQuantity?: number
  availableQuantity?: number
  deliverableQuantity?: number
  managerId?: {
    _id: string
    name?: string
  }
  warehouseId?: {
    _id: string
    name?: string
  }
  listedAt?: string
  createdAt?: string
}

export default function DCListedPage() {
  const [rows, setRows] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [openUpdateDialog, setOpenUpdateDialog] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [holding, setHolding] = useState(false)
  const [filters, setFilters] = useState({
    zone: '',
    schoolName: '',
    schoolCode: '',
    fromDate: '',
    toDate: '',
  })

  // Get current user to check role
  const currentUser = getCurrentUser()
  const isCoordinator = currentUser?.role === 'Coordinator'

  async function load() {
    setLoading(true)
    try {
      // Get all DCs with warehouse_processing status
      const allDCs = await apiRequest<DC[]>(`/dc?status=warehouse_processing`)
      
      console.log('All warehouse processing DCs:', allDCs.length)
      
      // Filter DCs where availableQuantity > deliverableQuantity and have listedAt timestamp
      const listedDCs = allDCs.filter(dc => {
        const availQty = Number(dc.availableQuantity || 0)
        const delivQty = Number(dc.deliverableQuantity || 0)
        const hasListedAt = dc.listedAt !== undefined && dc.listedAt !== null
        const hasValidQuantities = availQty > delivQty
        
        console.log(`DC ${dc._id}: avail=${availQty}, deliv=${delivQty}, listedAt=${hasListedAt}, valid=${hasValidQuantities}`)
        
        // Include if either has listedAt OR has valid quantities (in case listedAt wasn't set but quantities are valid)
        return (hasListedAt || hasValidQuantities) && hasValidQuantities
      })
      
      console.log('Filtered listed DCs:', listedDCs.length)

      // Apply additional filters
      let filtered = listedDCs
      if (filters.zone) {
        filtered = filtered.filter(dc => 
          (dc.dcOrderId?.zone || '').toLowerCase().includes(filters.zone.toLowerCase())
        )
      }
      if (filters.schoolName) {
        filtered = filtered.filter(dc => 
          (dc.dcOrderId?.school_name || dc.customerName || '').toLowerCase().includes(filters.schoolName.toLowerCase())
        )
      }
      if (filters.schoolCode) {
        filtered = filtered.filter(dc => 
          (dc.dcOrderId?.dc_code || '').toLowerCase().includes(filters.schoolCode.toLowerCase())
        )
      }

      setRows(filtered)
    } catch (err: any) {
      console.error('Failed to load listed DCs:', err)
      alert(err?.message || 'Failed to load DC listed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filters])

  const getDCNumber = (dc: DC) => {
    if (dc.createdAt) {
      const year = new Date(dc.createdAt).getFullYear()
      const shortYear = year.toString().slice(-2)
      const nextYear = (year + 1).toString().slice(-2)
      const dcId = dc._id.slice(-4)
      return `${shortYear}-${nextYear}/${dcId}`
    }
    return `DC-${dc._id.slice(-6)}`
  }

  const handleOpenUpdateDialog = (dc: DC) => {
    setSelectedDC(dc)
    setOpenUpdateDialog(true)
  }

  const handleCompleteDC = async () => {
    if (!selectedDC) return

    setCompleting(true)
    try {
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString(),
        }),
      })
      
      alert('DC marked as completed successfully! It will appear in Completed DC page.')
      setOpenUpdateDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to complete DC')
    } finally {
      setCompleting(false)
    }
  }

  const handleHoldDC = async () => {
    if (!selectedDC) return

    setHolding(true)
    try {
      const holdReason = `DC put on hold by Coordinator from DC Listed page.`
      
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'hold',
          holdReason: holdReason,
        }),
      })
      
      alert('DC put on hold successfully! It will appear in Hold DC page.')
      setOpenUpdateDialog(false)
      load()
    } catch (err: any) {
      alert(err?.message || 'Failed to put DC on hold')
    } finally {
      setHolding(false)
    }
  }

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">DC Listed</h1>
          <p className="text-sm text-neutral-600 mt-1">DCs with available quantity greater than deliverable quantity</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            placeholder="Filter by Zone"
            value={filters.zone}
            onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
          />
          <Input
            placeholder="Filter by School Name"
            value={filters.schoolName}
            onChange={(e) => setFilters({ ...filters, schoolName: e.target.value })}
          />
          <Input
            placeholder="Filter by School Code"
            value={filters.schoolCode}
            onChange={(e) => setFilters({ ...filters, schoolCode: e.target.value })}
          />
          <Input
            type="date"
            placeholder="From Date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          />
          <Input
            type="date"
            placeholder="To Date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
        </div>
      </Card>

      <Card className="p-6 rounded-lg border border-neutral-200">
        <div className="overflow-x-auto">
          <Table className="w-full" style={{ minWidth: '1400px' }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>DC No</TableHead>
                {isCoordinator && <TableHead className="bg-slate-100 min-w-[100px] px-4">Action</TableHead>}
                <TableHead>Listed Date</TableHead>
                <TableHead>School Name</TableHead>
                <TableHead>School Code</TableHead>
                <TableHead>School Type</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Contact Mobile</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Requested Qty</TableHead>
                <TableHead>Available Qty</TableHead>
                <TableHead>Deliverable Qty</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Warehouse Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={isCoordinator ? 16 : 15} className="text-center text-neutral-500">Loading...</TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isCoordinator ? 16 : 15} className="text-center text-neutral-500">No listed DCs found</TableCell>
                </TableRow>
              )}
              {rows.map((r, idx) => (
                <TableRow key={r._id} className="bg-white">
                  <TableCell className="whitespace-nowrap">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{getDCNumber(r)}</TableCell>
                  {isCoordinator && (
                    <TableCell className="whitespace-nowrap bg-white min-w-[100px] px-4">
                      <Button 
                        size="sm" 
                        onClick={() => handleOpenUpdateDialog(r)}
                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                      >
                        Update
                      </Button>
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    {r.listedAt ? new Date(r.listedAt).toLocaleDateString() : 
                     r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[160px]">
                    {r.dcOrderId?.school_name || r.customerName || r.saleId?.customerName || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcOrderId?.dc_code || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcOrderId?.school_type || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcOrderId?.zone || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcOrderId?.contact_person || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.dcOrderId?.contact_mobile || r.customerPhone || '-'}</TableCell>
                  <TableCell className="truncate max-w-[160px]">
                    {r.product || r.saleId?.product || '-'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.requestedQuantity || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold text-green-600">{r.availableQuantity || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.deliverableQuantity || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.managerId?.name || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.warehouseId?.name || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Update Dialog */}
      <Dialog open={openUpdateDialog} onOpenChange={setOpenUpdateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update DC Status</DialogTitle>
            <DialogDescription>
              Choose to complete this DC or put it on hold.
            </DialogDescription>
          </DialogHeader>
          {selectedDC && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-700">School Name</p>
                  <p className="text-sm text-neutral-600">
                    {selectedDC.dcOrderId?.school_name || selectedDC.customerName || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">DC Number</p>
                  <p className="text-sm text-neutral-600">{getDCNumber(selectedDC)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">Available Qty</p>
                  <p className="text-sm text-neutral-600 font-semibold text-green-600">
                    {selectedDC.availableQuantity || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-700">Deliverable Qty</p>
                  <p className="text-sm text-neutral-600">{selectedDC.deliverableQuantity || '-'}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setOpenUpdateDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleHoldDC}
              disabled={holding || completing}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {holding ? 'Processing...' : 'Hold DC'}
            </Button>
            <Button 
              onClick={handleCompleteDC}
              disabled={completing || holding}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {completing ? 'Processing...' : 'Complete DC'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

