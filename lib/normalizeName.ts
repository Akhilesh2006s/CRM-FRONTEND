/** Trim and collapse internal whitespace. Matches backend `utils/normalizeName.js`. */
export function normalizeName(name: string | null | undefined): string {
  return String(name || '').trim().replace(/\s+/g, ' ')
}

/** Case-insensitive match against existing `{ name }` records. */
export function isDuplicateName(
  name: string,
  items: Array<{ name?: string | null }>
): boolean {
  const target = normalizeName(name).toLowerCase()
  if (!target) return false
  return items.some((item) => normalizeName(item?.name).toLowerCase() === target)
}
