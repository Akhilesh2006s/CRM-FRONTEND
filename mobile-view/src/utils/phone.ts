/** Phone numbers stored in the CRM: 10 to 15 digits. */

export const PHONE_DIGITS_MESSAGE = 'Enter a phone number with 10 to 15 digits.'

export function sanitizePhoneDigits(value: string, maxDigits = 15): string {
  return String(value || '').replace(/\D/g, '').slice(0, maxDigits)
}

export function phoneDigitsError(value: string, required = true): string | null {
  const digits = String(value || '').replace(/\D/g, '')
  if (!digits || digits === '0') return required ? PHONE_DIGITS_MESSAGE : null
  if (digits.length < 10 || digits.length > 15) return PHONE_DIGITS_MESSAGE
  return null
}
