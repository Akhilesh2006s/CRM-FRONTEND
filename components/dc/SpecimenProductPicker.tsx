'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { specimenParentProduct, type ProductSpecimenItem, type SpecimenItemChoice } from '@/lib/dcRowCategory'

/** Which products get specimen copies (e.g. only EEL), and which items of each product's specimen set. */
export function SpecimenProductPicker({
  products,
  selected,
  onChange,
  title = 'Specimen copies for',
  minProducts = 2,
  getItems,
  chosenItems = {},
  onItemsChange,
}: {
  products: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  title?: string
  /** Hide the product choice when there are fewer products than this (one product needs no choice). */
  minProducts?: number
  /** The product's specimen set (configured on the product). */
  getItems?: (product: string) => ProductSpecimenItem[]
  /** Ticked items per product; a product missing here sends its whole set. */
  chosenItems?: SpecimenItemChoice
  onItemsChange?: (next: SpecimenItemChoice) => void
}) {
  const chosen = new Set(selected)
  const itemsOf = (product: string) => (getItems ? getItems(product) : [])
  const showProducts = products.length >= minProducts
  const anyItems = products.some((product) => chosen.has(product) && itemsOf(product).length > 0)
  if (!showProducts && !anyItems) return null

  const toggleItem = (product: string, item: string, checked: boolean) => {
    const all = itemsOf(product).map((i) => i.product)
    const current = chosenItems[product] ?? all
    const next = checked ? [...new Set([...current, item])] : current.filter((name) => name !== item)
    onItemsChange?.({ ...chosenItems, [product]: all.filter((name) => next.includes(name)) })
  }

  return (
    <div className="basis-full space-y-2">
      {showProducts && (
        <div>
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
      )}
      {products
        .filter((product) => chosen.has(product) && itemsOf(product).length > 0)
        .map((product) => {
          const ticked = chosenItems[product]
          return (
            <div key={product} className="rounded border bg-neutral-50 p-2">
              <div className="text-xs font-medium text-neutral-700 mb-1">{product} specimen set</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {itemsOf(product).map((item) => (
                  <label key={item.product} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={!ticked || ticked.includes(item.product)}
                      onCheckedChange={(checked) => toggleItem(product, item.product, checked === true)}
                    />
                    {item.product}
                    <span className="text-xs text-neutral-500">× {item.quantity || 1}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}

/** Product names of the book rows a specimen copy can be made for. */
export function specimenCandidateProducts(rows: Array<{ product?: string; productName?: string }>): string[] {
  return [...new Set(rows.map((r) => String(r.product || r.productName || '').trim()).filter(Boolean))]
}

/** Products saved specimen lines were requested for, and the items ticked for each. */
export function specimenChoiceFromRows(rows: Array<Record<string, any>>): { products: string[]; items: SpecimenItemChoice } {
  const items: SpecimenItemChoice = {}
  const products: string[] = []
  for (const row of rows) {
    const parent = specimenParentProduct(row)
    if (!parent) continue
    if (!products.includes(parent)) products.push(parent)
    if (String(row.specs || '').startsWith('Specimen for ')) {
      const name = String(row.product || row.productName || row.product_name || '').trim()
      items[parent] = [...(items[parent] || []), name]
    }
  }
  return { products, items }
}
