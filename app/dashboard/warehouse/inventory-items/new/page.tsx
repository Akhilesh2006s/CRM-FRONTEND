'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'

type WarehouseRow = { productName?: string; category?: string }
type InventoryOptions = { itemTypes?: string[] }

export default function InventoryNewItemPage() {
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
  const [productName, setProductName] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [specs, setSpecs] = useState<string>('Regular')
  const [subject, setSubject] = useState<string>('')
  const [itemType, setItemType] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [itemTypes, setItemTypes] = useState<string[]>([])
  const [warehouseItems, setWarehouseItems] = useState<WarehouseRow[]>([])

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
    return fromWarehouse
  }, [productName, getProductCategories, warehouseItems])

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
      const cats = getProductCategories(productName)
      if (cats.length > 0 && !cats.includes(category)) {
        setCategory(cats[0])
      } else if (categoryOptions.length > 0 && !categoryOptions.includes(category)) {
        setCategory(categoryOptions[0])
      }
    }
  }, [productName, getProductLevels, getProductSpecs, hasProductSubjects, getProductCategories, categoryOptions])

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
      const qty = parseFloat(quantity) || 0
      await apiRequest('/warehouse', {
        method: 'POST',
        body: JSON.stringify({
          productName,
          category,
          level,
          specs: specs || 'Regular',
          subject: subject || undefined,
          itemType,
          currentStock: qty,
        }),
      })
      toast.success('Item added')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const categoryIsSelect =
    productName && (hasProductCategories(productName) || categoryOptions.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Item Details</h1>
      </div>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Product *</div>
            <Select
              onValueChange={(value) => {
                setProductName(value)
                const availableLevels = getProductLevels(value)
                setLevel(availableLevels.length > 0 ? availableLevels[0] : '')
                const availableSpecs = getProductSpecs(value)
                setSpecs(availableSpecs.length > 0 ? availableSpecs[0] : 'Regular')
                const cats = getProductCategories(value)
                setCategory(cats.length > 0 ? cats[0] : '')
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
                disabled={!productName}
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
            <div className="text-sm font-medium">Quantity *</div>
            <Input
              type="number"
              step="1"
              placeholder="Item Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
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
                !quantity ||
                (hasProductSubjects(productName) && !subject)
              }
            >
              {saving ? 'Adding…' : 'Add Item'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
