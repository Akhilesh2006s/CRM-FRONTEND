'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

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
}

export default function MyDCPage() {
  const [items, setItems] = useState<DC[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDC, setSelectedDC] = useState<DC | null>(null)
  const [poPhotoUrl, setPoPhotoUrl] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [openDialog, setOpenDialog] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      // Load all DCs for the employee
      const data = await apiRequest<DC[]>(`/dc/employee/my`)
      console.log('Loaded DCs:', data)
      // Filter to show only 'created' status DCs (ready for PO submission)
      const createdDCs = data.filter(dc => dc.status === 'created')
      console.log('Filtered to created status:', createdDCs)
      setItems(createdDCs)
    } catch (e: any) {
      console.error('Failed to load DCs:', e)
      alert(`Error loading DCs: ${e?.message || 'Unknown error'}. Check console for details.`)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
      alert('Please provide a PO photo URL or upload a file')
      return
    }

    setSubmitting(true)
    try {
      await apiRequest(`/dc/${selectedDC._id}/submit-po`, {
        method: 'POST',
        body: JSON.stringify({ poPhotoUrl, remarks }),
      })
      alert('PO submitted successfully!')
      setOpenDialog(false)
      load()
    } catch (e: any) {
      alert(e?.message || 'Failed to submit PO')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">My DCs - Submit PO</h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>
      <Card className="p-0 overflow-x-auto">
        {loading && <div className="p-4">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-4">
            <p className="text-neutral-600">No DCs found with status "created" for PO submission.</p>
            <p className="text-sm text-neutral-500 mt-2">
              DCs are automatically created when you create a Deal and assign it to an employee. 
              Make sure the Deal has an "Assigned To" executive selected.
            </p>
          </div>
        )}
        {!loading && items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sky-50/70 border-b text-neutral-700">
                <th className="py-2 px-3 text-left">Created On</th>
                <th className="py-2 px-3 text-left">Customer Name</th>
                <th className="py-2 px-3 text-left">Customer Phone</th>
                <th className="py-2 px-3 text-left">Product</th>
                <th className="py-2 px-3 text-left">Status</th>
                <th className="py-2 px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d._id} className="border-b last:border-0">
                  <td className="py-2 px-3">{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-'}</td>
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
                  <td className="py-2 px-3 text-right">
                    {d.status === 'created' ? (
                      <Button size="sm" onClick={() => openSubmitDialog(d)}>Submit PO</Button>
                    ) : (
                      <span className="text-sm text-gray-500">PO Submitted</span>
                    )}
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
            <DialogTitle>Submit Purchase Order (PO)</DialogTitle>
            <DialogDescription>
              Upload PO photo for {selectedDC?.customerName || selectedDC?.saleId?.customerName || selectedDC?.dcOrderId?.school_name || 'this DC'}
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
              {submitting ? 'Submitting...' : 'Submit PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}