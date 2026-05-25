/**
 * Integer-only field input: strips non-digits and removes leading zeros (065 → 65).
 * Empty string stays empty so fields do not show a stuck "0".
 */
export function normalizeIntegerInput(raw: string, max?: number): string {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits === '') return ''
  const parsed = parseInt(digits, 10)
  if (!Number.isFinite(parsed)) return ''
  const clamped = max != null ? Math.min(max, Math.max(0, parsed)) : Math.max(0, parsed)
  return String(clamped)
}
