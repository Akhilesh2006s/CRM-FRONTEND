'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'

type Item = {
  _id: string
  productName: string
  category: string
  level?: string
  specs?: string
  subject?: string
  itemType?: string
  unitPrice: number
  currentStock?: number
}

type WarehouseRow = { productName?: string; category?: string }
type InventoryOptions = { itemTypes?: string[] }

export default function InventoryEditItemPage() {
  const params = useParams<{ id: string }>()
  const id = (params?.id || '').toString()
  const router = useRouter()
  const {
    productNames: productOptions,
    getProductLevels,
    getProductSpecs,
    getProductSubjects,
    hasProductSubjects,
    getProductCategories,
    hasProductCategories,
  } = useProducts()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [warehouseItems, setWarehouseItems] = useState<WarehouseRow[]>([])

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [specs, setSpecs] = useState('Regular')
  const [subject, setSubject] = useState('')
  const [itemType, setItemType] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [updateQty, setUpdateQty] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const [opts, list] = await Promise.all([
          apiRequest<InventoryOptions>('/metadata/inventory-options').catch(() => ({})),
          apiRequest<WarehouseRow[]>('/warehouse').catch(() => []),
        ])
        if (opts?.itemTypes?.length) setItemTypes(opts.itemTypes)
        setWarehouseItems(Array.isArray(list) ? list : [])
      } catch (_) {}
    })()
  }, [])

  const categoryOptions = useMemo(() => {
    if (!productName) return []
    const fromCatalog = getProductCategories(productName)
    if (fromCatalog.length > 0) return fromCatalog
    const fromWarehouse = [
      ...new Set(
        warehouseItems
          .filter((w) => w.productName === productName && w.category)
          .map((w) => w.category as string)
      ),
    ]
    if (category && !fromWarehouse.includes(category)) fromWarehouse.unshift(category)
    return fromWarehouse
  }, [productName, getProductCategories, warehouseItems, category])

  useEffect(() => {
    if (productName) {
      const levels = getProductLevels(productName)
      if (levels.length > 0 && !levels.includes(level)) {
        setLevel(levels[0])
      }
      const availableSpecs = getProductSpecs(productName)
      if (availableSpecs.length > 0 && !availableSpecs.includes(specs)) {
        setSpecs(availableSpecs[0])
      }
      if (!hasProductSubjects(productName)) {
        setSubject('')
      }
    }
  }, [productName, getProductLevels, getProductSpecs, hasProductSubjects])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const item = await apiRequest<Item>(`/warehouse/${id}`)
        setProductName(item.productName || '')
        setCategory(item.category || '')
        setLevel(item.level || '')
        setSpecs(item.specs || 'Regular')
        setSubject(item.subject || '')
        setItemType(item.itemType || '')
        setUnitPrice(String(item.unitPrice ?? ''))
        setUpdateQty(String(item.currentStock ?? 0))
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load item')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (productName && hasProductSubjects(productName) && !subject) {
      toast.error('Subject is required for this product')
      return
    }
    if (!itemType) {
      toast.error('Item Type is required')
      return
    }
    if (!category) {
      toast.error('Category is required')
      return
    }

    setSaving(true)
    try {
      const price = parseFloat(unitPrice)
      const qty = parseFloat(updateQty)
      if (isNaN(qty) || qty < 0) {
        toast.error('Please enter a valid quantity (0 or greater)')
        setSaving(false)
        return
      }
      await apiRequest(`/warehouse/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          productName,
          category,
          level,
          specs: specs || 'Regular',
          subject: subject || undefined,
          itemType,
          unitPrice: price,
          currentStock: qty,
        }),
      })
      toast.success('Item updated')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update item')
    } finally {
      setSaving(false)
    }
  }

  const categoryIsSelect =
    productName && (hasProductCategories(productName) || categoryOptions.length > 0)

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
              <Select
                onValueChange={(value) => {
                  setProductName(value)
                  const availableLevels = getProductLevels(value)
                  if (!availableLevels.includes(level)) {
                    setLevel(availableLevels.length > 0 ? availableLevels[0] : '')
                  }
                  const availableSpecs = getProductSpecs(value)
                  if (availableSpecs.length > 0 && !availableSpecs.includes(specs)) {
                    setSpecs(availableSpecs[0])
                  }
                  const cats = getProductCategories(value)
                  if (cats.length > 0) setCategory(cats[0])
                  if (!hasProductSubjects(value)) setSubject('')
                }}
                value={productName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Product" />
                </SelectTrigger>
                <SelectContent>
                  {productOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Category *</div>
              {categoryIsSelect ? (
                <Select value={category} onValueChange={setCategory} disabled={!productName}>
                  <SelectTrigger>
                    <SelectValue placeholder={productName ? 'Select Category' : 'Select Product first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="Category Name"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Item Type *</div>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Item Type" />
                </SelectTrigger>
                <SelectContent>
                  {itemTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Level</div>
              <Select onValueChange={setLevel} value={level} disabled={!productName}>
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Level' : 'Select Product first'} />
                </SelectTrigger>
                <SelectContent>
                  {productName &&
                    getProductLevels(productName).map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        {lvl}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Specs</div>
              <Select onValueChange={setSpecs} value={specs} disabled={!productName}>
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Specs' : 'Select Product first'} />
                </SelectTrigger>
                <SelectContent>
                  {productName &&
                    getProductSpecs(productName).map((spec) => (
                      <SelectItem key={spec} value={spec}>
                        {spec}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {productName && hasProductSubjects(productName) && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Subject *</div>
                <Select onValueChange={setSubject} value={subject || undefined} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Subject *" />
                  </SelectTrigger>
                  <SelectContent>
                    {getProductSubjects(productName).map((subj) => (
                      <SelectItem key={subj} value={subj}>
                        {subj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Price *</div>
              <Input
                type="number"
                step="0.01"
                placeholder="Item Price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Update qty *</div>
              <Input
                type="number"
                step="1"
                min="0"
                placeholder="Quantity"
                value={updateQty}
                onChange={(e) => setUpdateQty(e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={
                  saving ||
                  !productName ||
                  !category ||
                  !itemType ||
                  !unitPrice ||
                  !updateQty ||
                  (hasProductSubjects(productName) && !subject)
                }
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
