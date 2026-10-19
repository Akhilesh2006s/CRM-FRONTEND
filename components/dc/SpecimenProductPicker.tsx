'use client'

import { Checkbox } from '@/components/ui/checkbox'

/** Which products get specimen copies (e.g. only EEL). */
export function SpecimenProductPicker({
  products,
  selected,
  onChange,
  title = 'Specimen copies for',
  minProducts = 2,
}: {
  products: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  title?: string
  /** Hide the picker when there are fewer products than this (one product needs no choice). */
  minProducts?: number
}) {
  if (products.length < minProducts) return null
  const chosen = new Set(selected)
  return (
    <div className="basis-full">
      <div className="text-xs font-medium text-neutral-700 mb-1">{title}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {products.map((product) => (
          <label key={product} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={chosen.has(product)}
              onCheckedChange={(checked) =>
                onChange(checked === true ? [...selected, product] : selected.filter((p) => p !== product))
              }
            />
            {product}
          </label>
        ))}
      </div>
    </div>
  )
}

/** Product names of the book rows a specimen copy can be made for. */
export function specimenCandidateProducts(rows: Array<{ product?: string; productName?: string }>): string[] {
  return [...new Set(rows.map((r) => String(r.product || r.productName || '').trim()).filter(Boolean))]
}
