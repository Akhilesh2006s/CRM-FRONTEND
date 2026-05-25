export function normalizeName(name: string): string {
  return (name || '').trim().replace(/\s+/g, ' ')
}

export function normalizeNameLower(name: string): string {
  return normalizeName(name).toLowerCase()
}

export function isDuplicateName(name: string, existing: { name: string }[]): boolean {
  const key = normalizeNameLower(name)
  return existing.some((item) => normalizeNameLower(item.name) === key)
}
