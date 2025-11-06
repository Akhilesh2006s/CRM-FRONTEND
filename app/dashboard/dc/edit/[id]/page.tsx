'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { apiRequest } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type DC = {
  _id: string
  saleId?: {
    _id: string
    customerName?: string
    product?: string
    quantity?: number
  }
  customerName?: string
  customerEmail?: string
  customerAddress?: string
  customerPhone?: string
  product?: string
  requestedQuantity?: number
  status?: string
  poPhotoUrl?: string
  employeeId?: {
    _id: string
    name?: string
    email?: string
  }
  deliveryNotes?: string
}

export default function EditDCPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const [dc, setDC] = useState<DC | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const data = await apiRequest<DC>(`/dc/${id}`)
        setDC(data)
      } catch (e: any) {
        setError(e?.message || 'Failed to load DC')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const update = (patch: Partial<DC>) => setDC((d) => (d ? { ...d, ...patch } : d))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dc) return
    setSaving(true)
    setError(null)
    try {
      const payload: any = {
        customerName: dc.customerName,
        customerEmail: dc.customerEmail,
        customerAddress: dc.customerAddress,
        customerPhone: dc.customerPhone,
        product: dc.product,
        requestedQuantity: dc.requestedQuantity,
        deliveryNotes: dc.deliveryNotes,
      }
      await apiRequest(`/dc/${dc._id}`, { method: 'PUT', body: JSON.stringify(payload) })
      alert('DC updated successfully!')
      router.back()
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-neutral-600">Loading...</div>
  }

  if (!dc) {
    return <div className="p-4 text-sm text-red-600">{error || 'DC not found'}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit DC</h1>
      <Card className="p-4 md:p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Customer Name</Label>
            <Input
              value={dc.customerName || dc.saleId?.customerName || ''}
              onChange={(e) => update({ customerName: e.target.value })}
            />
          </div>
          <div>
            <Label>Customer Email</Label>
            <Input
              type="email"
              value={dc.customerEmail || ''}
              onChange={(e) => update({ customerEmail: e.target.value })}
            />
          </div>
          <div>
            <Label>Customer Phone</Label>
            <Input
              value={dc.customerPhone || ''}
              onChange={(e) => update({ customerPhone: e.target.value })}
            />
          </div>
          <div>
            <Label>Product</Label>
            <Input
              value={dc.product || dc.saleId?.product || ''}
              onChange={(e) => update({ product: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Customer Address</Label>
            <Textarea
              value={dc.customerAddress || ''}
              onChange={(e) => update({ customerAddress: e.target.value })}
              rows={2}
            />
          </div>
          <div>
            <Label>Requested Quantity</Label>
            <Input
              type="number"
              min="1"
              value={dc.requestedQuantity || dc.saleId?.quantity || ''}
              onChange={(e) => update({ requestedQuantity: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Input value={dc.status || 'created'} disabled className="bg-gray-100" />
          </div>
          <div className="md:col-span-2">
            <Label>Employee</Label>
            <Input value={dc.employeeId?.name || '-'} disabled className="bg-gray-100" />
          </div>
          {dc.poPhotoUrl && (
            <div className="md:col-span-2">
              <Label>Purchase Order</Label>
              <div className="mt-2">
                <img
                  src={dc.poPhotoUrl}
                  alt="PO"
                  className="max-w-full h-auto max-h-64 rounded border cursor-pointer"
                  onClick={() => window.open(dc.poPhotoUrl, '_blank')}
                />
              </div>
            </div>
          )}
          <div className="md:col-span-2">
            <Label>Remarks / Notes</Label>
            <Textarea
              value={dc.deliveryNotes || ''}
              onChange={(e) => update({ deliveryNotes: e.target.value })}
              rows={4}
              placeholder="Add any remarks or notes about this DC..."
            />
          </div>
          {error && <div className="md:col-span-2 text-red-600 text-sm">{error}</div>}
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}