'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiRequest, resolveUploadUrl } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCurrentUser } from '@/lib/auth'
import { toast } from 'sonner'

type DC = {
  _id: string
  dc_code?: string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  dcOrderId?: {
    _id: string
    school_name?: string
    contact_person?: string
    contact_mobile?: string
    email?: string
    products?: any
    school_code?: string
    dc_code?: string
  }
  customerName?: string
  customerPhone?: string
  product?: string
  productDetails?: any[]
  status?: string
  poPhotoUrl?: string
  deliveryNotes?: string
  createdAt?: string
  employeeId?: {
    _id: string
    name?: string
    email?: string
    role?: string
  } | string
  createdBy?: {
    _id: string
    name?: string
    email?: string
    role?: string
  } | string
}

function personName(value: DC['employeeId'] | DC['createdBy']) {
  if (typeof value === 'object' && value?.name) return value.name
  return '—'
}

function productsLabel(d: DC) {
  if (d.productDetails && Array.isArray(d.productDetails) && d.productDetails.length > 0) {
    return d.productDetails
      .map((p: any) => p.productName || p.product_name || p.product)
      .filter(Boolean)
      .join(', ') || d.product || '—'
  }
  if (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products)) {
    return (
      d.dcOrderId.products
        .map((p: any) => p.product_name || p.product)
        .filter(Boolean)
        .join(', ') || d.product || '—'
    )
  }
  return d.product || d.saleId?.product || '—'
}

export default function AllCreatedDCsPage() {
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [allEmployees, setAllEmployees] = useState<{ _id: string; name: string }[]>([])

  const [raiseDialogOpen, setRaiseDialogOpen] = useState(false)
  const [selectedForRaise, setSelectedForRaise] = useState<DC | null>(null)
  const [raising, setRaising] = useState(false)

  const currentUser = getCurrentUser()
  const isSuperAdminUser =
    currentUser?.role === 'Super Admin' || Boolean((currentUser as any)?.isSuperAdmin)
  const isAdmin = currentUser?.role === 'Admin'
  const isCoordinator =
    currentUser?.role === 'Coordinator' || currentUser?.role === 'Senior Coordinator'
  // Super Admin / Admin / Coordinator — Create Sale auto-DCs list here.
  const canAccess = isSuperAdminUser || isAdmin || isCoordinator

  const load = async () => {
    setLoading(true)
    try {
      // Admin / Coordinator source of truth — complete created DC list.
      const data = await apiRequest<DC[] | { data?: DC[] }>(`/dc?status=created`)
      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
          ? (data as any).data
          : []

      let filtered = list
      if (filterEmployee) {
        filtered = list.filter((dc) => {
          const empId = typeof dc.employeeId === 'object' ? dc.employeeId?._id : dc.employeeId
          return String(empId) === String(filterEmployee)
        })
      }

      setItems(filtered)
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
      toast.error(`Error loading DCs: ${e?.message || 'Unknown error'}`)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const data = await apiRequest<any[]>('/employees?isActive=true')
      const list = Array.isArray(data) ? data : []
      setAllEmployees(
        list
          .map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' }))
          .filter((e) => e.name !== 'Unknown')
      )
    } catch (e) {
      console.error('Failed to load employees:', e)
    }
  }

  useEffect(() => {
    if (!canAccess) return
    load()
    loadEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterEmployee, canAccess])

  const openSubmitDialog = (dc: DC) => {
    setSelectedDC(dc)
    setPoPhotoUrl(dc.poPhotoUrl || '')
    setRemarks('')
    setOpenDialog(true)
  }

  const openViewDialog = (dc: DC) => {
    setSelectedDC(dc)
    setViewOpen(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPoPhotoUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmitPO = async () => {
    if (!selectedDC) return
    if (!poPhotoUrl.trim()) {
      toast.error('Please provide a PO photo URL or upload a file')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          poPhotoUrl,
          poDocument: poPhotoUrl,
          deliveryNotes: remarks || selectedDC.deliveryNotes,
        }),
      })
      toast.success('PO photo updated successfully!')
      setOpenDialog(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update PO photo')
    } finally {
      setSubmitting(false)
    }
  }

  const openRaiseDialog = (dc: DC) => {
    setSelectedForRaise(dc)
    setRaiseDialogOpen(true)
  }

  const confirmRaiseDc = async () => {
    if (!selectedForRaise) return

    const dcOrderId =
      typeof selectedForRaise.dcOrderId === 'object'
        ? selectedForRaise.dcOrderId?._id
        : selectedForRaise.dcOrderId

    if (!dcOrderId) {
      toast.error('No associated deal found for this DC.')
      return
    }

    setRaising(true)
    try {
      const orderProducts =
        typeof selectedForRaise.dcOrderId === 'object'
          ? selectedForRaise.dcOrderId?.products
          : undefined
      await apiRequest(`/dc-orders/${dcOrderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'dc_requested',
          dcRequestData: {
            requestedFrom: 'admin_raise_dc',
            productDetails: Array.isArray(orderProducts) ? orderProducts : undefined,
            requestedAt: new Date().toISOString(),
          },
        }),
      })
      toast.success('DC raised successfully. It will now appear in Closed Sales.')
      setRaiseDialogOpen(false)
      load()
    } catch (e: any) {
      toast.error(e?.message || 'Failed to raise DC')
    } finally {
      setRaising(false)
    }
  }

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
          <p className="text-neutral-600 mt-2">You do not have permission to access this page.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">All Created DCs</h1>
          <p className="text-sm text-neutral-500 mt-1">
            All automatically created DCs from Create Sale across the system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/dc/create">Create Sale</Link>
          </Button>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Label className="whitespace-nowrap">Filter by Executive:</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={filterEmployee}
            onChange={(e) => setFilterEmployee(e.target.value)}
          >
            <option value="">All Executives</option>
            {allEmployees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.name}
              </option>
            ))}
          </select>
          {filterEmployee && (
            <Button variant="outline" size="sm" onClick={() => setFilterEmployee('')}>
              Clear Filter
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-auto max-h-[calc(100vh-220px)]">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4">
            <p className="text-neutral-600">No DCs found with status &quot;created&quot;.</p>
            <p className="text-sm text-neutral-500 mt-2">
              DCs are automatically created when a Deal is created and assigned to an executive.
            </p>
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-sky-50/95 border-b text-neutral-700">
                <th className="py-2 px-3 text-left whitespace-nowrap">Created On</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">DC Number</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Created By</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Assigned Executive</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Customer Name</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Customer Phone</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Products</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">DC Status</th>
                <th className="py-2 px-3 text-left whitespace-nowrap">Action</th>
                <th className="py-2 px-3 text-right whitespace-nowrap">Raise DC</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3 whitespace-nowrap">
                    {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs whitespace-nowrap">
                    {d.dc_code || d.dcOrderId?.dc_code || d._id?.slice(-8) || '—'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">{personName(d.createdBy)}</td>
                  <td className="py-2 px-3 font-medium whitespace-nowrap">{personName(d.employeeId)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || '—'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {d.customerPhone || d.dcOrderId?.contact_mobile || '—'}
                  </td>
                  <td className="py-2 px-3 min-w-[160px]">{productsLabel(d)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        d.status === 'created'
                          ? 'bg-blue-100 text-blue-700'
                          : d.status === 'po_submitted'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {d.status || 'created'}
                    </span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openViewDialog(d)}>
                        View
                      </Button>
                      <Button size="sm" onClick={() => openSubmitDialog(d)}>
                        {d.poPhotoUrl ? 'Update Photo' : 'Add Photo'}
                      </Button>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="default" onClick={() => openRaiseDialog(d)}>
                      Raise DC
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>DC Details</DialogTitle>
            <DialogDescription>Automatically created DC from Create Sale.</DialogDescription>
          </DialogHeader>
          {selectedDC && (
            <div className="space-y-2 text-sm py-2">
              <p>
                <span className="text-neutral-500">DC Number:</span>{' '}
                {selectedDC.dc_code || selectedDC._id}
              </p>
              <p>
                <span className="text-neutral-500">Created On:</span>{' '}
                {selectedDC.createdAt ? new Date(selectedDC.createdAt).toLocaleString() : '—'}
              </p>
              <p>
                <span className="text-neutral-500">Created By:</span> {personName(selectedDC.createdBy)}
              </p>
              <p>
                <span className="text-neutral-500">Assigned Executive:</span>{' '}
                {personName(selectedDC.employeeId)}
              </p>
              <p>
                <span className="text-neutral-500">Customer:</span>{' '}
                {selectedDC.customerName || selectedDC.dcOrderId?.school_name || '—'}
              </p>
              <p>
                <span className="text-neutral-500">Phone:</span>{' '}
                {selectedDC.customerPhone || selectedDC.dcOrderId?.contact_mobile || '—'}
              </p>
              <p>
                <span className="text-neutral-500">Products:</span> {productsLabel(selectedDC)}
              </p>
              <p>
                <span className="text-neutral-500">Status:</span> {selectedDC.status || 'created'}
              </p>
              {selectedDC.poPhotoUrl && (
                <img
                  src={resolveUploadUrl(selectedDC.poPhotoUrl)}
                  alt="PO"
                  className="w-24 h-24 object-cover rounded border mt-2"
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedDC?.poPhotoUrl ? 'Update' : 'Add'} Purchase Order (PO) Photo
            </DialogTitle>
            <DialogDescription>
              {selectedDC?.poPhotoUrl ? 'Update' : 'Upload'} PO photo for{' '}
              {selectedDC?.customerName ||
                selectedDC?.saleId?.customerName ||
                selectedDC?.dcOrderId?.school_name ||
                'this DC'}
              <br />
              <span className="text-sm font-medium mt-1 block">
                Executive: {selectedDC ? personName(selectedDC.employeeId) : '—'}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>PO Photo URL or Upload File</Label>
              <Input
                type="text"
                placeholder="https://example.com/po.jpg"
                value={poPhotoUrl}
                onChange={(e) => setPoPhotoUrl(e.target.value)}
                className="mb-2"
              />
              <Input type="file" accept="image/*,application/pdf" onChange={handleFileChange} />
            </div>
            <div>
              <Label>Remarks (optional)</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Notes about this PO…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPO} disabled={submitting}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={raiseDialogOpen} onOpenChange={setRaiseDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Raise DC</DialogTitle>
            <DialogDescription>
              Move this deal into Closed Sales for{' '}
              {selectedForRaise?.customerName ||
                selectedForRaise?.dcOrderId?.school_name ||
                'this customer'}
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRaiseDialogOpen(false)} disabled={raising}>
              Cancel
            </Button>
            <Button onClick={confirmRaiseDc} disabled={raising}>
              {raising ? 'Raising…' : 'Confirm Raise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
