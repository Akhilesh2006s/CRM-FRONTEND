'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiRequest } from '@/lib/api'
import { toast } from 'sonner'
import { useProducts } from '@/hooks/useProducts'
import { MappedVendorField } from '@/components/warehouse/MappedVendorField'
import {
  mappedVendorName,
  vendorMapFromApiPayloads,
  type AssignedVendor,
  type PartnerAssignment,
} from '@/lib/vendorProductAssignment'

type InventoryOptions = { vendors?: string[]; productVendors?: Record<string, string[]> }
type WarehouseVendors = { vendors?: Array<string | { name?: string }>; productVendors?: Record<string, string[]> }

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
    hasProductSpecs,
    hasProductLevels,
  } = useProducts()
  const [productName, setProductName] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [level, setLevel] = useState<string>('')
  const [specs, setSpecs] = useState<string>('')
  const [subject, setSubject] = useState<string>('')
  const [vendor, setVendor] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<string[]>([])
  const [vendorMap, setVendorMap] = useState<Map<string, AssignedVendor[]>>(new Map())

  const showCategory = Boolean(productName && hasProductCategories(productName))
  const showLevel = Boolean(productName && hasProductLevels(productName))
  const showSpecs = Boolean(productName && hasProductSpecs(productName))
  const showSubject = Boolean(productName && hasProductSubjects(productName))
  const categoryOptions = showCategory ? getProductCategories(productName) : []
  const levelOptions = showLevel ? getProductLevels(productName) : []
  const specsOptions = showSpecs ? getProductSpecs(productName) : []
  const subjectOptions = showSubject ? getProductSubjects(productName) : []

  useEffect(() => {
    ;(async () => {
      try {
        const [opts, warehouseVendors, partners] = await Promise.all([
          apiRequest<InventoryOptions>('/metadata/inventory-options').catch(() => ({})),
          apiRequest<WarehouseVendors>('/warehouse/vendors').catch(() => ({})),
          apiRequest<PartnerAssignment[]>('/partners').catch(() => []),
        ])
        const fromOptions = Array.isArray(opts?.vendors) ? opts.vendors : []
        const fromWarehouse = (Array.isArray(warehouseVendors?.vendors) ? warehouseVendors.vendors : [])
          .map((v) => (typeof v === 'string' ? v : String(v?.name || '').trim()))
          .filter(Boolean)
        if (fromOptions.length || fromWarehouse.length) {
          setVendors(Array.from(new Set([...fromOptions, ...fromWarehouse])))
        }
        setVendorMap(
          vendorMapFromApiPayloads({
            partners,
            productVendors: opts?.productVendors,
            warehouseProductVendors: warehouseVendors?.productVendors,
          })
        )
      } catch (_) {}
    })()
  }, [])

  useEffect(() => {
    if (!productName) return
    const next = mappedVendorName(productName, vendorMap, vendor)
    if (next && next !== vendor) setVendor(next)
  }, [productName, vendorMap])

  function applyProduct(value: string) {
    setProductName(value)
    const cats = hasProductCategories(value) ? getProductCategories(value) : []
    const levels = hasProductLevels(value) ? getProductLevels(value) : []
    const specList = hasProductSpecs(value) ? getProductSpecs(value) : []
    setCategory(cats[0] || '')
    setLevel(levels[0] || '')
    setSpecs(specList[0] || '')
    setSubject('')
    setVendor(mappedVendorName(value, vendorMap, ''))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!productName) {
      toast.error('Product is required')
      return
    }
    if (showCategory && !category) {
      toast.error('Product Category is required for this product')
      return
    }
    if (showLevel && !level) {
      toast.error('Level is required for this product')
      return
    }
    if (showSpecs && !specs) {
      toast.error('Specs is required for this product')
      return
    }
    if (showSubject && !subject) {
      toast.error('Subject is required for this product')
      return
    }

    setSaving(true)
    try {
      const qty = parseFloat(quantity) || 0
      const saved = await apiRequest<{ merged?: boolean }>('/warehouse', {
        method: 'POST',
        body: JSON.stringify({
          productName,
          class: '',
          category: showCategory ? category : '',
          level: showLevel ? level : '',
          specs: showSpecs ? specs : '',
          subject: showSubject ? subject : '',
          vendor: vendor || mappedVendorName(productName, vendorMap, '') || undefined,
          currentStock: qty,
        }),
      })
      toast.success(saved?.merged ? 'Quantity added to existing item' : 'Item added')
      router.push('/dashboard/warehouse/inventory-items')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    Boolean(productName) &&
    Boolean(quantity) &&
    (!showCategory || Boolean(category)) &&
    (!showLevel || Boolean(level)) &&
    (!showSpecs || Boolean(specs)) &&
    (!showSubject || Boolean(subject))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Item Details</h1>
        <p className="text-neutral-500">Fields come from Product Master for the selected product.</p>
      </div>
      <Card className="p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Product *</div>
            <Select onValueChange={applyProduct} value={productName}>
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

          {showCategory && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Product Category *</div>
              <Select value={category || undefined} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Product Category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showLevel && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Level *</div>
              <Select onValueChange={setLevel} value={level || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((lvl) => (
                    <SelectItem key={lvl} value={lvl}>
                      {lvl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showSpecs && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Specs *</div>
              <Select onValueChange={setSpecs} value={specs || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Specs" />
                </SelectTrigger>
                <SelectContent>
                  {specsOptions.map((spec) => (
                    <SelectItem key={spec} value={spec}>
                      {spec}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showSubject && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Subject *</div>
              <Select onValueChange={setSubject} value={subject || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map((subj) => (
                    <SelectItem key={subj} value={subj}>
                      {subj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <MappedVendorField
            productName={productName}
            vendor={vendor}
            onVendorChange={setVendor}
            vendorMap={vendorMap}
            fallbackVendors={vendors}
          />

          <div className="space-y-2">
            <div className="text-sm font-medium">Quantity *</div>
            <Input
              type="number"
              step="1"
              placeholder="Item Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!productName}
            />
          </div>

          <div className="md:col-span-2">
            <Button type="submit" disabled={saving || !canSubmit}>
              {saving ? 'Adding…' : 'Add Item'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
