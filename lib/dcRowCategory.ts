/** DC row categories decide billing: New Students and Excess are billed;
 * Training Material (abacus kits, specimen copies) and Shortage are not.
 * Keep in sync with backend/utils/dcRowCategory.js. */
export const DC_ROW_CATEGORIES = ['New Students', 'Training Material', 'Shortage', 'Excess'] as const
export type DcRowCategory = (typeof DC_ROW_CATEGORIES)[number]

export const DC_ROW_CATEGORY_BILLING: Record<DcRowCategory, string> = {
  'New Students': 'Billing required',
  'Training Material': 'No billing',
  Shortage: 'No billing',
  Excess: 'Billing required',
}

const NON_BILLABLE = new Set<string>(['Training Material', 'Shortage'])

export const SPECIMEN_ITEM_TYPE = 'Specimen Copy'
export const RELATED_ITEM_TYPE = 'Related Item'

/** An item configured on a product that ships with it on every DC. */
export type ProductRelatedItem = {
  name: string
  billable: boolean
  price: number
  basis: 'per_student' | 'per_class'
  quantity: number
}

/** Map legacy labels ('new Students', 'Old Students', 'Training-Material', 'Excess-NewStudents', ...)
 * to one of DC_ROW_CATEGORIES. Unknown values (e.g. a book series) return ''. */
export function canonicalDcRowCategory(raw: unknown): DcRowCategory | '' {
  const key = String(raw || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!key) return ''
  if (key.startsWith('training')) return 'Training Material'
  if (key === 'shortage') return 'Shortage'
  if (key.startsWith('excess')) return 'Excess'
  if (['newstudents', 'newschool', 'existingstudents', 'existingschool', 'oldstudents', 'both'].includes(key)) {
    return 'New Students'
  }
  return ''
}

/** Category shown in DC forms; anything unrecognised is a regular billed row. */
export function dcRowCategoryOrDefault(raw: unknown): DcRowCategory {
  return canonicalDcRowCategory(raw) || 'New Students'
}

export function isBillableDcRow(row: { category?: unknown } | null | undefined, opts: { dcType?: string } = {}): boolean {
  if (opts.dcType === 'shortage') return false
  return !NON_BILLABLE.has(canonicalDcRowCategory(row?.category))
}

/** Zero the price of rows that must not be billed (keeps them visible as ₹0 lines). */
export function zeroNonBillableRows<T extends Record<string, any>>(rows: T[], opts: { dcType?: string } = {}): T[] {
  return rows.map((row) => (isBillableDcRow(row, opts) ? row : { ...row, unitPrice: 0, unit_price: 0, price: 0, total: 0 }))
}

export function isSpecimenRow(row: { itemType?: unknown; specs?: unknown } | null | undefined): boolean {
  // Older saves lost the marker; the specimen line is still recognisable by its specs text.
  return String(row?.itemType || '') === SPECIMEN_ITEM_TYPE || String(row?.specs || '') === 'Set as per DC list'
}

/** Parse a specimen copies input; blank/invalid falls back to 1. */
export function specimenCopiesValue(input: unknown): number {
  const n = Math.floor(Number(input))
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/** Class / specs shown on a specimen line: one set of the product's books as per the DC list. */
export const SPECIMEN_CLASS = 'NA'
export const SPECIMEN_SET_SPECS = 'Set as per DC list'

/**
 * Specimen copies as Training Material: one line per product ("<product> set as per DC list",
 * class NA) with `copies` sets, not one copy per class / series / book.
 */
export function buildSpecimenRows<T extends Record<string, any>>(rows: T[], copies = 1): T[] {
  const qty = specimenCopiesValue(copies)
  const byProduct = new Map<string, T>()
  for (const row of rows) {
    if (isSpecimenRow(row) || isRelatedItemRow(row) || canonicalDcRowCategory(row.category) === 'Training Material') continue
    const product = String(row.product || row.productName || row.product_name || '').trim()
    if (product && !byProduct.has(product.toLowerCase())) byProduct.set(product.toLowerCase(), row)
  }
  const out: T[] = []
  for (const row of Array.from(byProduct.values())) {
    const {
      lineId: _lineId, _id: _rowId, id: _id, section: _section, program: _program, stream: _stream,
      subject: _subject, selected_subjects: _subjects, productCategory: _series, subjectPackage: _pkg,
      ...rest
    } = row as Record<string, any>
    out.push({
      ...rest,
      class: SPECIMEN_CLASS,
      level: '',
      specs: SPECIMEN_SET_SPECS,
      category: 'Training Material',
      itemType: SPECIMEN_ITEM_TYPE,
      quantity: qty,
      strength: qty,
      unit_price: 0,
      price: 0,
      total: 0,
    } as unknown as T)
  }
  return out
}

export function isRelatedItemRow(row: { itemType?: unknown } | null | undefined): boolean {
  return String(row?.itemType || '') === RELATED_ITEM_TYPE
}

/**
 * One DC row per related item per class of each product the school took. The item name goes in
 * `specs` so it shows in every DC table. Billable items carry the product's price ('New Students');
 * non-billable ones go as Training Material at ₹0. Per-student quantity uses the class strength:
 * the largest row per section (levels/specs share students), summed across sections.
 */
export function buildRelatedItemRows<T extends Record<string, any>>(
  rows: T[],
  getRelatedItems: (productName: string) => ProductRelatedItem[],
): T[] {
  const classes = new Map<string, { base: T; sections: Map<string, number> }>()
  for (const row of rows) {
    if (isSpecimenRow(row) || isRelatedItemRow(row) || canonicalDcRowCategory(row.category) === 'Training Material') continue
    const product = String(row.product || row.productName || row.product_name || '').trim()
    const className = String(row.class ?? '').trim()
    if (!product || !className) continue
    const key = `${product.toLowerCase()}|${className.toLowerCase()}`
    const entry = classes.get(key) ?? { base: row, sections: new Map<string, number>() }
    const section = String(row.section || '').trim().toUpperCase()
    const strength = Number(row.strength ?? row.quantity) || 0
    entry.sections.set(section, Math.max(entry.sections.get(section) || 0, strength))
    classes.set(key, entry)
  }
  const out: T[] = []
  for (const { base, sections } of classes.values()) {
    const product = String(base.product || base.productName || base.product_name || '').trim()
    const strength = [...sections.values()].reduce((sum, n) => sum + n, 0)
    for (const item of getRelatedItems(product) || []) {
      const name = String(item?.name || '').trim()
      if (!name) continue
      const per = Math.max(1, Math.floor(Number(item.quantity) || 1))
      const quantity = item.basis === 'per_class' ? per : per * strength
      if (!(quantity > 0)) continue
      const unitPrice = item.billable ? Number(item.price) || 0 : 0
      out.push({
        product,
        productName: product,
        class: base.class,
        term: base.term,
        dispatchMode: base.dispatchMode,
        level: '',
        specs: name,
        category: item.billable ? 'New Students' : 'Training Material',
        itemType: RELATED_ITEM_TYPE,
        quantity,
        strength: quantity,
        unit_price: unitPrice,
        price: unitPrice,
        total: unitPrice * quantity,
        deliverables: [],
      } as unknown as T)
    }
  }
  return out
}
