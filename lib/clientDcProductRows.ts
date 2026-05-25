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

  const rawClass =
    row.class !== undefined && row.class !== null && String(row.class).trim() !== ''
      ? String(row.class).trim()
      : ''
  const classVal = rawClass && rawClass !== '0' ? rawClass : '1'

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
  if ((!specs || specs === 'Regular') && catRaw && !studentLike && isSkuCategory(catRaw)) {
    specs = skuCats.find((s) => s.toLowerCase() === catRaw.toLowerCase()) || catRaw
  }
  if (!specs) specs = 'Regular'

  return { class: classVal, productCategory: productCategory || undefined, specs }
}

/** Subject from line `subject` or `selected_subjects` (close lead / DcOrder products). */
export function resolveProductSubject(raw: Record<string, any> | null | undefined): string | undefined {
  if (!raw) return undefined
  if (raw.subject !== undefined && raw.subject !== null && String(raw.subject).trim() !== '') {
    return String(raw.subject).trim()
  }
  const selected = raw.selected_subjects
  if (Array.isArray(selected) && selected.length > 0) {
    const joined = selected.map((s) => String(s).trim()).filter(Boolean).join(', ')
    if (joined) return joined
  }
  return undefined
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
    term: normalizeProductTerm(
      raw.term != null && String(raw.term).trim() !== ''
        ? raw.term
        : (termFromLevelLabel(raw.level) ?? 'Term 1')
    ),
    subject: resolveProductSubject(raw),
  }
}

export type EditPOProductRow = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  class?: string
  specs?: string
  productCategory?: string
  category?: string
  strength?: number
  subject?: string
  level?: string
  term?: string
}

/** Prefer positive quantity; fall back to any defined numeric field. */
export function resolveProductQuantity(
  raw: Record<string, any>,
  order?: Record<string, any> | null
): number {
  const candidates = [raw.quantity, raw.strength, order?.quantity, order?.strength]
  for (const v of candidates) {
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n) && n > 0) return n
  }
  for (const v of candidates) {
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return 0
}

/** Unit price from DC line, DcOrder product, or total ÷ quantity. */
export function resolveProductUnitPrice(
  raw: Record<string, any>,
  order?: Record<string, any> | null,
  quantity?: number
): number {
  const qty = quantity ?? resolveProductQuantity(raw, order)
  const candidates = [raw.price, raw.unit_price, order?.unit_price]
  for (const v of candidates) {
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n) && n > 0) return n
  }
  const total = Number(raw.total)
  if (!Number.isNaN(total) && total > 0 && qty > 0) return total / qty
  for (const v of candidates) {
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return 0
}

export function computeEditPOTotalAmount(
  rows: Array<{ quantity: number; unit_price: number }>
): number {
  return rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0),
    0
  )
}

export function buildEditPOProductRows(
  dcProductDetails: any[],
  dcOrderProducts: any[],
  opts: ResolveClientDCRowOpts,
  getDefaultLevel: (product: string) => string,
  getAvailableLevels: (product: string) => string[]
): EditPOProductRow[] {
  const details = Array.isArray(dcProductDetails) ? dcProductDetails : []
  const orders = Array.isArray(dcOrderProducts) ? dcOrderProducts : []
  const usedOrderIdx = new Set<number>()

  const fromDetails =
    details.length > 0
      ? details.map((p: any, idx: number) => {
          const name = p.product || p.productName || p.product_name || ''
          const order = findMatchingOrderProduct(orders, p, idx, usedOrderIdx)
          const merged = order
            ? {
                ...p,
                product: name,
                class: order.class ?? p.class,
                specs: order.specs ?? p.specs,
                productCategory: order.productCategory ?? p.productCategory,
                quantity: p.quantity ?? order.quantity,
                strength: p.strength ?? order.strength ?? order.quantity,
                price: p.price ?? order.unit_price,
                level: p.level || order.level,
                term: p.term ?? order.term,
                subject: p.subject ?? order.subject,
                selected_subjects: p.selected_subjects ?? order.selected_subjects,
              }
            : p
          const resolved = resolveClientDCRowFields(merged, name, opts)
          const catalogLevels = getAvailableLevels(name)
          const fallbackLevel = catalogLevels[0] || getDefaultLevel(name || 'Abacus')
          const savedLevel = (merged.level && String(merged.level).trim()) || ''
          const level = savedLevel || fallbackLevel
          const term = normalizeProductTerm(
            merged.term ?? termFromLevelLabel(savedLevel) ?? termFromLevelLabel(level)
          )
          const quantity = resolveProductQuantity(merged, order)
          const unit_price = resolveProductUnitPrice(merged, order, quantity)
          const strength = resolveProductQuantity(merged, order)

          return {
            id: String(idx + 1),
            product_name: name,
            quantity,
            unit_price,
            class: resolved.class,
            specs: resolved.specs,
            productCategory: resolved.productCategory,
            category: merged.category,
            strength,
            subject: resolveProductSubject(merged),
            level,
            term,
          }
        })
      : []

  if (fromDetails.length > 0) return fromDetails

  return orders.map((p: any, idx: number) => {
    const name = p.product_name || ''
    const resolved = resolveClientDCRowFields(p, name, opts)
    const catalogLevels = getAvailableLevels(name)
    const fallbackLevel = catalogLevels[0] || getDefaultLevel(name || 'Abacus')
    const savedLevel = (p.level && String(p.level).trim()) || ''
    const level = savedLevel || fallbackLevel
    const term = normalizeProductTerm(
      p.term ?? termFromLevelLabel(savedLevel) ?? termFromLevelLabel(level)
    )
    const quantity = resolveProductQuantity(p, null)
    const unit_price = resolveProductUnitPrice(p, null, quantity)

    return {
      id: String(idx + 1),
      product_name: name,
      quantity,
      unit_price,
      class: resolved.class,
      specs: resolved.specs,
      productCategory: resolved.productCategory,
      category: p.category,
      strength: quantity,
      subject: resolveProductSubject(p),
      level,
      term,
    }
  })
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
            class: order.class ?? p.class,
            specs: order.specs ?? p.specs,
            productCategory: order.productCategory ?? p.productCategory,
            quantity: p.quantity ?? order.quantity,
            strength: p.strength ?? order.quantity ?? order.strength,
            level: p.level || order.level,
            term: p.term ?? order.term,
            price: p.price ?? order.unit_price,
            subject: p.subject ?? order.subject,
            selected_subjects: p.selected_subjects ?? order.selected_subjects,
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
          subject: p.subject,
          selected_subjects: p.selected_subjects,
        },
        `dcorder-${idx + 1}`,
        opts,
        getDefaultLevel
      )
    )
  }

  return []
}
