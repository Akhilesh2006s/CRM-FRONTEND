/**
 * Match DC product rows to warehouse inventory SKUs.
 * Same identity rules as backend/utils/warehouseInventoryMatch.js.
 */

const STUDENT_ENROLLMENT_CATEGORIES = new Set([
  'new student',
  'new students',
  'existing student',
  'existing students',
  'old student',
  'old students',
  'both',
  'new school',
  'existing school',
  'shortage',
  'training-material',
  'training material',
])

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

function normName(value: unknown): string {
  return blank(value).toLowerCase()
}

function normSubject(value: unknown): string {
  return blank(value).toLowerCase()
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
  const s = blank(value)
  if (!s || s.toLowerCase() === 'regular') return ''
  return s.toLowerCase()
}

function normClass(value: unknown): string {
  const s = blank(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  if (!s) return ''
  const m = s.match(/^(?:class|cls|c)?(\d+)$/)
  if (m) return m[1]
  return s
}

function isStudentCategory(value: unknown): boolean {
  const n = normName(value).replace(/[\s_-]+/g, ' ')
  if (!n) return false
  if (STUDENT_ENROLLMENT_CATEGORIES.has(n)) return true
  if (/^(new|old|existing)\s*students?$/.test(n)) return true
  if (/^(new|existing)\s*school$/.test(n)) return true
  if (/^training\s*materials?$/.test(n)) return true
  return false
}

export function skuCategoryFromRow(row: Record<string, any> = {}): string {
  const productCategory = blank(row.productCategory)
  if (productCategory && !isStudentCategory(productCategory)) return productCategory
  const category = blank(row.category)
  if (category && !isStudentCategory(category)) return category
  return ''
}

export function skuCategoryFromItem(item: Record<string, any> = {}): string {
  const category = blank(item.category)
  if (category && !isStudentCategory(category)) return category
  return ''
}

function stockIdentity(item: Record<string, any> = {}) {
  return {
    productName: normName(item.productName || productNameFromRow(item)),
    category: normName(skuCategoryFromItem(item) || skuCategoryFromRow(item)),
    level: normLevel(item.level),
    specs: normSpecs(item.specs),
    subject: normSubject(item.subject),
  }
}

function stockIdentityKeyFromParts(id: ReturnType<typeof stockIdentity>): string {
  return [id.productName, id.category, id.level, id.specs, id.subject].join('|')
}

/** Exact Stock identity: Product + Product Category + Level + Specs + Subject. Vendor/Class ignored. */
export function inventoryIdentityKey(item: Record<string, any> = {}): string {
  return stockIdentityKeyFromParts(stockIdentity(item))
}

export function productNameFromRow(row: Record<string, any> = {}): string {
  return blank(row.productName || row.product || row.product_name)
}

export function requiredQtyFromDcRow(row: Record<string, any> = {}): number {
  const q = Number(row.quantity)
  if (Number.isFinite(q) && q > 0) return q
  const s = Number(row.strength)
  if (Number.isFinite(s) && s > 0) return s
  return 0
}

export function rowStockLabel(row: Record<string, any> = {}): string {
  const name = productNameFromRow(row) || 'Product'
  const sku = skuCategoryFromRow(row)
  const level = blank(row.level)
  const specs = blank(row.specs)
  const subject = blank(row.subject)
  const parts = [name]
  if (sku) parts.push(sku)
  if (level) parts.push(level)
  if (specs && specs.toLowerCase() !== 'regular') parts.push(specs)
  if (subject) parts.push(subject)
  return parts.join(' ')
}

function itemId(item: Record<string, any> | null | undefined): string {
  return item && item._id != null ? String(item._id) : ''
}

function stockOf(item: Record<string, any> | null | undefined): number {
  return Number(item?.currentStock) || 0
}

/** Empty Stock fields are not filters. Filled Stock fields must equal the DC value. Class/Vendor ignored. */
function stockFieldCovers(
  stockValue: unknown,
  dcValue: unknown,
  normalize: (value: unknown) => string
): boolean {
  const stockNorm = normalize(stockValue)
  const dcNorm = normalize(dcValue)
  if (!stockNorm || !dcNorm) return true
  return stockNorm === dcNorm
}

export function itemCompatibleWithRow(item: Record<string, any>, row: Record<string, any>): boolean {
  if (!item || !row) return false
  if (normName(item.productName) !== normName(productNameFromRow(row))) return false

  const stockCat = normName(skuCategoryFromItem(item))
  const dcCat = normName(skuCategoryFromRow(row))
  if (stockCat && dcCat && stockCat !== dcCat) return false

  if (!stockFieldCovers(item.level, row.level, normLevel)) return false
  if (!stockFieldCovers(item.specs, row.specs, normSpecs)) return false
  if (!stockFieldCovers(item.subject, row.subject, normSubject)) return false
  return true
}

export function compatibleInventoryItems<T extends Record<string, any>>(
  inventoryItems: T[] | undefined,
  row: Record<string, any>
): T[] {
  return (Array.isArray(inventoryItems) ? inventoryItems : []).filter((item) =>
    itemCompatibleWithRow(item, row)
  )
}

function specificityScore(item: Record<string, any>, row: Record<string, any>): number {
  let score = 0
  if (normLevel(item.level) && normLevel(item.level) === normLevel(row.level)) score += 1
  if (normSubject(item.subject) && normSubject(item.subject) === normSubject(row.subject)) score += 1
  if (normSpecs(item.specs) && normSpecs(item.specs) === normSpecs(row.specs)) score += 1
  const rowSku = skuCategoryFromRow(row)
  const itemSku = skuCategoryFromItem(item)
  if (rowSku && itemSku && normName(rowSku) === normName(itemSku)) score += 1
  return score
}

export function preferredCompatibleItems<T extends Record<string, any>>(
  inventoryItems: T[] | undefined,
  row: Record<string, any>
): T[] {
  const compatible = compatibleInventoryItems(inventoryItems, row)
  if (compatible.length <= 1) return compatible

  const groups = new Map<string, T[]>()
  for (const item of compatible) {
    const key = inventoryIdentityKey(item)
    const list = groups.get(key)
    if (list) list.push(item)
    else groups.set(key, [item])
  }

  let bestScore = -1
  let bestGroups: T[][] = []
  for (const items of groups.values()) {
    const score = Math.max(...items.map((item) => specificityScore(item, row)))
    if (score > bestScore) {
      bestScore = score
      bestGroups = [items]
    } else if (score === bestScore) {
      bestGroups.push(items)
    }
  }

  if (bestGroups.length <= 1) return bestGroups[0] || []

  return bestGroups.sort((a, b) => {
    const sa = a.reduce((sum, item) => sum + stockOf(item), 0)
    const sb = b.reduce((sum, item) => sum + stockOf(item), 0)
    return sb - sa
  })[0]
}

export function availableStockForRow(
  inventoryItems: Record<string, any>[] | undefined,
  row: Record<string, any>,
  remainingById?: Map<string, number>
): number {
  const compatible = compatibleInventoryItems(inventoryItems, row)
  return compatible.reduce((sum, item) => {
    const id = itemId(item)
    const live =
      remainingById && id && remainingById.has(id) ? remainingById.get(id)! : stockOf(item)
    return sum + Math.max(0, live)
  }, 0)
}

export function itemMatchesRow(item: Record<string, any>, row: Record<string, any>): boolean {
  return itemCompatibleWithRow(item, row)
}

export function matchWarehouseItem<T extends Record<string, any>>(
  inventoryItems: T[] | undefined,
  row: Record<string, any>
): T | null {
  const compatible = preferredCompatibleItems(inventoryItems, row)
  if (compatible.length === 0) return null
  return [...compatible].sort((a, b) => stockOf(b) - stockOf(a))[0]
}

/** Copy Stock identity fields from the DC row; Available Qty comes from the matching Stock record. */
export function mapInventoryIdentityOntoDcRow(
  row: Record<string, any>,
  inventoryItems: Record<string, any>[] | undefined
) {
  const productCategory = skuCategoryFromRow(row)
  const level = blank(row.level)
  const specs = blank(row.specs)
  const subject = blank(row.subject)
  const matched = compatibleInventoryItems(inventoryItems, row)
  return {
    productCategory,
    level,
    specs,
    subject,
    availableQuantity: availableStockForRow(inventoryItems, row),
    hasInventoryMatch: matched.length > 0,
  }
}

export function formatInsufficientStockMessage(
  insufficient: Array<{ label: string; requiredQty: number; availableQty: number; message?: string }>
): string {
  const entries = insufficient || []
  const lines = entries.map((entry) => {
    const body = entry.message || `Required ${entry.requiredQty}, Available ${entry.availableQty}`
    if (entries.length === 1) return body
    const label = entry.label || 'Product'
    return `${label}: ${body}`
  })
  if (lines.length === 0) {
    return 'Insufficient stock. Please ensure sufficient stock before processing this DC.'
  }
  return `Insufficient stock: ${lines.join('; ')}`
}

function displayedAvailableQty(row: Record<string, any> | null | undefined): number | null {
  if (!row || row.availableQuantity === undefined || row.availableQuantity === null || row.availableQuantity === '') {
    return null
  }
  const n = Number(row.availableQuantity)
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}

function displayedStockPoolKey(row: Record<string, any> = {}): string {
  return [
    normName(productNameFromRow(row)),
    normName(skuCategoryFromRow(row)),
    normLevel(row.level),
    normSpecs(row.specs),
    normSubject(row.subject),
  ].join('|')
}

function stockAvailableForRow(
  inventoryItems: Record<string, any>[] | undefined,
  row: Record<string, any>
): number {
  const computedQty = availableStockForRow(inventoryItems, row)
  const displayedQty = displayedAvailableQty(row)
  if (computedQty > 0) return computedQty
  if (displayedQty != null) return displayedQty
  return computedQty
}

export function validateDcStockAgainstInventory(
  rows: Record<string, any>[] | undefined,
  inventoryItems: Record<string, any>[] | undefined
): {
  ok: boolean
  message: string
  insufficient: Array<{ label: string; requiredQty: number; availableQty: number; message?: string }>
  allocations: Array<{
    row: Record<string, any>
    item: Record<string, any> | null
    requiredQty: number
    availableQty: number
    splits?: Array<{ item: Record<string, any>; qty: number }>
  }>
} {
  const remainingById = new Map<string, number>()
  for (const item of Array.isArray(inventoryItems) ? inventoryItems : []) {
    const id = itemId(item)
    if (id) remainingById.set(id, stockOf(item))
  }

  const groups = new Map<string, { label: string; requiredQty: number; availableQty: number }>()
  const activeRows: Record<string, any>[] = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const requiredQty = requiredQtyFromDcRow(row)
    if (requiredQty <= 0) continue
    activeRows.push(row)

    const poolKey = displayedStockPoolKey(row)
    const availableQty = stockAvailableForRow(inventoryItems, row)
    if (!groups.has(poolKey)) {
      groups.set(poolKey, {
        label: rowStockLabel(row),
        requiredQty: 0,
        availableQty,
      })
    }
    groups.get(poolKey)!.requiredQty += requiredQty
  }

  const insufficient: Array<{ label: string; requiredQty: number; availableQty: number; message?: string }> = []
  for (const group of groups.values()) {
    if (group.requiredQty > group.availableQty) {
      insufficient.push({
        label: group.label,
        requiredQty: group.requiredQty,
        availableQty: group.availableQty,
        message: `Required ${group.requiredQty}, Available ${group.availableQty}`,
      })
    }
  }

  if (insufficient.length > 0) {
    return {
      ok: false,
      message: formatInsufficientStockMessage(insufficient),
      insufficient,
      allocations: [],
    }
  }

  const allocations: Array<{
    row: Record<string, any>
    item: Record<string, any> | null
    requiredQty: number
    availableQty: number
    splits?: Array<{ item: Record<string, any>; qty: number }>
  }> = []
  for (const row of activeRows) {
    const requiredQty = requiredQtyFromDcRow(row)
    const compatible = compatibleInventoryItems(inventoryItems, row)
    const availableQty = stockAvailableForRow(inventoryItems, row)
    const ranked = [...compatible].sort((a, b) => {
      const aStock = remainingById.get(itemId(a)) ?? stockOf(a)
      const bStock = remainingById.get(itemId(b)) ?? stockOf(b)
      if (bStock !== aStock) return bStock - aStock
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    })
    let left = requiredQty
    const splits: Array<{ item: Record<string, any>; qty: number }> = []
    for (const item of ranked) {
      if (left <= 0) break
      const id = itemId(item)
      const have = remainingById.get(id) ?? stockOf(item)
      const take = Math.min(Math.max(0, have), left)
      if (take <= 0) continue
      splits.push({ item, qty: take })
      if (id) remainingById.set(id, have - take)
      left -= take
    }

    allocations.push({
      row,
      item: splits[0]?.item || compatible[0] || null,
      requiredQty,
      availableQty,
      splits,
    })
  }

  return { ok: true, message: '', insufficient: [], allocations }
}
