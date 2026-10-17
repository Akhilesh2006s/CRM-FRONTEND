'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusCircle } from 'lucide-react'
import type { ProductRelatedItem } from '@/lib/dcRowCategory'

const emptyItem = (): ProductRelatedItem => ({ name: '', billable: false, price: 0, basis: 'per_student', quantity: 1 })

/** Items that ship with the product on every DC (e.g. EEL: Tensmat, Solution Books; IIT: Teacher Books; Abacus: Flash Cards). */
export function ProductRelatedItemsField({ value, onChange }: { value: ProductRelatedItem[]; onChange: (items: ProductRelatedItem[]) => void }) {
  const update = (index: number, patch: Partial<ProductRelatedItem>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div>
      <Label>Product Related Items</Label>
      <p className="text-xs text-neutral-500 mb-2">
        Added to every DC for this product. Billable items are charged at their price; non-billable items go as Training Material at ₹0.
      </p>
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="grid grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto] gap-2 items-end rounded border p-2 [&>*]:min-w-0">
            <div>
              <Label className="text-xs">Item name *</Label>
              <Input className="bg-white text-neutral-900" aria-label="Related item name" placeholder="e.g. Tensmat" value={item.name} onChange={(e) => update(index, { name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Billing</Label>
              <select
                aria-label="Related item billing"
                className="h-10 w-full rounded-md border bg-white px-2 text-sm text-neutral-900"
                value={item.billable ? 'billable' : 'free'}
                onChange={(e) => update(index, { billable: e.target.value === 'billable', ...(e.target.value === 'free' ? { price: 0 } : {}) })}
              >
                <option value="billable">Billable</option>
                <option value="free">Non-billable</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Price ₹{item.billable ? ' *' : ''}</Label>
              <Input
                className="bg-white text-neutral-900"
                aria-label="Related item price"
                type="number"
                min={0}
                step="0.01"
                disabled={!item.billable}
                value={item.billable ? (item.price || '') : 0}
                onChange={(e) => update(index, { price: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Quantity basis</Label>
              <select
                aria-label="Related item quantity basis"
                className="h-10 w-full rounded-md border bg-white px-2 text-sm text-neutral-900"
                value={item.basis}
                onChange={(e) => update(index, { basis: e.target.value === 'per_class' ? 'per_class' : 'per_student' })}
              >
                <option value="per_student">Per student</option>
                <option value="per_class">Per class</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Qty</Label>
              <Input
                className="bg-white text-neutral-900"
                aria-label="Related item quantity"
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
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onChange([...value, emptyItem()])}>
        <PlusCircle className="h-4 w-4 mr-1" /> Add related item
      </Button>
    </div>
  )
}

/** Validation message for the product form, or '' when the items are fine. */
export function relatedItemsError(items: ProductRelatedItem[]): string {
  const names = new Set<string>()
  for (const item of items) {
    const name = String(item.name || '').trim()
    if (!name) return 'Enter a name for every related item, or remove the empty row.'
    if (names.has(name.toLowerCase())) return `Related item "${name}" is listed twice.`
    names.add(name.toLowerCase())
    if (item.billable && !(Number(item.price) > 0)) return `Enter a price for billable item "${name}".`
  }
  return ''
}
