export const LEAD_PRODUCT_STATUSES = [
  'Hot',
  'Warm',
  'Not Interested',
  'Yet to Visit',
  'Visit Again',
] as const

export type LeadProductStatus = (typeof LEAD_PRODUCT_STATUSES)[number] | ''

export type LeadStyleProduct = {
  name: string
  status: string
  strength: string
  unit_price: string
  chance: string
  not_interested_reason: string
}

/** Hot is 80–100. Warm is 20 or more (no upper cap below Hot). Not Interested is 0. */
export function validateLeadStyleProducts(products: LeadStyleProduct[]): string | null {
  if (products.length === 0) {
    return 'All products must be included. Please wait for products to load.'
  }

  for (const p of products) {
    if (!p.status) {
      return `Select a status for product "${p.name}".`
    }

    if (p.status === 'Not Interested') {
      if (!String(p.not_interested_reason || '').trim()) {
        return `Please enter a reason why the school is not interested in "${p.name}".`
      }
      continue
    }

    if (p.status !== 'Hot' && p.status !== 'Warm') continue

    const strengthNum = Number(p.strength)
    const chanceNum = p.chance === '' ? NaN : Number(p.chance)
    const unitPriceNum = Number(p.unit_price)

    if (!String(p.unit_price || '').trim() || !Number.isFinite(unitPriceNum) || unitPriceNum <= 0) {
      return `Please enter a Unit Price greater than 0 for product "${p.name}".`
    }

    if (!String(p.strength || '').trim() || !Number.isFinite(strengthNum) || strengthNum <= 0) {
      return `Please enter strength for product "${p.name}" when status is ${p.status}.`
    }

    if (p.status === 'Hot') {
      if (!Number.isFinite(chanceNum) || chanceNum < 80) {
        return `Chance % for product "${p.name}" must be at least 80% when status is Hot.`
      }
    } else if (!Number.isFinite(chanceNum) || chanceNum < 20) {
      return `Chance % for product "${p.name}" must be at least 20% when status is Warm.`
    }
  }

  return null
}
