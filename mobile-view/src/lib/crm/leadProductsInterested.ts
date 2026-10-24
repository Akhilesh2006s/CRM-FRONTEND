/** Copied from the web app (lib/leadProductsInterested.ts); keep the two in sync. */
/** Per-product status/strength/chance from lead create — used in follow-up & edit. */

const LINE_STATUSES = new Set([
  'Hot',
  'Warm',
  'Visit Again',
  'Yet to Visit',
  'Not Met Management',
  'Not Interested',
  'Renewed',
  'Not Renewed',
])

/** Statuses that take the line out of the sale and need a reason. */
export const DROPPED_LINE_STATUSES = new Set(['Not Interested', 'Not Renewed'])
/** Statuses that carry strength / unit price / chance into the sale. */
export const PRICED_LINE_STATUSES = new Set(['Hot', 'Warm', 'Renewed'])

/** Grid details a renewal or cross-sale line keeps between follow-ups (class, series, level...). */
export type LeadProductLineDetails = {
  class?: string
  productCategory?: string
  specs?: string
  level?: string
  subject?: string
  section?: string
  program?: string
  stream?: string
  /** renewal = continues last year's product; cross_sale = new product for an existing school */
  sale_type?: 'renewal' | 'cross_sale'
}

const DETAIL_KEYS: Array<keyof LeadProductLineDetails> = [
  'class', 'productCategory', 'specs', 'level', 'subject', 'section', 'program', 'stream', 'sale_type',
]

export function pickLineDetails(p: Record<string, any> | null | undefined): LeadProductLineDetails {
  const out: Record<string, string> = {}
  for (const key of DETAIL_KEYS) {
    const v = p?.[key]
    if (v != null && String(v).trim() && String(v).trim() !== '-') out[key] = String(v).trim()
  }
  return out as LeadProductLineDetails
}

/** "Cl 3 · Star Juniors L1 · Term1" for a renewal line; '' when it has no grid details. */
export function lineDetailLabel(d: LeadProductLineDetails): string {
  const cls = d.class ? `Cl ${d.class}${d.section && d.section !== 'ALL' ? d.section : ''}` : ''
  return [cls, d.program, d.stream, d.productCategory, d.level, d.subject, d.specs].filter(Boolean).join(' · ')
}

export function normalizeLeadProductLineStatus(status?: string): string {
  const s = (status || '').trim()
  if (s === 'Management Not Met' || s === 'Not Met Management') return 'Yet to Visit'
  if (LINE_STATUSES.has(s)) return s
  return ''
}

export type LeadProductInterestedRow = LeadProductLineDetails & {
  product_name: string
  term: string
  status: string
  strength: string
  unit_price: string
  chance: string
  not_interested_reason: string
}

export function leadProductsToInterestedRows(
  lead: {
    lead_status?: string
    priority?: string
    products?: Array<{
      product_name?: string
      product?: string
      term?: string
      status?: string
      strength?: number
      chance?: number
      quantity?: number
      unit_price?: number
      not_interested_reason?: string
    } & LeadProductLineDetails> | string
  },
  fallbackSchoolStatus?: string
): LeadProductInterestedRow[] {
  const schoolFallback = (fallbackSchoolStatus || lead.lead_status || lead.priority || 'Warm').trim()

  if (Array.isArray(lead.products) && lead.products.length > 0) {
    return lead.products
      .filter((p) => p && (p.product_name || p.product))
      .map((p) => {
        const lineStatus = normalizeLeadProductLineStatus(p.status) || schoolFallback || 'Warm'
        return {
          product_name: String(p.product_name || p.product || '').trim(),
          term: String(p.term || 'Term 1').trim(),
          status: lineStatus,
          // Strength is entered only for priced lines; the default quantity of 1 is not a strength.
          strength:
            PRICED_LINE_STATUSES.has(lineStatus) && Number(p.strength ?? 0) > 0
              ? String(Number(p.strength))
              : '',
          unit_price:
            Number(p.unit_price ?? 0) > 0 ? String(Number(p.unit_price ?? 0)) : '',
          chance: Number(p.chance ?? 0) > 0 ? String(Number(p.chance ?? 0)) : '',
          not_interested_reason: String(p.not_interested_reason || '').trim(),
          ...pickLineDetails(p),
        }
      })
  }

  if (typeof lead.products === 'string' && lead.products.trim()) {
    return lead.products
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({
        product_name: name,
        term: 'Term 1',
        status: schoolFallback || 'Warm',
        strength: '',
        unit_price: '',
        chance: '',
        not_interested_reason: '',
      }))
  }

  return []
}

export function isFollowUpProductLineComplete(row: LeadProductInterestedRow): boolean {
  if (!row.product_name?.trim()) return false

  if (DROPPED_LINE_STATUSES.has(row.status)) {
    return Boolean(String(row.not_interested_reason || '').trim())
  }

  if (row.status === 'Renewed') {
    return (Number(row.strength) || 0) > 0 && (Number(row.unit_price) || 0) > 0
  }

  if (row.status !== 'Hot' && row.status !== 'Warm') return true

  const unitPrice = Number(row.unit_price) || 0
  if (unitPrice <= 0) return false

  const strength = Number(row.strength) || 0
  const chance = Number(row.chance) || 0
  if (strength <= 0 || chance <= 0) return false
  if (row.status === 'Hot' && chance < 80) return false
  if (row.status === 'Warm' && chance < 20) return false
  return true
}

/** One follow-up card row per product: a product's class lines (renewals keep one per class) are merged. */
export type LeadProductDisplayRow = {
  product_name: string
  /** Distinct line statuses, e.g. "Warm" or "Warm / Hot". */
  status: string
  /** Students across all the product's lines. */
  strength: number
  /** Distinct chance values, e.g. "85" or "70 / 85"; '' when none. */
  chance: string
  classes: string[]
}

export function groupInterestedRowsForDisplay(rows: LeadProductInterestedRow[]): LeadProductDisplayRow[] {
  const groups = new Map<string, { name: string; statuses: string[]; strength: number; chances: string[]; classes: string[] }>()
  for (const row of rows) {
    const key = `${row.product_name.trim().toLowerCase()}|${row.sale_type || ''}`
    let g = groups.get(key)
    if (!g) {
      g = { name: row.product_name, statuses: [], strength: 0, chances: [], classes: [] }
      groups.set(key, g)
    }
    if (row.status && !g.statuses.includes(row.status)) g.statuses.push(row.status)
    const strength = Number(row.strength)
    if (strength > 0) g.strength += strength
    if (Number(row.chance) > 0 && !g.chances.includes(String(row.chance))) g.chances.push(String(row.chance))
    if (row.class && !g.classes.includes(row.class)) g.classes.push(row.class)
  }
  return Array.from(groups.values()).map((g) => ({
    product_name: g.name,
    status: g.statuses.join(' / '),
    strength: g.strength,
    chance: g.chances.join(' / '),
    classes: g.classes,
  }))
}
