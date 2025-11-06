'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function InventoryNewItemPage() {
  const router = useRouter()
  const [productName, setProductName] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [unit, setUnit] = useState<string>('pcs')
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [itemType, setItemType] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [productOptions, setProductOptions] = useState<string[]>(DEFAULT_PRODUCT_OPTIONS)
  const [uomOptions, setUomOptions] = useState<string[]>(DEFAULT_UOM_OPTIONS)
  const [itemTypeOptions, setItemTypeOptions] = useState<string[]>(DEFAULT_ITEM_TYPE_OPTIONS)

  useEffect(() => {
    ;(async () => {
      try {
        const opts = await apiRequest<{ products: string[]; uoms: string[]; itemTypes: string[] }>(
          '/metadata/inventory-options'
        )
        if (opts?.products?.length) setProductOptions(opts.products)
        if (opts?.uoms?.length) setUomOptions(opts.uoms)
        if (opts?.itemTypes?.length) setItemTypeOptions(opts.itemTypes)
      } catch (_) {}
    })()
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const price = parseFloat(unitPrice)
      await apiRequest('/warehouse', {
        method: 'POST',
        body: JSON.stringify({ productName, category, level, unit, unitPrice: price, itemType }),
      })
      toast.success('Item added')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Item Details</h1>
      </div>
      <Card className="p-6">
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
              {saving ? 'Adding…' : 'Add Item'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}



