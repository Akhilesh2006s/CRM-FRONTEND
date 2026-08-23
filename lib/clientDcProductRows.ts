import { persistProductTerm } from '@/lib/productTerm'
import { partitionProductsForCloseLeadRouting } from '@/lib/closeLeadTermRouting'

const STUDENT_ENROLLMENT_CATEGORIES = [
  'New Students',
  'Existing Students',
  'Both',
  'New School',
  'Existing School',
] as const

function isStudentEnrollmentCategory(cat: string) {
  const normalized = String(cat || '').trim().toLowerCase()
  return STUDENT_ENROLLMENT_CATEGORIES.some((s) => s.toLowerCase() === normalized)
}

/** First saved commercial unit price (> 0 wins). Accepts unit_price or price. */
export function resolvePersistedUnitPrice(
  ...vals: Array<number | string | null | undefined>
): number {
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) return n
  }
  for (const v of vals) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return 0
}

export type ResolveClientDCRowOpts = {
  hasProductCategories: (product: string) => boolean
  getProductCategories: (product: string) => string[]
}

export function formatFlowProductName(
  productName: string | undefined,
  productCategory?: string,
  subject?: string
): string {
  const base = String(productName || '').trim()
  const cat = String(productCategory || '').trim()
  const subj = String(subject || '').trim()
  if (!base) return '-'
  const parts = [base]
  if (cat) parts.push(cat)
  if (subj) parts.push(subj)
  return parts.join(' ')
}

export function productLineIdentityKey(p: Record<string, any>): string {
  const product = String(p.product || p.productName || p.product_name || '')
    .trim()
    .toLowerCase()
  const klass = String(p.class ?? '').trim().toLowerCase()
  const level = String(p.level ?? '')
    .trim()
    .toLowerCase()
  const specs = String(p.specs ?? '').trim().toLowerCase()
  const productCategory = String(p.productCategory ?? '')
    .trim()
    .toLowerCase()
  const subject = String(p.subject ?? '')
    .trim()
    .toLowerCase()
  const term = String(p.term ?? '')
    .trim()
    .toLowerCase()
  return [product, klass, level, specs, productCategory, subject, term].join('|')
}

export function productRowLineId(p: Record<string, any> | null | undefined): string {
  return String(p?.lineId || '').trim()
}

/** Stable id for a product-detail row. Never uses array index as the only identity. */
export function ensureProductLineId(row: Record<string, any>, fallbackIndex?: number): string {
  const existing = productRowLineId(row)
  if (existing) return existing
  const identity = productLineIdentityKey(row)
  if (identity.replace(/\|/g, '')) {
    return `line:${identity}`
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `line:${Date.now()}-${fallbackIndex ?? 0}-${Math.random().toString(36).slice(2, 8)}`
}

/** Prefer the list with more distinct class/subject/level lines (and higher qty). */
export function pickRicherProductRows(primary: any[], secondary: any[]): any[] {
  const keep = (p: any) => p && (p.product || p.productName || p.product_name)
  const a = (Array.isArray(primary) ? primary : []).filter(keep)
  const b = (Array.isArray(secondary) ? secondary : []).filter(keep)
  if (!a.length) return b
  if (!b.length) return a
  const identA = new Set(a.map((p) => productLineIdentityKey(p))).size
  const identB = new Set(b.map((p) => productLineIdentityKey(p))).size
  if (identB > identA) return b
  if (identA > identB) return a
  if (b.length > a.length) return b
  if (a.length > b.length) return a
  const qty = (rows: any[]) =>
    rows.reduce((s, p) => s + (Number(p.quantity) || Number(p.strength) || 0), 0)
  if (qty(b) > qty(a)) return b
  return a
}

/** Drop a second copy of the same DC line that only differs by empty vs filled level. */
export function collapseEmptyLevelDuplicateLines(rows: any[]): any[] {
  const result: any[] = []
  for (const row of rows || []) {
    const rowEmpty = !hasUsableProductLevel(row?.level)
    const classKey = productClassBaseKey(row)
    const existingIdx = result.findIndex((r) => productClassBaseKey(r) === classKey)
    if (existingIdx < 0) {
      result.push(row)
      continue
    }
    const existing = result[existingIdx]
    const existingEmpty = !hasUsableProductLevel(existing?.level)
    const existingLevel = String(existing?.level ?? '').trim()
    const rowLevel = String(row?.level ?? '').trim()
    if (!existingEmpty && !rowEmpty && existingLevel.toLowerCase() !== rowLevel.toLowerCase()) {
      result.push(row)
      continue
    }
    if (existingEmpty && !rowEmpty) {
      result[existingIdx] = row
    }
  }
  return result
}

export function displayProductLevel(level?: unknown): string {
  const s = String(level ?? '').trim()
  if (!s || s === '-') return '-'
  return s
}

export function hasUsableProductLevel(level?: unknown): boolean {
  return displayProductLevel(level) !== '-'
}

/** Product + class + subject. Ignores level/term/specs so grouped leftovers can match. */
export function productClassBaseKey(p: Record<string, any>): string {
  const product = String(p.product || p.productName || p.product_name || '')
    .trim()
    .toLowerCase()
  const klass = String(p.class ?? '').trim().toLowerCase()
  const subject = String(p.subject ?? '')
    .trim()
    .toLowerCase()
  return [product, klass, subject].join('|')
}

/** Map approved Edit PO / DcOrder product lines onto this DC's Request DC table. */
export function orderProductToClientDcDetail(p: Record<string, any>) {
  const qty = Number(p.quantity) || Number(p.strength) || 0
  return {
    lineId: productRowLineId(p) || undefined,
    product: p.product_name || p.product || p.productName || '',
    product_name: p.product_name || p.product || p.productName || '',
    class: p.class,
    specs: p.specs,
    productCategory: p.productCategory,
    category: p.category,
    quantity: qty,
    strength: Number(p.strength) || qty,
    level: p.level,
    term: p.term,
    subject: p.subject,
    price: p.unit_price ?? p.price,
    unit_price: p.unit_price ?? p.price,
    total: p.total,
    selected_subjects: Array.isArray(p.selected_subjects) ? p.selected_subjects : undefined,
  }
}

/**
 * My Clients / Term 1 DC rows only.
 * Drops sibling Term-Wise allocations and paired later-stage lines
 * (same product with Level 1 + Level 2, or Term 1 + Term 2).
 * Does not drop a later-stage product that stands alone on this DC.
 */
export function keepMyClientsOwnedProductRows(rows: any[], siblingRows: any[] = []): any[] {
  const withoutSiblings = (Array.isArray(rows) ? rows : []).filter(
    (p) => !lineMatchesTermWiseCompanion(p, siblingRows || [])
  )
  const { myClientsProducts } = partitionProductsForCloseLeadRouting(withoutSiblings)
  return myClientsProducts
}

/**
 * After Edit PO is approved, new lines (e.g. P2) live on DcOrder.products.
 * Add those onto this DC without pulling Term-Wise companion lines (P3 L2).
 */
export function appendMissingMyClientsOrderLines(
  dcDetails: any[],
  orderProducts: any[],
  siblingRows: any[]
): any[] {
  const rows = Array.isArray(dcDetails) ? [...dcDetails] : []
  const seen = new Set(rows.map((r) => productLineIdentityKey(r)))
  const seenComposite = new Set(rows.map((r) => poRowCompositeKey(r)))
  const seenClassBase = new Set(rows.map((r) => productClassBaseKey(r)))
  const seenSplitSubject = new Set(
    rows.filter((r) => blankPoPart(r.subject)).map((r) => productClassLevelKey(r))
  )
  const namesWithFirstStage = new Set(
    rows
      .filter((r) => r && !isSecondStageLine(r))
      .map((r) =>
        String(r.product || r.productName || r.product_name || '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  )

  for (const p of Array.isArray(orderProducts) ? orderProducts : []) {
    const mapped = orderProductToClientDcDetail(p)
    if (!mapped.product) continue
    if (lineMatchesTermWiseCompanion(mapped, siblingRows)) continue
    const mappedName = String(mapped.product || '')
      .trim()
      .toLowerCase()
    if (isSecondStageLine(mapped) && namesWithFirstStage.has(mappedName)) continue
    const composite = poRowCompositeKey(mapped)
    if (seenComposite.has(composite)) continue
    const key = productLineIdentityKey(mapped)
    if (seen.has(key)) continue
    const classKey = productClassBaseKey(mapped)
    const mappedEmpty = !hasUsableProductLevel(mapped.level)
    if (mappedEmpty && seenClassBase.has(classKey)) continue
    if (!blankPoPart(mapped.subject) && seenSplitSubject.has(productClassLevelKey(mapped))) continue
    seen.add(key)
    seenComposite.add(composite)
    seenClassBase.add(classKey)
    if (blankPoPart(mapped.subject)) seenSplitSubject.add(productClassLevelKey(mapped))
    rows.push(mapped)
  }
  return keepMyClientsOwnedProductRows(rows, siblingRows)
}

export function isSecondStageLine(row: Record<string, any>): boolean {
  const levelKey = String(row?.level ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  const termKey = String(row?.term ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
  return (
    levelKey === 'level2' ||
    /^level2(?!\d)/.test(levelKey) ||
    levelKey === 'l2' ||
    levelKey === 'lvl2' ||
    levelKey.startsWith('term2') ||
    termKey === 'term2' ||
    termKey === 't2'
  )
}

export function lineMatchesTermWiseCompanion(
  row: Record<string, any>,
  siblingRows: Record<string, any>[]
): boolean {
  const key = productLineIdentityKey(row)
  if ((siblingRows || []).some((s) => productLineIdentityKey(s) === key)) return true
  const name = String(row.product || row.productName || row.product_name || '')
    .trim()
    .toLowerCase()
  if (!name) return false
  if (isSecondStageLine(row)) {
    return (siblingRows || []).some((s) => {
      const sn = String(s.product || s.productName || s.product_name || '')
        .trim()
        .toLowerCase()
      return sn === name && isSecondStageLine(s)
    })
  }
  // Level/term was lost on a grouped leftover (UI shows Level "-") but Term-Wise
  // still owns this product+class as a later-stage allocation.
  if (!hasUsableProductLevel(row.level)) {
    const classKey = productClassBaseKey(row)
    return (siblingRows || []).some(
      (s) => isSecondStageLine(s) && productClassBaseKey(s) === classKey
    )
  }
  return false
}

function blankPoPart(value: unknown): string {
  const s = String(value ?? '').trim().toLowerCase()
  if (!s || s === '-' || s === 'n/a' || s === 'na') return ''
  return s
}

/** Edit PO / Request DC unique row: productName + class + subject + level. */
export function poRowCompositeKey(p: Record<string, any>): string {
  const product = blankPoPart(p.product || p.productName || p.product_name)
  const klass = blankPoPart(p.class)
  const subject = blankPoPart(p.subject)
  const level = blankPoPart(p.level)
  return [product, klass, subject, level].join('|')
}

function productClassLevelKey(p: Record<string, any>): string {
  return [blankPoPart(p.product || p.productName || p.product_name), blankPoPart(p.class), blankPoPart(p.level)].join(
    '|'
  )
}

/**
 * Keep saved PO lines as-is. Drop grouped leftovers (empty subject/level) when a
 * split row already exists, then dedupe by productName + class + subject + level.
 * Does not explode subjects or levels from Product Master.
 */
export function dedupeSavedPoRows(rows: any[]): any[] {
  const list = (Array.isArray(rows) ? rows : []).filter(
    (p) => p && (p.product || p.productName || p.product_name)
  )

  const hasSplitSubject = new Set<string>()
  const hasFilledLevel = new Set<string>()
  for (const row of list) {
    if (blankPoPart(row.subject)) hasSplitSubject.add(productClassLevelKey(row))
    if (hasUsableProductLevel(row.level)) hasFilledLevel.add(productClassBaseKey(row))
  }

  const filtered = list.filter((row) => {
    if (!blankPoPart(row.subject) && hasSplitSubject.has(productClassLevelKey(row))) return false
    if (!hasUsableProductLevel(row.level) && hasFilledLevel.has(productClassBaseKey(row))) return false
    return true
  })

  const seen = new Set<string>()
  const out: any[] = []
  for (const row of filtered) {
    const key = poRowCompositeKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export function requestDcRowQuantity(row: { strength?: unknown; quantity?: unknown }): number {
  return Number(row?.strength) || Number(row?.quantity) || 0
}

/** Stable key for duplicate product lines (Request DC / Edit PO). */
export function productDetailLineKey(p: Record<string, any>): string {
  return poRowCompositeKey(p)
}

export function dedupeProductDetailLines(lines: any[]): any[] {
  return dedupeSavedPoRows(lines)
}

/** Current DC lines only. Sibling DCs on the same order must never be merged in. */
export function mergeRequestDCProductDetails(
  _currentDcId: string,
  currentDetails: any[],
  _relatedDcs?: any[]
): any[] {
  return dedupeProductDetailLines(Array.isArray(currentDetails) ? currentDetails : [])
}

/** Normalize class / SKU category / specs for Client DC & Request DC tables. */
export function resolveClientDCRowFields(
  row: Record<string, any>,
  productName: string,
  opts: ResolveClientDCRowOpts
) {
  const name = productName || row.product || row.productName || row.product_name || ''
  const skuCats = opts.hasProductCategories(name) ? opts.getProductCategories(name) : []
  const isSkuCategory = (cat: string) =>
    skuCats.some((s) => s.toLowerCase() === String(cat || '').trim().toLowerCase())

  const hasSku = skuCats.length > 0

  let rawClass =
    row.class !== undefined && row.class !== null && String(row.class).trim() !== ''
      ? String(row.class).trim()
      : ''
  if (!rawClass || rawClass === '0') {
    const from = row.fromClass != null ? String(row.fromClass).trim() : ''
    const to = row.toClass != null ? String(row.toClass).trim() : ''
    if (from && to && from !== to) rawClass = `${from}–${to}`
    else if (from) rawClass = from
  }
  if (!rawClass && Array.isArray(row.selected_classes) && row.selected_classes.length > 0) {
    rawClass = row.selected_classes.map((c: unknown) => String(c).trim()).filter(Boolean).join(', ')
  }
  const classVal =
    rawClass && rawClass !== '0' && rawClass !== '-1' ? rawClass : rawClass === '0' ? '' : '1'
  const classDisplay = classVal || '1'

  const catRaw = typeof row.category === 'string' ? row.category.trim() : ''
  const studentLike = catRaw !== '' && isStudentEnrollmentCategory(catRaw)

  let productCategory =
    typeof row.productCategory === 'string' ? row.productCategory.trim() : ''
  if (productCategory && isStudentEnrollmentCategory(productCategory)) {
    productCategory = ''
  }
  if (!productCategory && catRaw && isSkuCategory(catRaw)) {
    productCategory = skuCats.find((s) => s.toLowerCase() === catRaw.toLowerCase()) || catRaw
  }

  let specs =
    row.specs !== undefined && row.specs !== null && String(row.specs).trim() !== ''
      ? String(row.specs).trim()
      : ''
  if ((!specs || specs === 'Regular') && catRaw && !studentLike && isSkuCategory(catRaw) && !hasSku) {
    specs = skuCats.find((s) => s.toLowerCase() === catRaw.toLowerCase()) || catRaw
  }
  if (!specs) specs = 'Regular'

  return { class: classDisplay, productCategory: productCategory || undefined, specs }
}

export function findMatchingOrderProduct(
  orderProducts: any[],
  detail: any,
  _index: number,
  used: Set<number>
) {
  const items = Array.isArray(orderProducts) ? orderProducts : []
  const detailLineId = productRowLineId(detail)
  if (detailLineId) {
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue
      if (productRowLineId(items[i]) === detailLineId) {
        used.add(i)
        return items[i]
      }
    }
  }

  const identity = productLineIdentityKey(detail)
  if (identity.replace(/\|/g, '')) {
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue
      if (productLineIdentityKey(items[i]) === identity) {
        used.add(i)
        return items[i]
      }
    }
  }

  const name = (detail.product || detail.productName || detail.product_name || '').toLowerCase().trim()
  const cls = detail.class != null ? String(detail.class).trim().toLowerCase() : ''
  const level = String(detail.level ?? '').trim().toLowerCase()
  const subj = String(detail.subject ?? '').trim().toLowerCase()

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue
    const o = items[i]
    const on = (o.product_name || o.product || o.productName || '').toLowerCase().trim()
    const oc = o.class != null ? String(o.class).trim().toLowerCase() : ''
    const ol = String(o.level ?? '').trim().toLowerCase()
    const osj = String(o.subject ?? '').trim().toLowerCase()
    if (on !== name || !name) continue
    if (cls !== oc) continue
    if (subj !== osj) continue
    if (level !== ol) continue
    used.add(i)
    return o
  }

  return null
}

export function collectPoUnitPriceSources(dcOrder: any): any[] {
  const pending = Array.isArray(dcOrder?.pendingEdit?.products)
    ? dcOrder.pendingEdit.products
    : []
  const committed = Array.isArray(dcOrder?.products) ? dcOrder.products : []
  return [...pending, ...committed]
}

export function findPricedOrderProduct(
  orderProducts: any[],
  detail: any,
  used: Set<number>
) {
  const items = Array.isArray(orderProducts) ? orderProducts : []
  const exact = findMatchingOrderProduct(items, detail, 0, used)
  if (resolvePersistedUnitPrice(exact?.unit_price, exact?.price) > 0) return exact

  const name = (detail.product || detail.productName || detail.product_name || '')
    .toLowerCase()
    .trim()
  if (name) {
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue
      const o = items[i]
      const on = (o.product_name || o.product || o.productName || '').toLowerCase().trim()
      if (on !== name) continue
      if (resolvePersistedUnitPrice(o.unit_price, o.price) > 0) {
        used.add(i)
        return o
      }
    }
  }
  return exact
}

/** Term for Request DC / My Clients tables. Recovers Term 2 from Level 2 when schema defaulted term to Term 1. */
export function resolveClientDCRowTerm(raw: { term?: unknown; level?: unknown }): string {
  return persistProductTerm(raw)
}

function mapToClientDCProductRow(
  raw: Record<string, any>,
  id: string,
  opts: ResolveClientDCRowOpts,
  getDefaultLevel: (product: string) => string
) {
  const product = raw.product || raw.productName || raw.product_name || ''
  const resolved = resolveClientDCRowFields(raw, product, opts)
  const strengthNum =
    raw.strength !== null && raw.strength !== undefined ? Number(raw.strength) : 0
  const quantityNum =
    raw.quantity !== null && raw.quantity !== undefined ? Number(raw.quantity) : strengthNum

  return {
    id,
    lineId: productRowLineId(raw) || id,
    product,
    class: resolved.class,
    productCategory: resolved.productCategory,
    specs: resolved.specs,
    category: raw.category,
    quantity: quantityNum,
    strength: strengthNum,
    level: displayProductLevel(raw.level),
    term: resolveClientDCRowTerm(raw),
    subject: raw.subject || undefined,
    price: raw.price ?? raw.unit_price,
  }
}

export function buildClientDCProductRows(
  dcProductDetails: any[],
  dcOrderProducts: any[],
  opts: ResolveClientDCRowOpts,
  getDefaultLevel: (product: string) => string
) {
  const details = (Array.isArray(dcProductDetails) ? dcProductDetails : []).filter(
    (p) => p && (p.product || p.productName)
  )
  const orders = Array.isArray(dcOrderProducts) ? dcOrderProducts : []

  if (details.length > 0) {
    const used = new Set<number>()
    return details.map((p, idx) => {
      const order = findMatchingOrderProduct(orders, p, idx, used)
      const merged = order
        ? {
            ...p,
            product: p.product || order.product_name,
            class: p.class ?? order.class,
            specs: p.specs ?? order.specs,
            productCategory: p.productCategory ?? order.productCategory,
            category: p.category ?? order.category,
            fromClass: p.fromClass ?? order.fromClass,
            toClass: p.toClass ?? order.toClass,
            selected_classes: p.selected_classes ?? order.selected_classes,
            quantity: p.quantity ?? order.quantity,
            strength: p.strength ?? order.quantity ?? order.strength,
            level: p.level ?? order.level,
            term: p.term ?? order.term,
            subject: p.subject ?? order.subject,
            price: p.price ?? order.unit_price,
            lineId: productRowLineId(p) || productRowLineId(order),
          }
        : p
      return mapToClientDCProductRow(
        merged,
        ensureProductLineId(merged, idx),
        opts,
        getDefaultLevel
      )
    })
  }

  if (orders.length > 0) {
    return orders.map((p, idx) =>
      mapToClientDCProductRow(
        {
          product: p.product_name,
          class: p.class,
          specs: p.specs,
          productCategory: p.productCategory,
          category: p.category,
          quantity: p.quantity,
          strength: p.quantity ?? p.strength,
          level: p.level,
          term: p.term,
          subject: p.subject,
          lineId: productRowLineId(p),
        },
        ensureProductLineId(p, idx),
        opts,
        getDefaultLevel
      )
    )
  }

  return []
}

export type EditPOProductRow = {
  id: string
  lineId?: string
  product_name: string
  quantity: number
  unit_price: number
  level?: string
  term?: string
  class?: string
  specs?: string
  productCategory?: string
  category?: string
  strength?: number
  subject?: string
  selected_subjects?: string[]
}

/** Subject string for API payloads (DC productDetails / DcOrder products). */
export function resolveProductSubject(p: Record<string, any>): string | undefined {
  if (p.subject != null && String(p.subject).trim() !== '') {
    return String(p.subject).trim()
  }
  if (Array.isArray(p.selected_subjects) && p.selected_subjects.length > 0) {
    return p.selected_subjects
      .map((s: unknown) => String(s).trim())
      .filter(Boolean)
      .join(', ')
  }
  return undefined
}

export function computeEditPOTotalAmount(
  rows: Array<{ quantity?: number; unit_price?: number }>
): number {
  return rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
    0
  )
}

/** Build editable PO rows from DC productDetails + DcOrder products (Edit PO dialog). */
export function buildEditPOProductRows(
  dcProductDetails: any[],
  dcOrderProducts: any[],
  opts: ResolveClientDCRowOpts,
  getDefaultLevel: (product: string) => string,
  getAvailableLevels: (product: string) => string[]
): EditPOProductRow[] {
  const details = dedupeProductDetailLines(
    (Array.isArray(dcProductDetails) ? dcProductDetails : []).filter(
      (p) => p && (p.product || p.productName || p.product_name)
    )
  )
  const orders = Array.isArray(dcOrderProducts) ? dcOrderProducts : []

  const mapRow = (raw: Record<string, any>, order: any | null, id: string): EditPOProductRow => {
    const productName =
      raw.product || raw.product_name || raw.productName || order?.product_name || ''
    const merged = order
      ? {
          ...raw,
          product: productName,
          product_name: productName,
          class: raw.class ?? order.class,
          specs: raw.specs ?? order.specs,
          productCategory: raw.productCategory ?? order.productCategory,
          category: raw.category ?? order.category,
          quantity: raw.quantity ?? order.quantity,
          strength: raw.strength ?? order.quantity ?? order.strength,
          level: raw.level || order.level,
          term: raw.term ?? order.term,
          unit_price: order.unit_price ?? raw.unit_price ?? raw.price,
          subject: raw.subject ?? order.subject,
          selected_subjects: raw.selected_subjects ?? order.selected_subjects,
          lineId: productRowLineId(raw) || productRowLineId(order),
        }
      : raw

    const resolved = resolveClientDCRowFields(merged, productName, opts)
    const qty =
      merged.quantity != null
        ? Number(merged.quantity)
        : merged.strength != null
          ? Number(merged.strength)
          : 0
    const unitPrice =
      merged.unit_price != null
        ? Number(merged.unit_price)
        : merged.price != null
          ? Number(merged.price)
          : 0
    const savedLevel = String(merged.level || '').trim()
    const level = savedLevel && savedLevel !== '-' ? savedLevel : '-'

    return {
      id,
      lineId: ensureProductLineId(merged),
      product_name: productName,
      quantity: qty,
      unit_price: unitPrice,
      level,
      term: resolveClientDCRowTerm(merged),
      class: resolved.class,
      specs: resolved.specs,
      productCategory: resolved.productCategory,
      category: typeof merged.category === 'string' ? merged.category : undefined,
      strength: merged.strength != null ? Number(merged.strength) : qty,
      subject: resolveProductSubject(merged),
      selected_subjects: Array.isArray(merged.selected_subjects)
        ? merged.selected_subjects
        : undefined,
    }
  }

  if (details.length > 0) {
    const used = new Set<number>()
    return details.map((p, idx) => {
      const order = findMatchingOrderProduct(orders, p, idx, used)
      return mapRow(p, order, ensureProductLineId(p, idx))
    })
  }

  if (orders.length > 0) {
    return orders.map((p, idx) =>
      mapRow(
        {
          product_name: p.product_name,
          class: p.class,
          specs: p.specs,
          productCategory: p.productCategory,
          category: p.category,
          quantity: p.quantity,
          strength: p.quantity ?? p.strength,
          level: p.level,
          term: p.term,
          unit_price: p.unit_price,
          subject: p.subject,
          selected_subjects: p.selected_subjects,
          lineId: productRowLineId(p),
        },
        p,
        ensureProductLineId(p, idx),
      )
    )
  }

  return []
}

/** Catalog id when known; otherwise a stable name key. */
export function editPoProductIdentity(
  productName: string,
  getProductId?: (name: string) => string | undefined
): string {
  const name = String(productName || '').trim()
  const id = getProductId?.(name)
  if (id) return `id:${String(id)}`
  return `name:${name.toLowerCase()}`
}

export function normalizeEditPoLevelKey(level: unknown): string {
  const s = String(level ?? '')
    .trim()
    .toLowerCase()
  if (!s || s === '-' || s === 'n/a' || s === 'none') return ''
  return s
}

export function normalizeEditPoSubjectKey(subject: unknown): string {
  const s = String(subject ?? '')
    .trim()
    .toLowerCase()
  if (!s || s === '-' || s === 'n/a' || s === 'none') return ''
  return s
}

export type EditPoVariantRow = {
  product_name?: string
  product?: string
  productName?: string
  subject?: string
  selected_subjects?: string[]
  productCategory?: string
  specs?: string
  class?: string
}

export function normalizeEditPoCategoryKey(category: unknown): string {
  return normalizeEditPoSubjectKey(category)
}

/**
 * Close Lead line identity for Edit PO price-lock / manager approval.
 * A new subject or product category on an existing SKU is a new commercial line.
 */
export function editPoLineVariantKey(
  row: EditPoVariantRow,
  getProductId?: (name: string) => string | undefined
): string {
  const name = String(row.product_name || row.product || row.productName || '').trim()
  const product = editPoProductIdentity(name, getProductId)
  const listed = listSubjectsOnProductRow(row as Record<string, any>)
  const subject = normalizeEditPoSubjectKey(listed[0] || row.subject)
  const category = normalizeEditPoCategoryKey(row.productCategory)
  return `${product}::subj:${subject}::cat:${category}`
}

export function collectOriginalEditPoVariantKeys(
  products: EditPoVariantRow[] | undefined,
  getProductId?: (name: string) => string | undefined,
  getProductCategories?: (name: string) => string[]
): string[] {
  const keys = new Set<string>()
  for (const p of Array.isArray(products) ? products : []) {
    const name = String(p.product_name || p.product || p.productName || '').trim()
    if (!name) continue
    const subjects = listSubjectsOnProductRow(p as Record<string, any>)
    const productCategory =
      String(p.productCategory ?? '').trim() ||
      (getProductCategories?.(name) || []).map((s) => String(s).trim()).filter(Boolean)[0] ||
      ''
    if (subjects.length === 0) {
      keys.add(editPoLineVariantKey({ product_name: name, subject: '', productCategory }, getProductId))
      continue
    }
    for (const s of subjects) {
      keys.add(editPoLineVariantKey({ product_name: name, subject: s, productCategory }, getProductId))
    }
  }
  return Array.from(keys)
}

export function isOriginalEditPoLine(
  row: EditPoVariantRow,
  originalKeys: Iterable<string>,
  getProductId?: (name: string) => string | undefined
): boolean {
  const name = String(row.product_name || row.product || row.productName || '').trim()
  if (!name) return false
  const set = originalKeys instanceof Set ? originalKeys : new Set(originalKeys)
  return set.has(editPoLineVariantKey(row, getProductId))
}

export function editPoHasNewCommercialLines(
  rows: EditPoVariantRow[],
  originalKeys: Iterable<string>,
  getProductId?: (name: string) => string | undefined
): boolean {
  return (Array.isArray(rows) ? rows : []).some((row) => {
    const name = String(row.product_name || row.product || row.productName || '').trim()
    if (!name) return false
    return !isOriginalEditPoLine(row, originalKeys, getProductId)
  })
}

/** Subjects stored on a PO/DC line. A comma-joined `subject` is treated as multiple. */
export function listSubjectsOnProductRow(p: Record<string, any>): string[] {
  const single = String(p.subject ?? '').trim()
  if (single && single !== '-' && !single.includes(',')) {
    return [single]
  }
  if (Array.isArray(p.selected_subjects) && p.selected_subjects.length > 0) {
    return p.selected_subjects.map((s: unknown) => String(s || '').trim()).filter(Boolean)
  }
  if (single.includes(',')) {
    return single.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function expandSubjectCoverKey(row: Record<string, any>, subject?: string): string {
  const name = String(row.product_name || row.product || row.productName || '')
    .trim()
    .toLowerCase()
  const klass = String(row.class ?? '').trim().toLowerCase()
  const level = String(row.level ?? '').trim().toLowerCase()
  const subj = String(subject ?? row.subject ?? '')
    .trim()
    .toLowerCase()
  return `${name}::${klass}::${level}::${subj}`
}

/**
 * Close Lead may store one P2 row with selected_subjects=[Physics, Chemistry, Maths]
 * and quantity = strength × subjects. Edit PO needs one row per subject.
 * Never explode a row that already has a single subject — that duplicated P2 Phy/math
 * and made Save look like it reduced quantity.
 */
export function expandEditPoRowsBySubject<T extends Record<string, any>>(
  rows: T[],
  getProductSubjects: (productName: string) => string[]
): T[] {
  const source = Array.isArray(rows) ? rows : []
  const covered = new Set<string>()
  for (const row of source) {
    const subj = String(row.subject || '').trim()
    if (subj && subj !== '-' && !subj.includes(',')) {
      covered.add(expandSubjectCoverKey(row, subj))
    }
  }

  const out: T[] = []
  for (const row of source) {
    const name = String(row.product_name || row.product || row.productName || '').trim()
    const currentSubject = String(row.subject || '').trim()
    if (currentSubject && currentSubject !== '-' && !currentSubject.includes(',')) {
      out.push({
        ...row,
        subject: currentSubject,
        selected_subjects: [currentSubject],
        lineId: ensureProductLineId(row),
      })
      continue
    }

    const catalog = (getProductSubjects(name) || []).map((s) => String(s).trim()).filter(Boolean)
    const listed = listSubjectsOnProductRow(row)

    if (catalog.length === 0) {
      out.push({ ...row, subject: '', selected_subjects: [], lineId: ensureProductLineId(row) })
      continue
    }

    const subjects = (listed.length > 0 ? listed : [catalog[0]]).filter((s) => {
      return !covered.has(expandSubjectCoverKey(row, s))
    })
    if (subjects.length <= 1) {
      const s = subjects[0] || listed[0] || catalog[0]
      out.push({
        ...row,
        subject: s,
        selected_subjects: s ? [s] : [],
        lineId: ensureProductLineId({ ...row, subject: s }),
      })
      continue
    }

    const totalQty = Number(row.quantity) || 0
    const strength = Number(row.strength) || 0
    const n = subjects.length
    let perQty = totalQty
    if (strength > 0 && totalQty === strength * n) perQty = strength
    else if (totalQty > 0 && totalQty % n === 0) perQty = totalQty / n
    else if (strength > 0) perQty = strength

    subjects.forEach((s, i) => {
      covered.add(expandSubjectCoverKey(row, s))
      const exploded = {
        ...row,
        subject: s,
        selected_subjects: [s],
        quantity: perQty,
        strength: perQty,
      }
      out.push({
        ...exploded,
        id: `${row.id || 'row'}-${s}-${i}`,
        lineId: ensureProductLineId(exploded, i),
      })
    })
  }
  return out
}

type AddEditPoExistingRow = {
  id?: string
  product_name?: string
  level?: string
  subject?: string
  class?: string
  productCategory?: string
  specs?: string
}

export type AddEditPoPreferred = {
  subject?: string
  productCategory?: string
  specs?: string
}

function addEditPoClassOf(row: { class?: string }) {
  const c = String(row.class || '1').trim()
  return c && c !== '0' ? c : '1'
}

function effectiveAddEditPoCategory(row: { productCategory?: string }, catalogCategories: string[]): string {
  const current = String(row.productCategory || '').trim()
  if (current && current !== '-') return current
  return catalogCategories[0] || ''
}

function addEditPoClashKey(opts: {
  subject?: string
  productCategory?: string
  specs?: string
  class?: string
}): string {
  return [
    normalizeEditPoSubjectKey(opts.subject),
    normalizeEditPoCategoryKey(opts.productCategory),
    normalizeEditPoSubjectKey(opts.specs),
    addEditPoClassOf({ class: opts.class }),
  ].join('::')
}

/**
 * Add Product does not choose a level.
 * Duplicate = same catalog product + same subject + same product category + same specs.
 * Unused master subjects or product categories may each get their own row (P2 Phy/math, P1 workbook/hi).
 */
export function resolveAddEditPoProduct(
  productName: string,
  existingRows: AddEditPoExistingRow[],
  configuredLevels: string[],
  getProductId?: (name: string) => string | undefined,
  _resolveDisplayedLevel?: (productName: string, savedLevel?: string) => string,
  configuredSubjects: string[] = [],
  configuredCategories: string[] = [],
  preferred: AddEditPoPreferred = {}
): {
  level: string
  subject: string
  productCategory: string
  specs: string
  duplicateRow?: AddEditPoExistingRow
} {
  const rows = Array.isArray(existingRows) ? existingRows : []
  const sameProduct = rows.filter(
    (row) =>
      editPoProductIdentity(row.product_name || '', getProductId) ===
      editPoProductIdentity(productName, getProductId)
  )
  const defaultLevel = configuredLevels.length ? configuredLevels[0] : '-'
  const catalogSubjects = (configuredSubjects || []).map((s) => String(s).trim()).filter(Boolean)
  const catalogCategories = (configuredCategories || []).map((s) => String(s).trim()).filter(Boolean)
  const subjects = catalogSubjects.length ? catalogSubjects : ['']
  const categories = catalogCategories.length ? catalogCategories : ['']
  const specs = String(preferred.specs || '').trim()

  const used = new Set(
    sameProduct.map((row) =>
      addEditPoClashKey({
        subject: row.subject,
        productCategory: effectiveAddEditPoCategory(row, catalogCategories),
        specs: row.specs,
        class: addEditPoClassOf(row),
      })
    )
  )

  const preferredCategory = String(preferred.productCategory || '').trim()
  const preferredSubject = String(preferred.subject || '').trim()
  const candidates: { subject: string; category: string }[] = []
  for (const subject of subjects) {
    for (const category of categories) {
      candidates.push({ subject, category })
    }
  }
  candidates.sort((a, b) => {
    const score = (c: { subject: string; category: string }) => {
      let n = 0
      if (preferredCategory && normalizeEditPoCategoryKey(c.category) === normalizeEditPoCategoryKey(preferredCategory)) n -= 2
      if (preferredSubject && normalizeEditPoSubjectKey(c.subject) === normalizeEditPoSubjectKey(preferredSubject)) n -= 1
      return n
    }
    return score(a) - score(b)
  })

  for (const cand of candidates) {
    const key = addEditPoClashKey({
      subject: cand.subject,
      productCategory: cand.category,
      specs,
      class: '1',
    })
    if (!used.has(key)) {
      return {
        level: defaultLevel,
        subject: cand.subject,
        productCategory: cand.category,
        specs,
      }
    }
  }

  return {
    level: defaultLevel,
    subject: preferredSubject || catalogSubjects[0] || '',
    productCategory: preferredCategory || catalogCategories[0] || '',
    specs,
    duplicateRow: sameProduct.find((row) => addEditPoClassOf(row) === '1') || sameProduct[0],
  }
}
