/** Display legacy numeric and current employee codes with the VESPL prefix. */
export function formatEmployeeCode(
  value: string | null | undefined,
  fallback = '—'
): string {
  const raw = String(value || '').trim()
  if (!raw) return fallback

  const withoutPrefix = raw.replace(/^VESPL/i, '')
  const suffix = /^\d+$/.test(withoutPrefix)
    ? withoutPrefix.padStart(4, '0')
    : withoutPrefix

  return `VESPL${suffix}`
}
