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

export function isSpecimenRow(row: { itemType?: unknown } | null | undefined): boolean {
  return String(row?.itemType || '') === SPECIMEN_ITEM_TYPE
}

/** One copy of each book (product + class + series/level/specs) the school selected, as Training Material. */
export function buildSpecimenRows<T extends Record<string, any>>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (isSpecimenRow(row) || canonicalDcRowCategory(row.category) === 'Training Material') continue
    const key = [row.product || row.productName, row.class, row.productCategory, row.level, row.specs, row.subject, row.term]
      .map((v) => String(v ?? '').trim().toLowerCase()).join('|')
    if (seen.has(key)) continue
    seen.add(key)
    const { lineId: _lineId, _id: _rowId, id: _id, ...rest } = row as Record<string, any>
    out.push({
      ...rest,
      category: 'Training Material',
      itemType: SPECIMEN_ITEM_TYPE,
      quantity: 1,
      strength: 1,
      unit_price: 0,
      price: 0,
      total: 0,
    } as unknown as T)
  }
  return out
}
