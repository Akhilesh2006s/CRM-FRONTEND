import { computeBucketAmount, type CalculationType } from '@/lib/paymentDivisor'
import { normalizeProductTerm, termFromLevelLabel, type ProductTerm } from '@/lib/productTerm'

export type GroupProductOpts = {
  getCalculationType: (productName: string) => CalculationType
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
}

export type ProductDetailRow = {
  id: string
  product: string
  class: string
  fromClass?: string
  toClass?: string
  category: string
  productCategory?: string
  quantity: number
  strength: number
  price: number
  total: number
  level: string
  specs: string
  subject?: string
  isParentRow?: boolean
  sameRateForAllClasses?: boolean
  selectedSubjects?: string[]
  selectedSpecs?: string[]
  selectedCategories?: string[]
  selectedDeliverables?: string[]
  term?: string
}

export type ClassStrengthSelection = {
  class: string
  strength: number
}

export type CloseProductSectionLine = {
  id: string
  parentRowId: string
  product: string
  /** @deprecated use selectedLevels — kept for saved leads */
  level: string
  /** Term / level options chosen above the table (e.g. Term 1, Term 2). */
  selectedLevels: string[]
  /** Per-product class + strength (independent for each product in the section). */
  classSelections: ClassStrengthSelection[]
  sameStrengthForAllClasses?: boolean
  fromClass?: string
  toClass?: string
  strength?: number
  selectedSpecs: string[]
  selectedSubjects: string[]
  selectedDeliverables: string[]
  selectedCategories?: string[]
  /**
   * Per-row Product Category keyed by `class|level|subject`.
   * Survives class generation, adding another product, and re-expansion.
   */
  productCategoryByKey?: Record<string, string>
  sameRateForAllClasses: boolean
  price: number
  term?: string
}

export type CloseProductSection = {
  id: string
  /** Legacy range fields — migrated into classSelections when loading */
  fromClass?: string
  toClass?: string
  strength?: number
  classSelections: ClassStrengthSelection[]
  sameStrengthForAllClasses?: boolean
  lines: CloseProductSectionLine[]
}

export const SELECTABLE_CLOSE_CLASSES = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
]

export const makeRowId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

/** Per-line Product Category map key: class + level + subject. */
export function productCategoryRowKey(
  classValue: string,
  level?: string,
  subject?: string
): string {
  return `${String(classValue ?? '')}|${String(level ?? '')}|${String(subject ?? '')}`
}

/** Cross-row identity so P1 Class 1 stays distinct from P2 Class 1. */
export function productCategoryRowIdentity(
  parentRowId: string,
  product: string,
  classValue: string,
  level?: string,
  subject?: string
): string {
  return [
    parentRowId,
    product,
    String(classValue ?? ''),
    String(level ?? ''),
    String(subject ?? ''),
  ].join('|')
}

export function categoryValueFromRow(
  row: Pick<ProductDetailRow, 'category' | 'productCategory'>
): string {
  const sku = typeof row.productCategory === 'string' ? row.productCategory.trim() : ''
  if (sku) return sku
  return typeof row.category === 'string' ? row.category.trim() : ''
}

function parentRowIdForChild(child: ProductDetailRow, parents: ProductDetailRow[]): string {
  const match = parents.find((p) => p.isParentRow && child.id.startsWith(`${p.id}_`))
  return match?.id || ''
}

export function buildProductCategoryOverrideMap(
  rows: ProductDetailRow[] | undefined
): Record<string, string> {
  const map: Record<string, string> = {}
  if (!rows?.length) return map
  const parents = rows.filter((r) => r.isParentRow)
  for (const row of rows) {
    if (row.isParentRow) continue
    const value = categoryValueFromRow(row)
    if (!value) continue
    const parentId = parentRowIdForChild(row, parents)
    if (!parentId) continue
    map[
      productCategoryRowIdentity(parentId, row.product, row.class, row.level, row.subject)
    ] = value
  }
  return map
}

function firstNonEmptyCategory(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    if (trimmed) return trimmed
  }
  return ''
}

/**
 * Keep an existing Product Category. Only use the catalog default when the row
 * has no value yet — never replace a selection with cats[0].
 */
export function resolveRowProductCategory(existing: string | undefined, fallback: string): string {
  const current = typeof existing === 'string' ? existing.trim() : ''
  if (current) return current
  return typeof fallback === 'string' ? fallback.trim() : ''
}

/** Group child product rows per product + class. For level_based / subject_based,
 * sum strengths across distinct levels/subjects; duplicate same level+subject uses max.
 */
export const groupProductDetailsByProductAndClass = (
  details: any[],
  opts?: GroupProductOpts
) => {
  const getCt = (name: string) => opts?.getCalculationType(name) ?? ('none' as CalculationType)
  const getFallback = (name: string, ct: CalculationType) =>
    opts?.getCatalogFallbackCount(name, ct) ?? 0

  const normLevel = (l: any) =>
    String(l || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
  const normSubject = (s: any) => String(s || '').trim().toLowerCase()

  const map = new Map<string, any>()

  details.forEach((p) => {
    const key = `${p.product || ''}||${p.class || ''}`
    const strength = Number(p.strength) || 0
    const price = Number(p.price) || 0
    const ct = getCt(p.product || '')

    const existing = map.get(key)
    if (!existing) {
      if (ct === 'level_based' || ct === 'subject_based') {
        map.set(key, {
          ...p,
          strength,
          price,
          _dimRows: [{ strength, level: p.level, subject: p.subject, price }],
        })
      } else {
        map.set(key, {
          ...p,
          strength,
          price,
          total: strength * price,
        })
      }
      return
    }

    const mergedPrice = Math.max(Number(existing.price) || 0, price)

    if (ct === 'level_based' || ct === 'subject_based') {
      const dimRows = [...(existing._dimRows || [])]
      const prevDims = new Set(
        dimRows.map((r: any) => `${normLevel(r.level)}|${normSubject(r.subject || '')}`)
      )
      const thisDim = `${normLevel(p.level)}|${normSubject(p.subject || '')}`
      const duplicateDim = prevDims.has(thisDim)
      const mergedStrength = duplicateDim
        ? Math.max(Number(existing.strength) || 0, strength)
        : (Number(existing.strength) || 0) + strength
      dimRows.push({ strength, level: p.level, subject: p.subject, price })
      map.set(key, {
        ...existing,
        strength: mergedStrength,
        price: mergedPrice,
        _dimRows: dimRows,
      })
    } else {
      const mergedStrength = Math.max(Number(existing.strength) || 0, strength)
      map.set(key, {
        ...existing,
        strength: mergedStrength,
        price: mergedPrice,
        total: mergedStrength * mergedPrice,
      })
    }
  })

  return Array.from(map.values()).map((row) => {
    if (row._dimRows) {
      const ct = getCt(row.product || '')
      const total = computeBucketAmount({
        calculationType: ct,
        rows: row._dimRows,
        unitPrice: Number(row.price) || 0,
        catalogFallbackCount: getFallback(row.product || '', ct),
      })
      const { _dimRows, ...rest } = row
      return { ...rest, total }
    }
    return row
  })
}

export function rangeToClassSelections(
  fromClass: string,
  toClass: string,
  strength: number
): ClassStrengthSelection[] {
  const from = parseInt(fromClass, 10)
  const to = parseInt(toClass, 10)
  if (from === 0 || to === 0 || from > to || strength <= 0) return []
  const out: ClassStrengthSelection[] = []
  for (let i = from; i <= to; i++) {
    out.push({ class: String(i), strength })
  }
  return out
}

export function getSectionClassSelections(sec: CloseProductSection): ClassStrengthSelection[] {
  if (sec.classSelections?.length) return sec.classSelections
  return rangeToClassSelections(sec.fromClass ?? '0', sec.toClass ?? '0', Number(sec.strength) || 0)
}

export function getLineClassSelections(
  line: CloseProductSectionLine,
  sec?: CloseProductSection
): ClassStrengthSelection[] {
  // Empty array is intentional (all classes unchecked / all Product Details rows deleted).
  if (Array.isArray(line.classSelections)) return line.classSelections
  if (sec?.classSelections?.length && sec.lines.length === 1 && sec.lines[0]?.id === line.id) {
    return sec.classSelections
  }
  if (line.fromClass != null && line.toClass != null) {
    return rangeToClassSelections(line.fromClass, line.toClass, Number(line.strength) || 0)
  }
  if (sec) return getSectionClassSelections(sec)
  return []
}

export function parentRowIdForDetailRow(
  row: ProductDetailRow,
  details: ProductDetailRow[]
): string | undefined {
  if (row.isParentRow) return row.id
  return details.find((p) => p.isParentRow && row.id.startsWith(`${p.id}_`))?.id
}

/**
 * Rebuild class checkboxes from remaining Product Details rows.
 * Classes with no remaining row are omitted (unchecked, strength/rate dropped).
 */
export function syncClassSelectionsFromDetailRows(
  previous: ClassStrengthSelection[],
  remainingChildRows: ProductDetailRow[]
): ClassStrengthSelection[] {
  const strengthByClass = new Map<string, number>()
  for (const row of remainingChildRows) {
    if (row.isParentRow) continue
    const cls = String(row.class || '').trim()
    if (!cls) continue
    const strength = Number(row.strength) || Number(row.quantity) || 0
    const existing = strengthByClass.get(cls)
    if (existing == null || (strength > 0 && existing <= 0)) {
      strengthByClass.set(cls, strength)
    }
  }
  const seen = new Set<string>()
  const next: ClassStrengthSelection[] = []
  for (const sel of previous) {
    const cls = String(sel.class || '').trim()
    if (!cls || !strengthByClass.has(cls) || seen.has(cls)) continue
    seen.add(cls)
    next.push({ class: cls, strength: strengthByClass.get(cls) ?? sel.strength })
  }
  for (const [cls, strength] of strengthByClass) {
    if (seen.has(cls)) continue
    seen.add(cls)
    next.push({ class: cls, strength })
  }
  return next
}

/** Count of checked subjects on a product line (unselected subjects do not count). */
export function getLineSelectedSubjectCount(line: CloseProductSectionLine): number {
  const subjects = (line.selectedSubjects || [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  return subjects.length
}

/**
 * Subject multiplier for list-price totals.
 * Products with no subject selection behave as multiplier 1 (strength × price).
 */
export function getLineSubjectPriceMultiplier(line: CloseProductSectionLine): number {
  const count = getLineSelectedSubjectCount(line)
  return count > 0 ? count : 1
}

/**
 * Per-class list price: classStrength × selectedSubjectCount × unitPrice
 * (subject count is 1 when no subjects are selected).
 */
export function computeClassSubjectUnitTotal(
  classStrength: number,
  selectedSubjectCount: number,
  unitPrice: number
): number {
  const strength = Number(classStrength) || 0
  const subjects = Math.max(1, Number(selectedSubjectCount) || 0)
  const price = Number(unitPrice) || 0
  return strength * subjects * price
}

/** UI line total: Σ (class strength × selected subjects × unit price). No payment divisor. */
export function computeLineDisplayTotal(
  line: CloseProductSectionLine,
  sec?: CloseProductSection
): number {
  const price = Number(line.price) || 0
  const subjectMult = getLineSubjectPriceMultiplier(line)
  return getLineClassSelections(line, sec).reduce(
    (sum, s) => sum + (Number(s.strength) || 0) * subjectMult * price,
    0
  )
}

/** Per-line quantity: Σ (class strength × selected subjects). */
export function computeLineDisplayQuantity(
  line: CloseProductSectionLine,
  sec?: CloseProductSection
): number {
  const subjectMult = getLineSubjectPriceMultiplier(line)
  return getLineClassSelections(line, sec).reduce(
    (sum, s) => sum + (Number(s.strength) || 0) * subjectMult,
    0
  )
}

/** Sum of per-line display totals across all product sections. */
export function computeSectionsDisplayTotal(sections: CloseProductSection[]): number {
  return sections.reduce(
    (sum, sec) =>
      sum + sec.lines.reduce((lineSum, line) => lineSum + computeLineDisplayTotal(line, sec), 0),
    0
  )
}

/**
 * Sum of per-line quantities across sections:
 * strength × selected subject count (not just raw class strength).
 */
export function computeSectionsDisplayQuantity(sections: CloseProductSection[]): number {
  return sections.reduce(
    (sum, sec) =>
      sum +
      sec.lines.reduce(
        (lineSum, line) => lineSum + computeLineDisplayQuantity(line, sec),
        0
      ),
    0
  )
}

/** Numeric class strength from a Product Details row (strength, then quantity). */
export function getProductDetailRowStrength(row: ProductDetailRow): number {
  const strength = Number(row.strength)
  if (Number.isFinite(strength) && strength > 0) return strength
  const quantity = Number(row.quantity)
  if (Number.isFinite(quantity) && quantity > 0) return quantity
  return 0
}

/**
 * Product Details table / DC payload source of truth: every displayed product must
 * have at least one class row with numeric strength greater than 0.
 * Empty or leftover section lines that never expanded into table rows are ignored.
 */
export function productDetailsHaveValidClassStrengths(rows: ProductDetailRow[]): boolean {
  const childRows = rows.filter((r) => !r.isParentRow)
  const byProduct = new Map<string, ProductDetailRow[]>()
  for (const row of childRows) {
    const name = String(row.product || '').trim()
    if (!name) continue
    const list = byProduct.get(name)
    if (list) list.push(row)
    else byProduct.set(name, [row])
  }
  if (byProduct.size === 0) return false
  for (const productRows of byProduct.values()) {
    if (!productRows.some((r) => getProductDetailRowStrength(r) > 0)) return false
  }
  return true
}

/** Prefer Product Details rows as source of truth: sum each row quantity/strength. */
export function computeProductDetailsDisplayQuantity(rows: ProductDetailRow[]): number {
  return rows
    .filter((r) => !r.isParentRow)
    .reduce((sum, r) => sum + (Number(r.quantity) || Number(r.strength) || 0), 0)
}

/** Sum of Product Details row totals (quantity × unit price per row). */
export function computeProductDetailsDisplayTotal(rows: ProductDetailRow[]): number {
  return rows
    .filter((r) => !r.isParentRow)
    .reduce((sum, r) => {
      const qty = Number(r.quantity) || Number(r.strength) || 0
      const price = Number(r.price) || 0
      return sum + qty * price
    }, 0)
}

export function lineHasValidClassSelections(
  line: CloseProductSectionLine,
  sec?: CloseProductSection
): boolean {
  return getLineClassSelections(line, sec).some((s) => Number(s.strength) > 0)
}

export function getLineSelectedLevels(
  line: CloseProductSectionLine,
  getDefaultLevel: (product: string) => string,
  getProductLevels: (product: string) => string[]
): string[] {
  if (line.selectedLevels?.length) return line.selectedLevels
  if (line.level) return [line.level]
  const catalog = getProductLevels(line.product)
  if (catalog.length === 1) return [catalog[0]]
  if (catalog.length > 0) return [getDefaultLevel(line.product)]
  return [getDefaultLevel(line.product)]
}

export function lineHasValidLevelSelections(
  line: CloseProductSectionLine,
  getDefaultLevel: (product: string) => string,
  getProductLevels: (product: string) => string[]
): boolean {
  const catalog = getProductLevels(line.product)
  if (catalog.length === 0) return true
  return getLineSelectedLevels(line, getDefaultLevel, getProductLevels).length > 0
}

export function sectionHasValidClassSelections(sec: CloseProductSection): boolean {
  if (sec.lines.length === 0) return false
  return sec.lines.every((line) => lineHasValidClassSelections(line, sec))
}

export function classSelectionBounds(selections: ClassStrengthSelection[]): {
  fromClass: string
  toClass: string
} {
  const nums = selections
    .map((s) => parseInt(s.class, 10))
    .filter((n) => !isNaN(n) && n > 0)
  if (nums.length === 0) return { fromClass: '0', toClass: '0' }
  return { fromClass: String(Math.min(...nums)), toClass: String(Math.max(...nums)) }
}

export type ExpandSectionsCtx = {
  hasProductSubjects: (product: string) => boolean
  getProductCategories: (product: string) => string[]
  hasProductCategories: (product: string) => boolean
  schoolType?: string
  /** Existing table rows — used so re-expansion does not clobber Product Category. */
  previousDetails?: ProductDetailRow[]
  /** Explicit per-row overrides (user selections), keyed by productCategoryRowIdentity. */
  categoryOverrides?: Record<string, string>
}

export function expandSectionsToProductDetails(
  sections: CloseProductSection[],
  ctx: ExpandSectionsCtx
): ProductDetailRow[] {
  const out: ProductDetailRow[] = []
  const schoolExisting = ctx.schoolType === 'Existing'
  const prevCategoryMap = buildProductCategoryOverrideMap(ctx.previousDetails)
  const categoryOverrides = ctx.categoryOverrides || {}

  for (const sec of sections) {
    for (const line of sec.lines) {
      const classSelections = getLineClassSelections(line, sec)
      if (classSelections.length === 0) continue

      const { fromClass, toClass } = classSelectionBounds(classSelections)
      const priceToUse = Number(line.price) || 0
      const levelsToUse = line.selectedLevels?.length
        ? line.selectedLevels
        : line.level
          ? [line.level]
          : []
      const hasSkuCategories = ctx.hasProductCategories(line.product)
      const skuCategories = hasSkuCategories ? ctx.getProductCategories(line.product) : []
      const enrollmentDefault = schoolExisting ? 'Existing Students' : 'New Students'
      const defaultCategory = hasSkuCategories
        ? skuCategories[0] || ''
        : enrollmentDefault

      const parentRow: ProductDetailRow = {
        id: line.parentRowId,
        product: line.product,
        class: '0',
        fromClass,
        toClass,
        category: defaultCategory,
        quantity: 1,
        strength: classSelections[0]?.strength || 0,
        price: priceToUse,
        total: 0,
        level: levelsToUse[0] || line.level,
        specs: (line.selectedSpecs && line.selectedSpecs[0]) || '',
        isParentRow: true,
        sameRateForAllClasses: line.sameRateForAllClasses,
        selectedSubjects: line.selectedSubjects || [],
        selectedSpecs: line.selectedSpecs || [],
        selectedDeliverables: line.selectedDeliverables || [],
        selectedCategories: undefined,
        term:
          line.term !== undefined && line.term !== ''
            ? normalizeProductTerm(line.term)
            : undefined,
      }
      out.push(parentRow)

      const selectedSpecs = line.selectedSpecs || []
      const selectedSubjects = line.selectedSubjects || []
      const hasSubjects =
        ctx.hasProductSubjects(line.product) && selectedSubjects.length > 0
      const subjectsToUse =
        hasSubjects && selectedSubjects.length > 0 ? selectedSubjects : [undefined]
      const subjectPriceMult = hasSubjects ? selectedSubjects.length : 1

      let rowIdx = 0
      const parentId = line.parentRowId
      if (levelsToUse.length === 0) continue

      // One row per (selected class × selected level × selected subject).
      for (const classSel of classSelections) {
        const strengthToUse = Number(classSel.strength) || 0
        const classNum = parseInt(classSel.class, 10)
        if (!classNum || strengthToUse <= 0) continue

        for (const level of levelsToUse) {
          for (const subject of subjectsToUse) {
            const classValue = classNum.toString()
            const lineKey = productCategoryRowKey(classValue, level, subject)
            const identity = productCategoryRowIdentity(
              parentId,
              line.product,
              classValue,
              level,
              subject
            )
            const existingCategory = firstNonEmptyCategory(
              categoryOverrides[identity],
              line.productCategoryByKey?.[lineKey],
              prevCategoryMap[identity]
            )
            const category = resolveRowProductCategory(existingCategory, defaultCategory)
            if (category) {
              categoryOverrides[identity] = category
            }
            // Per-subject row stores strength×price; class list-price uses subject count via computeLineDisplayTotal.
            out.push({
              id: `${parentId}_${classNum}_${rowIdx++}`,
              product: line.product,
              class: classValue,
              category,
              productCategory: hasSkuCategories ? category : undefined,
              quantity: strengthToUse || 1,
              strength: strengthToUse,
              price: priceToUse || 0,
              total: strengthToUse * (priceToUse || 0),
              level,
              specs: selectedSpecs[0] || '',
              subject,
              isParentRow: false,
              sameRateForAllClasses: false,
            })
          }
        }
      }
      // Keep parent.total as full line list-price (strength × subjects × price across classes).
      parentRow.total = classSelections.reduce(
        (sum, s) =>
          sum +
          computeClassSubjectUnitTotal(Number(s.strength) || 0, subjectPriceMult, priceToUse),
        0
      )
    }
  }
  return out
}

export function parentRowToSectionLine(p: ProductDetailRow): CloseProductSectionLine {
  const from = p.fromClass ?? '0'
  const to = p.toClass ?? '0'
  const strength = Number(p.strength) || 0
  const levelsFromSnapshot =
    Array.isArray((p as ProductDetailRow & { levels_snapshot?: string[] }).levels_snapshot) &&
    (p as ProductDetailRow & { levels_snapshot?: string[] }).levels_snapshot!.length > 0
      ? (p as ProductDetailRow & { levels_snapshot?: string[] }).levels_snapshot!
      : p.level
        ? [p.level]
        : []
  return {
    id: makeRowId(),
    parentRowId: p.id,
    product: p.product,
    level: levelsFromSnapshot[0] || p.level || '',
    selectedLevels: levelsFromSnapshot,
    classSelections: rangeToClassSelections(from, to, strength),
    sameStrengthForAllClasses: false,
    selectedSpecs: p.selectedSpecs || [],
    selectedSubjects: p.selectedSubjects || [],
    selectedDeliverables: p.selectedDeliverables || [],
    selectedCategories: undefined,
    productCategoryByKey: undefined,
    sameRateForAllClasses: p.sameRateForAllClasses || false,
    price: Number(p.price) || 0,
    term: p.term,
  }
}

export function parentRowsToSections(parents: ProductDetailRow[]): CloseProductSection[] {
  return parents.map((p) => ({
    id: makeRowId(),
    classSelections: [],
    lines: [parentRowToSectionLine(p)],
  }))
}

/** Best-effort: one section per parent row (preserves ranges and line metadata on reopen). */
export function productDetailsToSections(details: ProductDetailRow[]): CloseProductSection[] {
  return parentRowsToSections(details.filter((d) => d.isParentRow))
}

export type BuildDcOrderProductsOpts = {
  productDetails: ProductDetailRow[]
  getCalculationType: (productName: string) => CalculationType
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
  hasProductCategories: (product: string) => boolean
  getProductCategories: (product: string) => string[]
}

/**
 * Same products array shape Close Lead uses when saving to DcOrder
 * (grouped by product + class with class, levels, specs, deliverables, term, etc.).
 */
export function buildDcOrderProductsFromDetails(
  childRows: ProductDetailRow[],
  opts: BuildDcOrderProductsOpts
) {
  const groupOpts: GroupProductOpts = {
    getCalculationType: opts.getCalculationType,
    getCatalogFallbackCount: opts.getCatalogFallbackCount,
  }
  const groupedProductDetails = groupProductDetailsByProductAndClass(childRows, groupOpts)
  const { productDetails, hasProductCategories, getProductCategories } = opts

  return groupedProductDetails.map((p) => {
    const sampleChild = childRows.find(
      (r) =>
        !r.isParentRow &&
        (r.product || '') === (p.product || '') &&
        String(r.class || '') === String(p.class || '')
    )
    const parentRow = sampleChild
      ? productDetails.find(
          (parent) => parent.isParentRow && sampleChild.id.startsWith(parent.id + '_')
        )
      : productDetails.find((parent) => parent.isParentRow && parent.product === p.product)
    const deliverables = parentRow?.selectedDeliverables || []
    const bucketRows = childRows.filter(
      (r) =>
        (r.product || '') === (p.product || '') && String(r.class || '') === String(p.class || '')
    )
    const levelSet = new Set<string>()
    const subjectSet = new Set<string>()
    bucketRows.forEach((r) => {
      if (r.level) levelSet.add(String(r.level).trim())
      if (r.subject) subjectSet.add(String(r.subject).trim())
    })
    const termsFromLevels = new Set<ProductTerm>()
    bucketRows.forEach((r) => {
      const t = termFromLevelLabel(r.level)
      if (t) termsFromLevels.add(t)
    })
    let invoiceTerm: ProductTerm = normalizeProductTerm(parentRow?.term)
    if (termsFromLevels.size === 1) {
      invoiceTerm = [...termsFromLevels][0]
    } else if (termsFromLevels.size > 1) {
      invoiceTerm = 'Both'
    }
    const selectedSubjects =
      parentRow?.selectedSubjects?.length && parentRow.selectedSubjects.length > 0
        ? [...parentRow.selectedSubjects]
        : Array.from(subjectSet)
    // Class strength (per class, not multiplied) for strength field / Raise DC.
    const classStrength = Number(sampleChild?.strength) || 0
    // Quantity = sum of Product Details row quantities for this product+class
    // (one row per subject/level → strength × subjects × levels).
    const quantityFromRows = bucketRows.reduce(
      (sum, r) => sum + (Number(r.quantity) || Number(r.strength) || 0),
      0
    )
    const subjectCountForPrice =
      selectedSubjects.length > 0 ? selectedSubjects.length : 1
    const strengthQty = classStrength > 0 ? classStrength : Number(p.strength) || 0
    const unitPrice = Number(p.price) || 0
    const quantity =
      quantityFromRows > 0
        ? quantityFromRows
        : strengthQty * Math.max(1, subjectCountForPrice)
    const lineTotal = quantity * unitPrice
    return {
      product_name: p.product,
      quantity,
      strength: strengthQty,
      unit_price: unitPrice,
      total: lineTotal,
      class: String(p.class ?? '1'),
      specs: (p as any).specs || undefined,
      deliverables,
      productCategory: (() => {
        const skuCats = hasProductCategories(p.product) ? getProductCategories(p.product) : []
        const catStr = typeof (p as any).category === 'string' ? (p as any).category.trim() : ''
        const isSku = skuCats.some((c) => c.toLowerCase() === catStr.toLowerCase())
        return isSku ? catStr : (p as any).productCategory || undefined
      })(),
      selected_subjects: selectedSubjects,
      levels_snapshot: Array.from(levelSet),
      level: levelSet.size === 1 ? Array.from(levelSet)[0] : undefined,
      subject: subjectSet.size === 1 ? Array.from(subjectSet)[0] : undefined,
      term: invoiceTerm,
    }
  })
}

export type ValidateCloseLeadProductsOpts = {
  productDetails: ProductDetailRow[]
  productSections: CloseProductSection[]
  deliverablesByProduct?: Record<string, string[]>
  getCalculationType: (productName: string) => CalculationType
  getCatalogFallbackCount: (productName: string, ct: CalculationType) => number
  /** When true (Close Lead default), require deliverable selection if catalog has any. */
  requireDeliverables?: boolean
  /** When true (Close Lead default), require unit price > 0. */
  requireUnitPrice?: boolean
}

/** Shared validation matching Close Lead Turn-to-Client product checks. */
export function validateCloseLeadProductConfig(
  opts: ValidateCloseLeadProductsOpts
): { ok: true } | { ok: false; message: string } {
  const childRows = opts.productDetails.filter((pd) => !pd.isParentRow)
  const grouped = groupProductDetailsByProductAndClass(childRows, {
    getCalculationType: opts.getCalculationType,
    getCatalogFallbackCount: opts.getCatalogFallbackCount,
  })

  if (grouped.length === 0) {
    return {
      ok: false,
      message: 'Please add at least one product with classes and strength per product',
    }
  }

  // Validate class strength from Product Details rows (same structure the modal
  // table displays and buildDcOrderProductsFromDetails submits). Do not require
  // every productSections line to be valid: empty extra sections and leftover
  // preloaded lines never expand into table rows and are not sent to the API.
  if (!productDetailsHaveValidClassStrengths(opts.productDetails)) {
    return {
      ok: false,
      message: 'Each product must have at least one class with strength greater than 0.',
    }
  }

  if (opts.requireDeliverables !== false) {
    const parentRows = opts.productDetails.filter((pd) => pd.isParentRow)
    const deliverablesByProduct = opts.deliverablesByProduct || {}
    const productsWithDeliverables = parentRows.filter(
      (p) => (deliverablesByProduct[p.product] || []).length > 0
    )
    const invalidDeliverables = productsWithDeliverables.some((p) => {
      const selected = p.selectedDeliverables || []
      return selected.length === 0
    })
    if (invalidDeliverables) {
      return {
        ok: false,
        message:
          'Please select at least one deliverable for products that have deliverables configured.',
      }
    }
  }

  const requirePrice = opts.requireUnitPrice !== false
  const invalidProducts = grouped.filter(
    (p) =>
      !p.product ||
      !p.strength ||
      p.strength <= 0 ||
      (requirePrice && (!p.price || p.price <= 0))
  )
  if (invalidProducts.length > 0) {
    return {
      ok: false,
      message: requirePrice
        ? 'Please fill in Product, Quantity (Strength), and Unit Price for all products. Both Quantity and Unit Price are mandatory and must be greater than 0.'
        : 'Please fill in Product and Quantity (Strength) for all products. Strength must be greater than 0.',
    }
  }

  return { ok: true }
}
