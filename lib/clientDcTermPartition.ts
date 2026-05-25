import { resolveClientDCRowTerm } from './clientDcProductRows'

/** How to route Term 1 + Term 2 products when requesting DC from My Clients. */
export type RequestDcTermRouting = 'term1_only' | 'both_terms'

export function partitionRowsByTerm<T extends { term?: string; level?: string }>(rows: T[]) {
  const term1Products = rows.filter((row) => {
    const term = resolveClientDCRowTerm(row)
    return term === 'Term 1' || term === 'Both'
  })
  const term2Products = rows.filter((row) => resolveClientDCRowTerm(row) === 'Term 2')
  const hasMixedTerms = term1Products.length > 0 && term2Products.length > 0
  const term2Only = term2Products.length > 0 && term1Products.length === 0
  const term1Only = term1Products.length > 0 && term2Products.length === 0
  return { term1Products, term2Products, hasMixedTerms, term2Only, term1Only }
}

/** Term 2 → separate Term-Wise DC (legacy). Both terms → single Closed Sales DC. */
export function shouldSplitTerm2ToTermWise(
  hasMixedTerms: boolean,
  routing: RequestDcTermRouting | null
): boolean {
  return hasMixedTerms && routing === 'term1_only'
}
