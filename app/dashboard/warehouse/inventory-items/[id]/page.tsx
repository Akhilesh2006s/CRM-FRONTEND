'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

type Item = {
  _id: string
  productName: string
  category: string
  class?: string
  level?: string
  specs?: string
  subject?: string
  supplier?: string
  unitPrice: number
  currentStock?: number
}

type InventoryOptions = { vendors?: string[]; productVendors?: Record<string, string[]> }
type WarehouseVendors = { vendors?: Array<string | { name?: string }>; productVendors?: Record<string, string[]> }

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
    hasProductSpecs,
    hasProductLevels,
  } = useProducts()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<string[]>([])
  const [vendorMap, setVendorMap] = useState<Map<string, AssignedVendor[]>>(new Map())

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [level, setLevel] = useState('')
  const [specs, setSpecs] = useState('')
  const [subject, setSubject] = useState('')
  const [vendor, setVendor] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [updateQty, setUpdateQty] = useState('')

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
    setCategory(cats.includes(category) ? category : cats[0] || '')
    setLevel(levels.includes(level) ? level : levels[0] || '')
    setSpecs(specList.includes(specs) ? specs : specList[0] || '')
    if (!hasProductSubjects(value)) setSubject('')
    else if (!getProductSubjects(value).includes(subject)) setSubject('')
    setVendor(mappedVendorName(value, vendorMap, vendor))
  }

  useEffect(() => {
    if (!id) return
    ;(async () => {
      try {
        const item = await apiRequest<Item>(`/warehouse/${id}`)
        setProductName(item.productName || '')
        setCategory(item.category || '')
        setLevel(item.level || '')
        setSpecs(item.specs || '')
        setSubject(item.subject || '')
        setVendor(item.supplier || '')
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
          class: '',
          category: showCategory ? category : '',
          level: showLevel ? level : '',
          specs: showSpecs ? specs : '',
          subject: showSubject ? subject : '',
          vendor: vendor || mappedVendorName(productName, vendorMap, '') || undefined,
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

  const canSubmit =
    Boolean(productName) &&
    Boolean(updateQty) &&
    (!showCategory || Boolean(category)) &&
    (!showLevel || Boolean(level)) &&
    (!showSpecs || Boolean(specs)) &&
    (!showSubject || Boolean(subject))

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
              <div className="text-sm font-medium">Price</div>
              <Input
                type="number"
                step="0.01"
                placeholder="Item Price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Quantity *</div>
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
              <Button type="submit" disabled={saving || !canSubmit}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
