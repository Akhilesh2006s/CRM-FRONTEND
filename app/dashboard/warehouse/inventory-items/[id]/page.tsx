'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'

const DEFAULT_PRODUCT_OPTIONS = [
  'Abacus',
  'EELL',
  'Vedic Maths',
  'Brochure',
  'Profile-Book',
  'MathLab',
  'FACE',
  'NCERT',
  'SCIENCE-LAB',
  'BIOLOGY',
  'PHYSICS',
  'CHEMISTRY',
  'SOCIAL',
  'SCIENCE-LAB-OPERATORS',
  'CHARTS',
  'SY_CHARTS',
  'DVD',
  'SPORTS',
  'PUZZLES',
  'Senior_Math',
  'Math_Lab_Charts',
  'Stickers',
  'Specimens',
  'Jr_Math_Lab',
  'Jr_Math_Lab_Cluster_Boxes_Card',
  'SLIDES',
  'IIT',
  'CodeChamp',
  'Financial LE',
]
const DEFAULT_UOM_OPTIONS = ['Pieces (pcs)', 'boxes']
const DEFAULT_ITEM_TYPE_OPTIONS = ['Books', 'Question Paper', 'Instruments']

type Item = {
  _id: string
  productName: string
  category: string
  level?: string
  unit: string
  unitPrice: number
  itemType: string
}

export default function InventoryEditItemPage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '').toString()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [productOptions, setProductOptions] = useState<string[]>(DEFAULT_PRODUCT_OPTIONS)
  const [uomOptions, setUomOptions] = useState<string[]>(DEFAULT_UOM_OPTIONS)
  const [itemTypeOptions, setItemTypeOptions] = useState<string[]>(DEFAULT_ITEM_TYPE_OPTIONS)

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [unitPrice, setUnitPrice] = useState('')
  const [itemType, setItemType] = useState('')

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        // load options
        try {
          const opts = await apiRequest<{ products: string[]; uoms: string[]; itemTypes: string[] }>(
            '/metadata/inventory-options'
          )
          if (opts?.products?.length) setProductOptions(opts.products)
          if (opts?.uoms?.length) setUomOptions(opts.uoms)
          if (opts?.itemTypes?.length) setItemTypeOptions(opts.itemTypes)
        } catch (_) {}

        const item = await apiRequest<Item>(`/warehouse/${id}`)
        setProductName(item.productName || '')
        setCategory(item.category || '')
        setLevel(item.level || '')
        setUnit(item.unit || 'pcs')
        setUnitPrice(String(item.unitPrice ?? ''))
        setItemType(item.itemType || '')
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load item')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const price = parseFloat(unitPrice)
      await apiRequest(`/warehouse/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ productName, category, level, unit, unitPrice: price, itemType }),
      })
      toast.success('Item updated')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Edit Item</h1>
      </div>
      <Card className="p-6">
        {!loading && (
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Product *</div>
              <Select onValueChange={setProductName} value={productName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Category *</div>
              <Input placeholder="Category Name" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Level</div>
              <Input placeholder="Choose Level" value={level} onChange={(e) => setLevel(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">UOM *</div>
              <Select onValueChange={setUnit} value={unit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent>
                  {uomOptions.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Price *</div>
              <Input type="number" step="0.01" placeholder="Item Price" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Item Type *</div>
              <Select onValueChange={setItemType} value={itemType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Item Type" />
                </SelectTrigger>
                <SelectContent>
                  {itemTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || !productName || !category || !itemType || !unitPrice}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}


