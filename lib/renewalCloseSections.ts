import {
  isIitProduct,
  makeRowId,
  normalizeIitSection,
  productCategoryRowKey,
  type CloseProductSection,
  type CloseProductSectionLine,
} from '@/lib/closeLeadProductConfig'
import { normalizeProductTerm } from '@/lib/productTerm'

/** Lines that are out of the sale. */
const DROPPED = new Set(['Not Interested', 'Not Renewed'])

type LeadLine = {
  product_name?: string
  product?: string
  status?: string
  class?: string
  productCategory?: string
  specs?: string
  level?: string
  subject?: string
  section?: string
  program?: string
  stream?: string
  strength?: number
  quantity?: number
  unit_price?: number
  term?: string
  deliverables?: string[]
}

const clean = (v: unknown) => {
  const s = String(v ?? '').trim()
  return s && s !== '-' ? s : ''
}
const unique = (values: string[]) => [...new Set(values.filter(Boolean))]

/**
 * Close Lead sections for a renewal lead's class lines (last year's grid): exactly the classes,
 * strengths, series, levels, specs, special notes and prices the school had, one section per
 * product. Not Renewed / Not Interested lines are left out. Lines without a class (e.g. a
 * cross-sale product) are not handled here; their product names are returned as `remaining`.
 */
export function renewalLinesToSections(lines: LeadLine[]): {
  sections: CloseProductSection[]
  handledProducts: Set<string>
} {
  const byProduct = new Map<string, LeadLine[]>()
  const handledProducts = new Set<string>()
  for (const line of lines || []) {
    const name = clean(line?.product_name || line?.product)
    if (!name || !clean(line.class)) continue
    handledProducts.add(name.toLowerCase())
    if (DROPPED.has(String(line.status || ''))) continue
    const key = name.toLowerCase()
    byProduct.set(key, [...(byProduct.get(key) || []), { ...line, product_name: name }])
  }

  const sections: CloseProductSection[] = []
  for (const productLines of byProduct.values()) {
    const product = clean(productLines[0].product_name)
    const strengthOf = (l: LeadLine) => Number(l.strength) || Number(l.quantity) || 0
    const levels = unique(productLines.map((l) => clean(l.level)))
    const subjects = unique(productLines.map((l) => clean(l.subject)))
    const specs = unique(productLines.map((l) => clean(l.specs)))
    const prices = productLines.map((l) => Number(l.unit_price) || 0)

    const line: CloseProductSectionLine = {
      id: makeRowId(),
      parentRowId: makeRowId(),
      product,
      level: levels[0] || '',
      selectedLevels: levels,
      classSelections: [],
      selectedSpecs: specs,
      specsTouched: specs.length > 0,
      selectedSubjects: subjects,
      selectedDeliverables: unique(productLines.flatMap((l) => l.deliverables || [])),
      productCategoryByKey: {},
      sameRateForAllClasses: new Set(prices).size <= 1,
      price: prices[0] || 0,
      priceByClass: {},
      term: productLines[0].term ? normalizeProductTerm(productLines[0].term) : undefined,
    }

    if (isIitProduct(product)) {
      line.iitAssignments = productLines.map((l) => ({
        id: makeRowId(),
        class: clean(l.class),
        section: normalizeIitSection(clean(l.section)),
        program: clean(l.program) || clean(l.productCategory),
        stream: clean(l.stream),
        strength: strengthOf(l),
        unitPrice: Number(l.unit_price) || 0,
      }))
    } else {
      // Special notes (CW / HW) and levels share the class's students: take the class strength once.
      const strengthByClass = new Map<string, number>()
      for (const l of productLines) {
        const cls = clean(l.class)
        strengthByClass.set(cls, Math.max(strengthByClass.get(cls) || 0, strengthOf(l)))
        if (Number(l.unit_price) > 0) line.priceByClass![cls] = Number(l.unit_price)
        const series = clean(l.productCategory)
        if (series) {
          line.productCategoryByKey![productCategoryRowKey(cls, clean(l.level) || undefined, clean(l.subject) || undefined)] = series
        }
      }
      line.classSelections = [...strengthByClass.entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([cls, strength]) => ({ class: cls, strength }))
    }

    sections.push({ id: makeRowId(), classSelections: [], lines: [line] })
  }
  return { sections, handledProducts }
}
