/**
 * Renewal Leads → Create Follow-up: one line per product with its status this year.
 * Last year's products are Renewed / Not Renewed (or still Hot / Warm / Visit Again);
 * products added here are Cross-Sale and follow the new-school statuses.
 * Rules match the server's follow-up validation (PUT /leads/:id with productsInterested).
 * Keep in sync with the web lib/renewalFollowUp.ts.
 */

export const RENEWAL_FOLLOW_UP_STATUSES = ['Renewed', 'Not Renewed', 'Hot', 'Warm', 'Visit Again'] as const
export const CROSS_SALE_FOLLOW_UP_STATUSES = ['Hot', 'Warm', 'Visit Again', 'Not Interested'] as const

const PRICED = new Set(['Renewed', 'Hot', 'Warm'])
const DROPPED = new Set(['Not Renewed', 'Not Interested'])
const DETAIL_KEYS = ['class', 'productCategory', 'specs', 'level', 'subject', 'section', 'program', 'stream'] as const

export type RenewalFollowUpLine = {
  product_name: string
  term: string
  status: string
  strength: number | ''
  unit_price: number | ''
  chance: number | ''
  reason: string
  sale_type: 'renewal' | 'cross_sale'
  isFromPreviousDc: boolean
  /** Class / series / level etc. carried over unchanged. */
  details: Record<string, unknown>
}

/** Strength, Price and Chance % are asked for these statuses. */
export const isPricedStatus = (status: string) => PRICED.has(status)
/** A reason is asked for these statuses. */
export const isDroppedStatus = (status: string) => DROPPED.has(status)

export function followUpStatusOptions(line: Pick<RenewalFollowUpLine, 'sale_type'>): string[] {
  return line.sale_type === 'renewal' ? [...RENEWAL_FOLLOW_UP_STATUSES] : [...CROSS_SALE_FOLLOW_UP_STATUSES]
}

const num = (v: unknown): number | '' =>
  v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : ''

/** A product saved on the renewal lead, ready for the follow-up form. */
export function followUpLineFromLead(p: any): RenewalFollowUpLine {
  const sale_type: RenewalFollowUpLine['sale_type'] = p?.sale_type === 'cross_sale' ? 'cross_sale' : 'renewal'
  const options = followUpStatusOptions({ sale_type })
  const status = options.includes(p?.status) ? p.status : sale_type === 'renewal' ? 'Renewed' : 'Warm'
  const details: Record<string, unknown> = {}
  for (const key of DETAIL_KEYS) if (p?.[key] != null && p[key] !== '') details[key] = p[key]
  return {
    product_name: p?.product_name || p?.product || '',
    term: p?.term || 'Term 1',
    status,
    strength: num(p?.strength ?? p?.quantity),
    unit_price: num(p?.unit_price),
    chance: status === 'Renewed' ? 100 : num(p?.chance ?? p?.renewal_pct),
    reason: p?.not_interested_reason || '',
    sale_type,
    isFromPreviousDc: sale_type === 'renewal' || Boolean(p?.is_from_previous_dc),
    details,
  }
}

/** A product added in the follow-up (not bought last year). */
export function newCrossSaleFollowUpLine(): RenewalFollowUpLine {
  return {
    product_name: '',
    term: 'Term 1',
    status: 'Warm',
    strength: '',
    unit_price: '',
    chance: '',
    reason: '',
    sale_type: 'cross_sale',
    isFromPreviousDc: false,
    details: {},
  }
}

/** Change a line's status, clearing what the new status does not use. */
export function withFollowUpStatus(line: RenewalFollowUpLine, status: string): RenewalFollowUpLine {
  const next = { ...line, status }
  if (!isPricedStatus(status)) {
    next.strength = ''
    next.unit_price = ''
    next.chance = ''
  } else if (status === 'Renewed') {
    next.chance = 100
  } else if (line.status === 'Renewed') {
    next.chance = ''
  }
  if (!isDroppedStatus(status)) next.reason = ''
  return next
}

/** What is missing on one line, or null when it can be saved. */
export function followUpLineError(line: RenewalFollowUpLine): string | null {
  const name = line.product_name.trim() || 'Product'
  if (!line.status) return `Choose a status for ${name}`
  if (isDroppedStatus(line.status)) {
    return line.reason.trim()
      ? null
      : line.status === 'Not Renewed'
        ? `Enter why ${name} was not renewed`
        : `Enter why the school is not interested in ${name}`
  }
  if (!isPricedStatus(line.status)) return null
  if (!(Number(line.strength) > 0) || !(Number(line.unit_price) > 0)) {
    return `${name}: enter Strength and Price`
  }
  if (line.status === 'Renewed') return null
  const chance = Number(line.chance)
  if (!(chance >= 1 && chance <= 100)) return `${name}: enter Chance % (1 to 100)`
  if (line.status === 'Hot' && chance < 80) return `${name}: Chance % must be at least 80 for Hot`
  if (line.status === 'Warm' && chance < 20) return `${name}: Chance % must be at least 20 for Warm`
  return null
}

/** The line as sent in productsInterested. */
export function followUpLinePayload(line: RenewalFollowUpLine) {
  const priced = isPricedStatus(line.status)
  const strength = priced ? Number(line.strength) || 0 : 0
  return {
    ...line.details,
    product_name: line.product_name.trim(),
    term: line.term || 'Term 1',
    status: line.status,
    strength,
    quantity: strength || 1,
    unit_price: priced ? Number(line.unit_price) || 0 : 0,
    chance: line.status === 'Renewed' ? 100 : priced ? Number(line.chance) || 0 : 0,
    not_interested_reason: isDroppedStatus(line.status) ? line.reason.trim() : '',
    sale_type: line.sale_type,
    is_from_previous_dc: line.isFromPreviousDc,
  }
}
