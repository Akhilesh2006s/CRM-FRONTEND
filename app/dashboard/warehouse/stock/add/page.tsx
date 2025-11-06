'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

type Options = { products: string[]; uoms: string[]; itemTypes: string[]; vendors?: string[] }
type Item = { _id: string; productName: string; category?: string; level?: string }

export default function StockAddPage() {
  const router = useRouter()
  const params = useSearchParams()
  const productId = params?.get('productId') || ''

  const [products, setProducts] = useState<Item[]>([])
  const [vendors, setVendors] = useState<string[]>([])

  const [selectedProductLabel, setSelectedProductLabel] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [qty, setQty] = useState<string>('')
  const [comments, setComments] = useState<string>('')
  const [vendor, setVendor] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const opts = await apiRequest<Options>('/metadata/inventory-options')
        if (opts?.vendors) setVendors(opts.vendors)

        if (productId) {
          const item = await apiRequest<Item>(`/warehouse/${productId}`)
          setSelectedProductLabel(`${item.productName} — ${item.category || ''} ${item.level || ''}`.trim())
          setSelectedProductId(item._id)
        } else {
          // Load products from DB so we have ids to submit
          const list = await apiRequest<Item[]>('/warehouse')
          setProducts(list)
        }
      } catch (_) {}
    })()
  }, [productId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(qty)
    if (!amount || amount <= 0) {
      toast.error('Enter a valid inventory quantity')
      return
    }
    try {
      setSaving(true)
      await apiRequest('/warehouse/stock', {
        method: 'POST',
        body: JSON.stringify({
          productId: productId || selectedProductId, // row id or selected from dropdown
          quantity: amount,
          movementType: 'In',
          reason: comments || 'Manual add',
        }),
      })
      toast.success('Quantity updated')
      router.push('/dashboard/warehouse/stock')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update quantity')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Inventory Qty Add</h1>
      </div>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Product Type *</div>
            {productId ? (
              <Input value={selectedProductLabel || 'Loading…'} disabled />
            ) : (
              <Select value={selectedProductId} onValueChange={(val) => setSelectedProductId(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Inventory Item" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => {
                    const label = `${p.productName} — ${p.category || ''} ${p.level || ''}`.trim()
                    return (
                      <SelectItem key={p._id} value={p._id}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Inventory Qty *</div>
            <Input type="number" step="1" placeholder="Inventory Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Comments *</div>
            <Input placeholder="Remarks" value={comments} onChange={(e) => setComments(e.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Vendor</div>
            <Select value={vendor} onValueChange={setVendor}>
              <SelectTrigger>
                <SelectValue placeholder="Select Vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex gap-3">
            <Button type="submit" disabled={saving || (!selectedProductId && !productId) || !qty}>{saving ? 'Saving…' : 'Add Item'}</Button>
            <Button type="button" variant="destructive" onClick={() => router.push('/dashboard/warehouse/stock')}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}


