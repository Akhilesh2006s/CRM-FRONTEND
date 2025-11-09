'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
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
  }
  customerName?: string
  customerPhone?: string
  product?: string
  status?: string
  poPhotoUrl?: string
  createdAt?: string
  employeeId?: {
    _id: string
    name?: string
    email?: string
  } | string
}

export default function AdminMyDCPage() {
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [allEmployees, setAllEmployees] = useState<{ _id: string; name: string }[]>([])

  const currentUser = getCurrentUser()
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'Super Admin'

  const load = async () => {
    setLoading(true)
    try {
      // Load all DCs with status 'created' (not filtered by employee)
      const data = await apiRequest<DC[]>(`/dc?status=created`)
      console.log('Loaded all created DCs:', data)
      
      // Filter by employee if selected
      let filtered = data
      if (filterEmployee) {
        filtered = data.filter(dc => {
          const empId = typeof dc.employeeId === 'object' ? dc.employeeId?._id : dc.employeeId
          return empId === filterEmployee
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
      setAllEmployees(list.map((u: any) => ({ _id: u._id || u.id, name: u.name || 'Unknown' })).filter(e => e.name !== 'Unknown'))
    } catch (e) {
      console.error('Failed to load employees:', e)
    }
  }

  useEffect(() => {
    load()
    loadEmployees()
  }, [filterEmployee])

  const openSubmitDialog = (dc: DC) => {
    setSelectedDC(dc)
    setPoPhotoUrl(dc.poPhotoUrl || '')
    setRemarks('')
    setOpenDialog(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Convert to base64 data URL
      const reader = new FileReader()
      reader.onloadend = () => {
        setPoPhotoUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const submitPO = async () => {
    if (!selectedDC || !poPhotoUrl) {
      toast.error('Please provide a PO photo URL or upload a file')
      return
    }

    setSubmitting(true)
    try {
      // Admin can update PO photo directly via PUT endpoint
      await apiRequest(`/dc/${selectedDC._id}`, {
        method: 'PUT',
        body: JSON.stringify({ 
          poPhotoUrl, 
          poDocument: poPhotoUrl,
          deliveryNotes: remarks || selectedDC.deliveryNotes 
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

  const getExecutiveName = (dc: DC) => {
    if (typeof dc.employeeId === 'object' && dc.employeeId?.name) {
      return dc.employeeId.name
    }
    return 'Not Assigned'
  }

  if (!isAdmin) {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">All Created DCs - Admin View</h1>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      {/* Filter by Employee */}
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

      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4">
            <p className="text-neutral-600">No DCs found with status "created".</p>
            <p className="text-sm text-neutral-500 mt-2">
              DCs are automatically created when a Deal is created and assigned to an employee.
            </p>
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Created On</th>
                <th className="py-2 px-3 text-left">Executive Name</th>
                <th className="py-2 px-3 text-left">Customer Name</th>
                <th className="py-2 px-3 text-left">Customer Phone</th>
                <th className="py-2 px-3 text-left">Product</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3 text-left">PO Photo</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d._id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="py-2 px-3 font-medium">{getExecutiveName(d)}</td>
                  <td className="py-2 px-3">{d.customerName || d.saleId?.customerName || d.dcOrderId?.school_name || '-'}</td>
                  <td className="py-2 px-3">{d.customerPhone || d.dcOrderId?.contact_mobile || '-'}</td>
                  <td className="py-2 px-3">{d.product || d.saleId?.product || (d.dcOrderId?.products && Array.isArray(d.dcOrderId.products) ? d.dcOrderId.products.map((p: any) => p.product_name || p.product).join(', ') : '-')}</td>
                  <td className="py-2 px-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      d.status === 'created' ? 'bg-blue-100 text-blue-700' :
                      d.status === 'po_submitted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {d.status || 'created'}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {d.poPhotoUrl ? (
                      <img
                        src={d.poPhotoUrl}
                        alt="PO"
                        className="w-12 h-12 object-cover rounded border cursor-pointer"
                        onClick={() => window.open(d.poPhotoUrl, '_blank')}
                        title="Click to view full size"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">No photo</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Button size="sm" onClick={() => openSubmitDialog(d)}>
                      {d.poPhotoUrl ? 'Update Photo' : 'Add Photo'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{selectedDC?.poPhotoUrl ? 'Update' : 'Add'} Purchase Order (PO) Photo</DialogTitle>
            <DialogDescription>
              {selectedDC?.poPhotoUrl ? 'Update' : 'Upload'} PO photo for {selectedDC?.customerName || selectedDC?.saleId?.customerName || selectedDC?.dcOrderId?.school_name || 'this DC'}
              <br />
              <span className="text-sm font-medium mt-1 block">
                Executive: {selectedDC ? getExecutiveName(selectedDC) : '-'}
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
              <Input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
              {poPhotoUrl && poPhotoUrl.startsWith('data:') && (
                <div className="mt-2">
                  <img src={poPhotoUrl} alt="PO Preview" className="max-w-full h-auto max-h-48 rounded border" />
                </div>
              )}
              {selectedDC?.poPhotoUrl && !poPhotoUrl.startsWith('data:') && poPhotoUrl === selectedDC.poPhotoUrl && (
                <div className="mt-2">
                  <Label className="text-sm text-gray-600">Current Photo:</Label>
                  <img src={selectedDC.poPhotoUrl} alt="Current PO" className="max-w-full h-auto max-h-48 rounded border mt-1" />
                </div>
              )}
            </div>
            <div>
              <Label>Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any remarks about the PO..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={submitPO} disabled={submitting || !poPhotoUrl}>
              {submitting ? 'Updating...' : selectedDC?.poPhotoUrl ? 'Update Photo' : 'Add Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}




