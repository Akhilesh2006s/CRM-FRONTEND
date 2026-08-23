export const ALLOWED_PRODUCT_TERMS = ['Term 1', 'Term 2', 'Both'] as const
export type ProductTerm = (typeof ALLOWED_PRODUCT_TERMS)[number]

function collapseTermKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

/** Parse a term string without applying the empty-value default of Term 1. */
export function parseProductTerm(term: unknown): ProductTerm | string | null {
  if (term == null || String(term).trim() === '') return null
  const t = String(term).trim()
  if ((ALLOWED_PRODUCT_TERMS as readonly string[]).includes(t)) return t as ProductTerm
  const collapsed = collapseTermKey(t)
  if (collapsed === 'term1' || collapsed === 't1') return 'Term 1'
  if (collapsed === 'term2' || collapsed === 't2') return 'Term 2'
  if (collapsed === 'both') return 'Both'
  const numbered = collapsed.match(/^term(\d+)$/)
  if (numbered) return `Term ${Number(numbered[1])}`
  return null
}

/** Maps UI / legacy strings to DcOrder `term` enum values. */
export function normalizeProductTerm(term: unknown): ProductTerm {
  const parsed = parseProductTerm(term)
  if (parsed === 'Term 1' || parsed === 'Term 2' || parsed === 'Both') return parsed
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

/**
 * Map a product level/stage onto a term (Level 1 → Term 1, Level 2 → Term 2, …).
 * Does not hardcode a single term; works for any numbered level.
 */
export function termFromLevelStage(level: unknown): string | null {
  const fromLabel = termFromLevelLabel(level)
  if (fromLabel) return fromLabel
  const key = collapseTermKey(level)
  const match = key.match(/^(?:level|lvl|l)(\d+)$/)
  if (match) return `Term ${Number(match[1])}`
  return null
}

/**
 * Term for an existing DC/PO product row.
 * Empty-term persistence defaults to Term 1; that must not hide Level 2 / Term 2.
 * New PO rows can still default to Term 1 separately.
 */
export function resolveExistingProductTerm(row: { term?: unknown; level?: unknown }): string {
  const fromLevel = termFromLevelStage(row.level)
  const explicit = parseProductTerm(row.term)
  if (fromLevel && (!explicit || explicit === 'Term 1')) return fromLevel
  if (explicit) return String(explicit)
  if (fromLevel) return fromLevel
  return 'Term 1'
}

/** Persist term onto a product row. Recovers Term 2 from Level 2 before schema default Term 1. */
export function persistProductTerm(row: { term?: unknown; level?: unknown }): ProductTerm {
  const resolved = resolveExistingProductTerm(row)
  if (resolved === 'Term 1' || resolved === 'Term 2' || resolved === 'Both') return resolved
  return 'Term 1'
}
