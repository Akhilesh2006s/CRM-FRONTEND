/** A school created from the Chain page. It stays in the normal sale cycle. */
export function isChainSchool(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false
  const row = record as { isChain?: boolean; dcOrderId?: { isChain?: boolean } | string }
  if (row.isChain === true) return true
  if (row.dcOrderId && typeof row.dcOrderId === 'object' && row.dcOrderId.isChain === true) return true
  return false
}

/** Blue row so chain schools stay visible inside the existing sale lists. */
export function chainRowClass(record: unknown, base = ''): string {
  if (!isChainSchool(record)) return base
  return `${base} !bg-blue-100 hover:!bg-blue-200`.replace(/\s+/g, ' ').trim()
}
