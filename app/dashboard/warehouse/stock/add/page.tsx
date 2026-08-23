'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type WarehouseItem = {
  _id: string
  productName: string
  category?: string
  specs?: string
  level?: string
  class?: string
  subject?: string
  supplier?: string
  vendor?: string
  vendorId?: string
  currentStock?: number
}

type IdentityFields = {
  productName: string
  category: string
  specs: string
  level: string
  subject: string
  vendor: string
}

type VendorMaster = PartnerAssignment & {
  isActive?: boolean
}

function blank(value: unknown): string {
  const s = String(value ?? '').trim()
  if (!s || s === '-' || s === 'n/a' || s === 'na') return ''
  return s
}

function same(a: unknown, b: unknown): boolean {
  return blank(a).toLowerCase() === blank(b).toLowerCase()
}

function vendorOf(item: WarehouseItem): string {
  return blank(item.supplier || item.vendor)
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const v = blank(raw)
    if (!v) continue
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function itemMatchesProductIdentity(
  item: WarehouseItem,
  fields: Omit<IdentityFields, 'vendor'>
) {
  return (
    same(item.productName, fields.productName) &&
    same(item.category, fields.category) &&
    same(item.specs, fields.specs) &&
    same(item.level, fields.level) &&
    same(item.subject, fields.subject)
  )
}

function itemMatchesFields(item: WarehouseItem, fields: IdentityFields) {
  return itemMatchesProductIdentity(item, fields) && same(vendorOf(item), fields.vendor)
}

export default function StockAddPage() {
  const router = useRouter()
  const params = useSearchParams()
  const productId = params?.get('productId') || ''
  const productNameParam = params?.get('productName') || ''
  const categoryParam = params?.get('category') || ''
  const levelParam = params?.get('level') || ''
  const specsParam = params?.get('specs') || ''
  const subjectParam = params?.get('subject') || ''
  const originalItemIdRef = useRef(productId)

  const {
    productNames: catalogProducts,
    getProductLevels,
    getProductSpecs,
    getProductCategories,
    hasProductCategories,
    hasProductLevels,
    hasProductSpecs,
    hasProductSubjects,
    getProductSubjects,
  } = useProducts()

  const [loadingItem, setLoadingItem] = useState(true)
  const [itemMissing, setItemMissing] = useState(false)
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([])
  const [masterVendors, setMasterVendors] = useState<string[]>([])
  const [vendorMap, setVendorMap] = useState<Map<string, AssignedVendor[]>>(new Map())
  const [selectedItemId, setSelectedItemId] = useState(productId)

  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState('')
  const [specs, setSpecs] = useState('')
  const [level, setLevel] = useState('')
  const [subject, setSubject] = useState('')
  const [vendor, setVendor] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)

  function upsertWarehouseItem(item: WarehouseItem) {
    setWarehouseItems((prev) => {
      const idx = prev.findIndex((w) => w._id === item._id)
      if (idx === -1) return [item, ...prev]
      const next = [...prev]
      next[idx] = { ...next[idx], ...item }
      return next
    })
  }

  function applyItem(item: WarehouseItem) {
    setSelectedItemId(item._id)
    setProductName(item.productName || '')
    setCategory(blank(item.category))
    setSpecs(blank(item.specs))
    setLevel(blank(item.level))
    setSubject(blank(item.subject))
    setVendor(vendorOf(item))
    upsertWarehouseItem(item)
  }

  function resolveExistingItemId(fields: IdentityFields): string {
    const originalId = originalItemIdRef.current
    const original = originalId ? warehouseItems.find((w) => w._id === originalId) : null
    if (original && itemMatchesFields(original, fields)) return original._id

    const matches = warehouseItems.filter((w) => itemMatchesFields(w, fields))
    if (matches.length === 1) return matches[0]._id
    if (selectedItemId && matches.some((w) => w._id === selectedItemId)) return selectedItemId
    return matches[0]?._id || ''
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [partners, options, warehouseVendors] = await Promise.all([
        apiRequest<VendorMaster[]>('/partners').catch(() => []),
        apiRequest<{ vendors?: string[]; productVendors?: Record<string, string[]> }>('/metadata/inventory-options').catch(() => ({ vendors: [] })),
        apiRequest<{ vendors?: Array<string | { name?: string }>; productVendors?: Record<string, string[]> }>('/warehouse/vendors').catch(() => ({})),
      ])
      const fromMaster = uniqueValues((Array.isArray(partners) ? partners : []).map((p) => p?.name))
      const fromOptions = uniqueValues(options?.vendors || [])
      const fromWarehouse = uniqueValues(
        (Array.isArray(warehouseVendors?.vendors) ? warehouseVendors.vendors : []).map((v) =>
          typeof v === 'string' ? v : v?.name
        )
      )
      // Union both sources. Do not prefer an empty Partner list over inventory-options.
      const names = uniqueValues([...fromMaster, ...fromOptions, ...fromWarehouse]).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      )
      console.log('fetched vendors', names)
      if (!cancelled) {
        setMasterVendors(names)
        setVendorMap(
          vendorMapFromApiPayloads({
            partners,
            productVendors: options?.productVendors,
            warehouseProductVendors: warehouseVendors?.productVendors,
          })
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    originalItemIdRef.current = productId
    ;(async () => {
      try {
        const list = await apiRequest<WarehouseItem[]>('/warehouse').catch(() => [])
        const rows = Array.isArray(list) ? list : []
        setWarehouseItems(rows)

        if (productId) {
          try {
            const item = await apiRequest<WarehouseItem>(`/warehouse/${productId}`)
            applyItem(item)
            setItemMissing(false)
          } catch (err: any) {
            const fromList = rows.find((w) => w._id === productId)
            if (fromList) {
              applyItem(fromList)
              setItemMissing(false)
            } else {
              setItemMissing(true)
              toast.error(err?.message || 'Inventory item not found')
            }
          }
        } else if (productNameParam) {
          setProductName(productNameParam)
          setCategory(blank(categoryParam))
          setLevel(blank(levelParam))
          setSpecs(blank(specsParam))
          setSubject(blank(subjectParam))
          setSelectedItemId('')
          setItemMissing(false)
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load inventory')
      } finally {
        setLoadingItem(false)
      }
    })()
  }, [productId, productNameParam, categoryParam, levelParam, specsParam, subjectParam])

  const showCategory = Boolean(productName && hasProductCategories(productName))
  const showLevel = Boolean(productName && hasProductLevels(productName))
  const showSpecs = Boolean(productName && hasProductSpecs(productName))
  const showSubject = Boolean(productName && hasProductSubjects(productName))
  const identityReady = Boolean(
    productName &&
    (!showCategory || category) &&
    (!showLevel || level) &&
    (!showSpecs || specs) &&
    (!showSubject || subject)
  )

  const productOptions = useMemo(() => {
    return uniqueValues([...catalogProducts, productName])
  }, [catalogProducts, productName])

  const categoryOptions = useMemo(() => {
    if (!showCategory) return []
    return uniqueValues([...(productName ? getProductCategories(productName) : []), category])
  }, [showCategory, productName, getProductCategories, category])

  const levelOptions = useMemo(() => {
    if (!showLevel) return []
    return uniqueValues([...(productName ? getProductLevels(productName) : []), level])
  }, [showLevel, productName, getProductLevels, level])

  const specsOptions = useMemo(() => {
    if (!showSpecs) return []
    return uniqueValues([...(productName ? getProductSpecs(productName) : []), specs])
  }, [showSpecs, productName, getProductSpecs, specs])

  const subjectOptions = useMemo(() => {
    if (!showSubject) return []
    return uniqueValues([...(productName ? getProductSubjects(productName) : []), subject])
  }, [showSubject, productName, getProductSubjects, subject])

  useEffect(() => {
    if (!productName) return
    const next = mappedVendorName(productName, vendorMap, vendor)
    if (next && next !== vendor) setVendor(next)
  }, [productName, vendorMap])

  useEffect(() => {
    if (!identityReady || !vendor) {
      setSelectedItemId('')
      return
    }
    setSelectedItemId(
      resolveExistingItemId({ productName, category, specs, level, subject, vendor })
    )
  }, [identityReady, productName, category, specs, level, subject, vendor, warehouseItems])

  function onProductChange(value: string) {
    setProductName(value)
    setCategory('')
    setSpecs('')
    setLevel('')
    setSubject('')
    setVendor(mappedVendorName(value, vendorMap, ''))
    setSelectedItemId('')
  }

  function onIdentityChange(
    patch: Partial<{ category: string; specs: string; level: string; subject: string; vendor: string }>
  ) {
    const next: IdentityFields = {
      productName,
      category,
      specs,
      level,
      subject,
      vendor,
      ...patch,
    }
    if (patch.category !== undefined) setCategory(patch.category)
    if (patch.specs !== undefined) setSpecs(patch.specs)
    if (patch.level !== undefined) setLevel(patch.level)
    if (patch.subject !== undefined) setSubject(patch.subject)
    if (patch.vendor !== undefined) setVendor(patch.vendor)
    const id = resolveExistingItemId(next)
    setSelectedItemId(id)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (itemMissing) {
      toast.error('This inventory item no longer exists')
      return
    }
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
    if (!vendor && !mappedVendorName(productName, vendorMap, '')) {
      toast.error('Vendor is required.')
      return
    }

    const mappedVendor = vendor || mappedVendorName(productName, vendorMap, '')
    const amount = Number(qty)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a positive quantity')
      return
    }

    const fields = { productName, category, specs, level, subject, vendor: mappedVendor }
    const targetId = selectedItemId || resolveExistingItemId(fields)

    try {
      setSaving(true)
      if (targetId) {
        await apiRequest('/warehouse/stock', {
          method: 'POST',
          body: JSON.stringify({
            productId: targetId,
            quantity: amount,
            movementType: 'In',
            reason: 'Manual add',
          }),
        })
      } else {
        await apiRequest('/warehouse', {
          method: 'POST',
          body: JSON.stringify({
            productName,
            class: '',
            category: showCategory ? category : '',
            level: showLevel ? level : '',
            specs: showSpecs ? specs : '',
            subject: showSubject ? subject : '',
            vendor: mappedVendor,
            currentStock: amount,
          }),
        })
      }
      toast.success('Quantity added')
      router.push('/dashboard/warehouse/stock')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add quantity')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    Boolean(productName) &&
    Boolean(vendor || mappedVendorName(productName, vendorMap, '')) &&
    Boolean(qty) &&
    (!showCategory || Boolean(category)) &&
    (!showLevel || Boolean(level)) &&
    (!showSpecs || Boolean(specs)) &&
    (!showSubject || Boolean(subject))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-neutral-900">Add Item Details</h1>
        <p className="text-neutral-500">Add quantity to an existing inventory item</p>
      </div>
      <Card className="p-6">
        {loadingItem ? (
          <div className="text-sm text-neutral-500">Loading item…</div>
        ) : itemMissing ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600">This inventory item was not found. It may have been deleted.</p>
            <Button type="button" variant="destructive" onClick={() => router.push('/dashboard/warehouse/stock')}>
              Back to Stock
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Product *</div>
              <Select value={productName || undefined} onValueChange={onProductChange}>
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
              <Select
                value={category || undefined}
                onValueChange={(v) => onIdentityChange({ category: v })}
                disabled={!productName}
              >
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Product Category' : 'Select Product first'} />
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
              <Select
                value={level || undefined}
                onValueChange={(v) => onIdentityChange({ level: v })}
                disabled={!productName}
              >
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Level' : 'Select Product first'} />
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
              <Select
                value={specs || undefined}
                onValueChange={(v) => onIdentityChange({ specs: v })}
                disabled={!productName}
              >
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Specs' : 'Select Product first'} />
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
              <Select
                value={subject || undefined}
                onValueChange={(v) => onIdentityChange({ subject: v })}
                disabled={!productName}
              >
                <SelectTrigger>
                  <SelectValue placeholder={productName ? 'Select Subject' : 'Select Product first'} />
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
              onVendorChange={(v) => onIdentityChange({ vendor: v })}
              vendorMap={vendorMap}
              fallbackVendors={masterVendors}
              required
            />

            <div className="space-y-2">
              <div className="text-sm font-medium">Quantity *</div>
              <Input
                type="number"
                step="1"
                min="1"
                placeholder="Quantity to add"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <Button type="submit" disabled={saving || !canSubmit}>
                {saving ? 'Adding…' : 'Add Item'}
              </Button>
              <Button type="button" variant="destructive" onClick={() => router.push('/dashboard/warehouse/stock')}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
