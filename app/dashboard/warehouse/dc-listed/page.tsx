'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiRequest } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth'
import { sortDcsNewestFirst } from '@/lib/dcListSort'
import {
  mapInventoryIdentityOntoDcRow,
  requiredQtyFromDcRow,
} from '@/lib/warehouseInventoryMatch'
import { consolidateStockRows } from '@/lib/warehouseStockList'

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  level?: string
  specs?: string
  subject?: string
  currentStock: number
}

type ProductDetail = {
  product?: string
  productName?: string
  class?: string
  category?: string
  productCategory?: string
  specs?: string
  subject?: string
  level?: string
  term?: string
  quantity?: number
  strength?: number
  availableQuantity?: number
  deliverableQuantity?: number
}

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
  productDetails?: ProductDetail[]
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

function toStockRow(p: Record<string, any>) {
  return {
    product: p.product || p.productName || '',
    productName: p.productName || p.product || '',
    class: p.class,
    category: p.category,
    productCategory: p.productCategory,
    specs: p.specs,
    subject: p.subject,
    level: p.level,
    term: p.term,
    quantity: p.quantity,
    strength: p.strength,
    availableQuantity: p.availableQuantity,
  }
}

async function loadStockRecords(): Promise<WarehouseItem[]> {
  const stockList = await apiRequest<WarehouseItem[]>('/warehouse/stock-list').catch(() => [])
  if (Array.isArray(stockList) && stockList.length > 0) {
    return stockList.map((row) => ({
      ...row,
      currentStock: Number(row.currentStock) || 0,
    }))
  }
  const inventory = await apiRequest<WarehouseItem[]>('/warehouse').catch(() => [])
  return consolidateStockRows(Array.isArray(inventory) ? inventory : []).map((row) => ({
    _id: row._id,
    productName: row.productName,
    category: row.category,
    level: row.level,
    specs: row.specs,
    subject: row.subject,
    currentStock: row.currentStock,
  }))
}

function computeDcQuantities(dc: DC, inventory: WarehouseItem[]) {
  const rows =
    Array.isArray(dc.productDetails) && dc.productDetails.length > 0
      ? dc.productDetails
      : [
          {
            product: dc.product,
            productName: dc.product,
            quantity: dc.requestedQuantity || 0,
            deliverableQuantity: dc.deliverableQuantity,
            availableQuantity: dc.availableQuantity,
          },
        ]

  let totalAvailable = 0
  let totalDeliverable = 0

  for (const p of rows) {
    const stockRow = toStockRow(p)
    const mapped = mapInventoryIdentityOntoDcRow(stockRow, inventory)
    const availableQty = Number(p.availableQuantity ?? mapped.availableQuantity ?? 0)
    const requestedQty = requiredQtyFromDcRow(stockRow)
    const deliverableQty =
      p.deliverableQuantity !== undefined && p.deliverableQuantity !== null
        ? Number(p.deliverableQuantity)
        : requestedQty
    totalAvailable += availableQty
    totalDeliverable += deliverableQty
  }

  return { totalAvailable, totalDeliverable }
}

function isListedDc(dc: DC, inventory: WarehouseItem[]) {
  const { totalAvailable, totalDeliverable } = computeDcQuantities(dc, inventory)
  const hasListedAt = dc.listedAt !== undefined && dc.listedAt !== null
  // Partial delivery (stock left over) or shortage (cannot fulfill full deliverable qty)
  return hasListedAt || totalAvailable > totalDeliverable || totalAvailable < totalDeliverable
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
      const [pendingDCs, inventory] = await Promise.all([
        apiRequest<DC[]>('/dc/pending-warehouse'),
        loadStockRecords(),
      ])

      const listedDCs = (Array.isArray(pendingDCs) ? pendingDCs : [])
        .filter((dc) => isListedDc(dc, inventory))
        .map((dc) => {
          const { totalAvailable, totalDeliverable } = computeDcQuantities(dc, inventory)
          return {
            ...dc,
            availableQuantity: totalAvailable,
            deliverableQuantity: totalDeliverable,
          }
        })

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
      if (filters.fromDate || filters.toDate) {
        filtered = filtered.filter((dc) => {
          const dateValue = dc.listedAt || dc.createdAt
          if (!dateValue) return false
          const date = new Date(dateValue)
          if (filters.fromDate && date < new Date(filters.fromDate)) return false
          if (filters.toDate && date > new Date(`${filters.toDate}T23:59:59.999`)) return false
          return true
        })
      }

      setRows(sortDcsNewestFirst(filtered))
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
          <p className="text-sm text-neutral-600 mt-1">
            DCs at warehouse where available stock differs from deliverable quantity
          </p>
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
          <div>
            <Label htmlFor="dc-listed-start-date">Start Date</Label>
            <Input
              type="date"
              id="dc-listed-start-date"
              value={filters.fromDate}
              onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="dc-listed-end-date">End Date</Label>
            <Input
              type="date"
              id="dc-listed-end-date"
              value={filters.toDate}
              onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
              className="mt-1.5"
            />
          </div>
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

