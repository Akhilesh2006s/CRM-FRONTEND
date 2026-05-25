import { normalizeProductTerm, termFromLevelLabel } from '@/lib/productTerm'

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

export type ResolveClientDCRowOpts = {
  hasProductCategories: (product: string) => boolean
  getProductCategories: (product: string) => string[]
}

/** Stable key for duplicate product lines (Request DC / Edit PO). */
export function productDetailLineKey(p: Record<string, any>): string {
  const product = String(p.product || p.productName || '')
    .trim()
    .toLowerCase()
  const klass = String(p.class ?? '').trim()
  const level = String(p.level ?? '')
    .trim()
    .toLowerCase()
  const specs = String(p.specs ?? 'Regular')
    .trim()
    .toLowerCase()
  const productCategory = String(p.productCategory ?? '')
    .trim()
    .toLowerCase()
  const term = String(p.term ?? '').trim()
  const qty = String(p.quantity ?? p.strength ?? '')
  return [product, klass, level, specs, productCategory, term, qty].join('|')
}

export function dedupeProductDetailLines(lines: any[]): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const p of Array.isArray(lines) ? lines : []) {
    if (!p || !(p.product || p.productName)) continue
    const key = productDetailLineKey(p)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p)
  }
  return out
}

/** Current DC lines + sibling DCs on same order (excludes re-adding current DC). */
export function mergeRequestDCProductDetails(
  currentDcId: string,
  currentDetails: any[],
  relatedDcs: any[]
): any[] {
  const merged: any[] = Array.isArray(currentDetails) ? [...currentDetails] : []
  for (const r of Array.isArray(relatedDcs) ? relatedDcs : []) {
    if (!r?._id || String(r._id) === String(currentDcId)) continue
    if (Array.isArray(r.productDetails)) {
      merged.push(...r.productDetails)
    }
  }
  return dedupeProductDetailLines(merged)
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
  index: number,
  used: Set<number>
) {
  const name = (detail.product || detail.productName || '').toLowerCase().trim()
  const cls = detail.class != null ? String(detail.class).trim() : ''
  const pc = (detail.productCategory || '').toLowerCase().trim()
  const sp = (detail.specs || '').toLowerCase().trim()

  for (let i = 0; i < orderProducts.length; i++) {
    if (used.has(i)) continue
    const o = orderProducts[i]
    const on = (o.product_name || '').toLowerCase().trim()
    const oc = o.class != null ? String(o.class).trim() : ''
    const opc = (o.productCategory || '').toLowerCase().trim()
    const os = (o.specs || '').toLowerCase().trim()
    if (on !== name) continue
    if (cls && oc && cls !== oc) continue
    if (pc && opc && pc !== opc) continue
    if (sp && os && sp !== os && sp !== 'regular') continue
    used.add(i)
    return o
  }

  for (let i = 0; i < orderProducts.length; i++) {
    if (used.has(i)) continue
    const o = orderProducts[i]
    const on = (o.product_name || '').toLowerCase().trim()
    const oc = o.class != null ? String(o.class).trim() : ''
    if (on === name && (!cls || !oc || cls === oc)) {
      used.add(i)
      return o
    }
  }

  if (index < orderProducts.length && !used.has(index)) {
    used.add(index)
    return orderProducts[index]
  }

  for (let i = 0; i < orderProducts.length; i++) {
    if (used.has(i)) continue
    if ((orderProducts[i].product_name || '').toLowerCase().trim() === name) {
      used.add(i)
      return orderProducts[i]
    }
  }

  return null
}

/** Term for Request DC / My Clients tables (explicit term wins over level label). */
export function resolveClientDCRowTerm(raw: { term?: unknown; level?: unknown }): string {
  if (raw.term != null && String(raw.term).trim() !== '') {
    return normalizeProductTerm(raw.term)
  }
  return termFromLevelLabel(raw.level) ?? 'Term 1'
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
    product,
    class: resolved.class,
    productCategory: resolved.productCategory,
    specs: resolved.specs,
    category: raw.category,
    quantity: quantityNum,
    strength: strengthNum,
    level: raw.level || raw.term || getDefaultLevel(product || 'Abacus'),
    term: resolveClientDCRowTerm(raw),
    subject: raw.subject || undefined,
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
            level: p.level || order.level,
            term: p.term ?? order.term,
            price: p.price ?? order.unit_price,
          }
        : p
      return mapToClientDCProductRow(merged, `dc-${idx + 1}`, opts, getDefaultLevel)
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
        },
        `dcorder-${idx + 1}`,
        opts,
        getDefaultLevel
      )
    )
  }

  return []
}
