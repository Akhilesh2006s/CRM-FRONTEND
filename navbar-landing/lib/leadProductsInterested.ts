/** Per-product status/strength/chance from lead create — used in follow-up & edit. */

const LINE_STATUSES = new Set([
  'Hot',
  'Warm',
  'Visit Again',
  'Not Met Management',
  'Not Interested',
])

export function normalizeLeadProductLineStatus(status?: string): string {
  const s = (status || '').trim()
  if (s === 'Management Not Met') return 'Not Met Management'
  if (LINE_STATUSES.has(s)) return s
  return ''
}

export type LeadProductInterestedRow = {
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
    }> | string
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
          strength:
            Number(p.strength ?? p.quantity ?? 0) > 0
              ? String(Number(p.strength ?? p.quantity ?? 0))
              : '',
          unit_price:
            Number(p.unit_price ?? 0) > 0 ? String(Number(p.unit_price ?? 0)) : '',
          chance: Number(p.chance ?? 0) > 0 ? String(Number(p.chance ?? 0)) : '',
          not_interested_reason: String(p.not_interested_reason || '').trim(),
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

  if (row.status === 'Not Interested') {
    return Boolean(String(row.not_interested_reason || '').trim())
  }

  const unitPrice = Number(row.unit_price) || 0
  if (unitPrice <= 0) return false

  const strength = Number(row.strength) || 0
  const chance = Number(row.chance) || 0
  if (row.status === 'Hot' || row.status === 'Warm') {
    if (strength <= 0 || chance <= 0) return false
    if (row.status === 'Hot' && chance < 80) return false
    if (row.status === 'Warm' && chance < 20) return false
  }
  return true
}
