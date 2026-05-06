export const ALLOWED_PRODUCT_TERMS = ['Term 1', 'Term 2', 'Both'] as const
export type ProductTerm = (typeof ALLOWED_PRODUCT_TERMS)[number]

/** Maps UI / legacy strings to DcOrder `term` enum values. */
export function normalizeProductTerm(term: unknown): ProductTerm {
  if (term == null || term === '') return 'Term 1'
  const t = String(term).trim()
  if ((ALLOWED_PRODUCT_TERMS as readonly string[]).includes(t)) return t as ProductTerm
  const collapsed = t.toLowerCase().replace(/[\s_-]+/g, '')
  if (collapsed === 'term1' || collapsed === 't1') return 'Term 1'
  if (collapsed === 'term2' || collapsed === 't2') return 'Term 2'
  if (collapsed === 'both') return 'Both'
  return 'Term 1'
}

/**
 * When `level` encodes academic term (Term1 / Term 2 / Both), return the invoice term.
 * Returns null for unrelated level names (e.g. Abacus "Level 5").
 */
export function termFromLevelLabel(value: unknown): ProductTerm | null {
  const levelKey = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (levelKey.startsWith('term2')) return 'Term 2'
  if (levelKey.startsWith('term1')) return 'Term 1'
  if (levelKey.includes('both')) return 'Both'
  return null
}
