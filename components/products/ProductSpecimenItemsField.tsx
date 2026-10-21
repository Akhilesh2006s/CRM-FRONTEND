'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusCircle } from 'lucide-react'
import type { ProductSpecimenItem } from '@/lib/dcRowCategory'

/** Products sent as this product's specimen set (e.g. ABACUS: Level 1 Book, Flash Cards). */
export function ProductSpecimenItemsField({
  value,
  onChange,
  productOptions,
}: {
  value: ProductSpecimenItem[]
  onChange: (items: ProductSpecimenItem[]) => void
  /** Catalogue product names offered in the dropdown. */
  productOptions: string[]
}) {
  const update = (index: number, patch: Partial<ProductSpecimenItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div>
      <Label>Specimen Set</Label>
      <p className="text-xs text-neutral-500 mb-2">
        Products sent when a school asks for specimen copies of this product. In the lead, the BDE ticks which of these to send. Leave empty to send one set as per the DC list.
      </p>
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_auto] gap-2 items-end rounded border p-2 [&>*]:min-w-0">
            <div>
              <Label className="text-xs">Product *</Label>
              <select
                aria-label="Specimen product"
                className="h-10 w-full rounded-md border bg-white px-2 text-sm text-neutral-900"
                value={item.product}
                onChange={(e) => update(index, { product: e.target.value })}
              >
                <option value="">Select product</option>
                {[...new Set([...(item.product ? [item.product] : []), ...productOptions])].map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Qty per set</Label>
              <Input
                className="bg-white text-neutral-900"
                aria-label="Specimen quantity per set"
                type="number"
                min={1}
                step={1}
                value={item.quantity || ''}
                onChange={(e) => update(index, { quantity: Math.floor(Number(e.target.value)) || 0 })}
                onBlur={() => update(index, { quantity: Math.max(1, Math.floor(Number(item.quantity)) || 1) })}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove</Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onChange([...value, { product: '', quantity: 1 }])}>
        <PlusCircle className="h-4 w-4 mr-1" /> Add specimen product
      </Button>
    </div>
  )
}

/** Validation message for the product form, or '' when the specimen set is fine. */
export function specimenItemsError(items: ProductSpecimenItem[]): string {
  const names = new Set<string>()
  for (const item of items) {
    const name = String(item.product || '').trim()
    if (!name) return 'Select a product for every specimen row, or remove the empty row.'
    if (names.has(name.toLowerCase())) return `Specimen product "${name}" is listed twice.`
    names.add(name.toLowerCase())
  }
  return ''
}
