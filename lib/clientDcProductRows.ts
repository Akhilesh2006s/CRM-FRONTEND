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

/** Unit price from DC line (`price`) or DcOrder line (`unit_price`). */
export function resolveDcProductUnitPrice(p: {
  unit_price?: number | string | null
  price?: number | string | null
}): number {
  const raw = p.unit_price ?? p.price
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
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
            // Prefer DcOrder commercial values when both sources exist.
            quantity: order.quantity ?? p.quantity,
            strength: order.quantity ?? order.strength ?? p.strength ?? p.quantity,
            level: p.level || order.level,
            term: p.term ?? order.term,
            price: order.unit_price ?? p.price,
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

export type EditPOProductRow = {
  id: string
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
    const level =
      merged.level ||
      getAvailableLevels(productName)[0] ||
      getDefaultLevel(productName || 'Abacus')

    return {
      id,
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
      return mapRow(p, order, `edit-${idx + 1}`)
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
        },
        p,
        `edit-order-${idx + 1}`
      )
    )
  }

  return []
}
