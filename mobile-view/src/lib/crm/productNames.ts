/** Copied from the web app (lib/productNames.ts); keep the two in sync. */
type ProductLike = { product_name?: string; product?: string; quantity?: number } | string | null | undefined

const nameOf = (p: ProductLike) =>
  String(typeof p === 'string' ? p : p?.product_name || p?.product || '').trim()

/** Each product once (orders hold a line per class / deliverable), in first-seen order. */
export function uniqueProductNames(products: ProductLike[] | undefined | null): string[] {
  const seen = new Map<string, string>()
  for (const p of products || []) {
    const name = nameOf(p)
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name)
  }
  return Array.from(seen.values())
}

/** "ABACUS - 1000, EEL - 900": each product once with its quantities added up. */
export function productQuantitySummary(products: ProductLike[] | undefined | null): string {
  const totals = new Map<string, { name: string; qty: number }>()
  for (const p of products || []) {
    const name = nameOf(p)
    if (!name) continue
    const entry = totals.get(name.toLowerCase()) || { name, qty: 0 }
    entry.qty += typeof p === 'object' && p ? Number(p.quantity) || 0 : 0
    totals.set(name.toLowerCase(), entry)
  }
  return Array.from(totals.values()).map((t) => (t.qty ? `${t.name} - ${t.qty}` : t.name)).join(', ')
}
