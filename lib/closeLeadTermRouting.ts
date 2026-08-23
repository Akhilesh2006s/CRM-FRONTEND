/**
 * Close Lead routing: group by product; Term/Level 2 → Term-Wise only when
 * the same product also has Term/Level 1.
 */

export const CLOSE_LEAD_DESTINATION = {
  MY_CLIENT: 'MY_CLIENT',
  TERM_WISE_DC: 'TERM_WISE_DC',
} as const

export type CloseLeadDestination =
  (typeof CLOSE_LEAD_DESTINATION)[keyof typeof CLOSE_LEAD_DESTINATION]

export type CloseLeadProductRow = {
  product?: string
  productName?: string
  product_name?: string
  term?: string
  level?: string
  strength?: number
  quantity?: number
  closeLeadDestination?: CloseLeadDestination
  [key: string]: unknown
}

function collapseLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export function getRowStageFlags(row: CloseLeadProductRow) {
  const levelKey = collapseLabel(row.level)
  const termKey = collapseLabel(row.term)

  const isLevel1 =
    levelKey === 'level1' ||
    /^level1(?!\d)/.test(levelKey)
  const isLevel2 =
    levelKey === 'level2' ||
    /^level2(?!\d)/.test(levelKey)

  const levelIsTerm1 = levelKey.startsWith('term1')
  const levelIsTerm2 = levelKey.startsWith('term2')
  const isLevelBased = isLevel1 || isLevel2

  // Level-based rows must not count a defaulted term for term pairing.
  const isTerm1 =
    levelIsTerm1 ||
    (!isLevelBased && (termKey === 'term1' || termKey === 't1' || termKey === 'both'))
  const isTerm2 =
    levelIsTerm2 ||
    (!isLevelBased && (termKey === 'term2' || termKey === 't2'))

  return { isLevel1, isLevel2, isTerm1, isTerm2 }
}

export function partitionProductsForCloseLeadRouting<T extends CloseLeadProductRow>(
  productDetails: T[]
) {
  const rows = Array.isArray(productDetails) ? productDetails : []
  const byProduct = new Map<string, T[]>()

  for (const p of rows) {
    const name = String(p.product || p.productName || p.product_name || 'Unknown')
      .trim()
      .toLowerCase()
    if (!byProduct.has(name)) byProduct.set(name, [])
    byProduct.get(name)!.push(p)
  }

  const myClientsProducts: Array<T & { closeLeadDestination: CloseLeadDestination }> = []
  const termWiseProducts: Array<T & { closeLeadDestination: CloseLeadDestination }> = []

  for (const group of byProduct.values()) {
    const flags = group.map(getRowStageFlags)
    const hasLevel1 = flags.some((f) => f.isLevel1)
    const hasLevel2 = flags.some((f) => f.isLevel2)
    const hasTerm1 = flags.some((f) => f.isTerm1)
    const hasTerm2 = flags.some((f) => f.isTerm2)

    const splitByLevel = hasLevel1 && hasLevel2
    const splitByTerm = !splitByLevel && hasTerm1 && hasTerm2

    for (let i = 0; i < group.length; i++) {
      const p = group[i]
      const f = flags[i]
      let destination: CloseLeadDestination = CLOSE_LEAD_DESTINATION.MY_CLIENT

      if (splitByLevel && f.isLevel2) {
        destination = CLOSE_LEAD_DESTINATION.TERM_WISE_DC
      } else if (splitByTerm && f.isTerm2) {
        destination = CLOSE_LEAD_DESTINATION.TERM_WISE_DC
      }

      const stamped = { ...p, closeLeadDestination: destination }
      if (destination === CLOSE_LEAD_DESTINATION.TERM_WISE_DC) {
        termWiseProducts.push(stamped)
      } else {
        myClientsProducts.push(stamped)
      }
    }
  }

  return {
    myClientsProducts,
    termWiseProducts,
    needsTermWiseSplit: termWiseProducts.length > 0 && myClientsProducts.length > 0,
    termWiseOnly: termWiseProducts.length > 0 && myClientsProducts.length === 0,
  }
}

/** Rows that belong on Term-Wise DC (prefer explicit Close Lead stamp). */
export function isTermWiseRoutedRow(row: {
  closeLeadDestination?: string
  term?: string
  level?: string
}): boolean {
  if (row.closeLeadDestination === CLOSE_LEAD_DESTINATION.TERM_WISE_DC) return true
  if (row.closeLeadDestination === CLOSE_LEAD_DESTINATION.MY_CLIENT) return false
  // Legacy Term-Wise DC docs: status already isolates them; do not infer from Term 2 alone.
  return false
}

function rowIdentityKey(row: CloseLeadProductRow): string {
  return [
    String(row.product || row.productName || row.product_name || '').trim().toLowerCase(),
    String(row.level || '').trim().toLowerCase(),
    String(row.term || '').trim().toLowerCase(),
    String(row.class || '').trim().toLowerCase(),
    String(row.quantity ?? row.strength ?? ''),
  ].join('|')
}

/**
 * Keep only product-detail rows that qualify for Term-Wise when evaluated against
 * the full set of rows for the same sale (My Clients + Term-Wise).
 * Always re-runs per-product pairing (ignores stale TERM_WISE_DC stamps for Term-2-only).
 */
export function filterRowsForTermWiseDisplay<T extends CloseLeadProductRow>(
  termWiseDcRows: T[],
  allSaleRows: T[]
): T[] {
  const source = Array.isArray(termWiseDcRows) ? termWiseDcRows : []
  if (source.length === 0) return []

  const combined =
    Array.isArray(allSaleRows) && allSaleRows.length > 0
      ? allSaleRows
      : source

  // Recompute pairing from product/level/term — do not trust stale closeLeadDestination.
  const unstamped = combined.map((row) => {
    const { closeLeadDestination: _ignored, ...rest } = row
    return rest as T
  })
  const { termWiseProducts } = partitionProductsForCloseLeadRouting(unstamped)
  const allowed = new Set(termWiseProducts.map(rowIdentityKey))
  return source.filter((r) => allowed.has(rowIdentityKey(r)))
}

export function orderIdFromDc(dc: { dcOrderId?: unknown; _id?: string }): string {
  const raw = dc?.dcOrderId
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && raw !== null && '_id' in raw) {
    return String((raw as { _id?: string })._id || '')
  }
  return ''
}
