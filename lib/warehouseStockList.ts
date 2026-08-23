/** Client-side Stock grouping. Mirrors backend/utils/warehouseInventoryIdentity consolidatedStockList. */

export type StockSourceItem = {
  _id?: string
  productName?: string
  product?: string
  category?: string
  level?: string
  location?: string
  specs?: string
  subject?: string
  supplier?: string
  vendor?: string
  currentStock?: number
}

export type ConsolidatedStockRow = {
  _id: string
  productName: string
  category: string
  level: string
  specs: string
  subject: string
  currentStock: number
}

function blank(value: unknown): string {
  const s = String(value ?? '').trim()
  const lower = s.toLowerCase()
  if (
    !s ||
    lower === '-' ||
    lower === '--' ||
    s === '—' ||
    s === '–' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'undefined' ||
    lower === 'null'
  ) {
    return ''
  }
  return s
}

function normText(value: unknown): string {
  return blank(value).toLowerCase()
}

function isWarehouseLocationName(value: unknown): boolean {
  const n = String(value || '').trim().toLowerCase()
  return Boolean(n) && n.includes('warehouse')
}

function productLevelValue(item: StockSourceItem): string {
  const level = blank(item.level)
  if (level) return level
  const loc = blank(item.location)
  if (!loc || isWarehouseLocationName(loc)) return ''
  return loc
}

function normLevel(value: unknown): string {
  const s = blank(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!s) return ''
  const m = s.match(/^(?:level|lvl|l)?(\d+)$/)
  if (m) return `l${m[1]}`
  return s
}

function normSpecs(value: unknown): string {
  return (blank(value) || 'Regular').toLowerCase()
}

function stockKey(item: StockSourceItem): string {
  return [
    normText(item.productName || item.product),
    normText(item.category),
    normLevel(productLevelValue(item)),
    normSpecs(item.specs),
    normText(item.subject),
  ].join('|')
}

function firstDisplay(group: StockSourceItem[], getter: (item: StockSourceItem) => unknown): string {
  for (const item of group) {
    const value = blank(getter(item))
    if (value) return value
  }
  return ''
}

function shouldIncludeInStock(item: StockSourceItem): boolean {
  if (!normText(item.productName || item.product)) return false
  const vendor = String(item.supplier || item.vendor || '').trim()
  return Boolean(vendor) && vendor !== '-'
}

/** Same vendor visibility rule as Inventory Items. */
export function isInventoryListRow(item: StockSourceItem): boolean {
  const vendor = String(item.supplier || '').trim()
  return Boolean(vendor) && vendor !== '-'
}

export function consolidateStockRows(items: StockSourceItem[] | null | undefined): ConsolidatedStockRow[] {
  const groups = new Map<string, StockSourceItem[]>()
  for (const item of Array.isArray(items) ? items : []) {
    if (!shouldIncludeInStock(item)) continue
    const key = stockKey(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  const rows: ConsolidatedStockRow[] = []
  for (const [key, group] of groups.entries()) {
    rows.push({
      _id: key,
      productName: firstDisplay(group, (item) => item.productName || item.product) || String(group[0].productName || ''),
      category: firstDisplay(group, (item) => item.category),
      level: firstDisplay(group, (item) => productLevelValue(item)),
      specs: firstDisplay(group, (item) => item.specs),
      subject: firstDisplay(group, (item) => item.subject),
      currentStock: group.reduce((sum, item) => sum + (Number(item.currentStock) || 0), 0),
    })
  }

  rows.sort((a, b) =>
    String(a.productName || '').localeCompare(String(b.productName || ''), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
  return rows
}
