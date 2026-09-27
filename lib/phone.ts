/** Strip non-digits and cap length for phone/mobile fields. */
export function sanitizePhoneInput(value: string, maxDigits = 15): string {
  return String(value || '').replace(/\D/g, '').slice(0, maxDigits)
}

/** Phone numbers: 10 to 15 digits. */
export const PHONE_DIGITS_REGEX = /^\d{10,15}$/

export const PHONE_DIGITS_MESSAGE = 'Enter a phone number with 10 to 15 digits.'

/** @deprecated Use PHONE_DIGITS_REGEX. Kept so older imports still resolve. */
export const INDIAN_MOBILE_REGEX = PHONE_DIGITS_REGEX

/**
 * Required phone/mobile: digits only, length 10–15.
 */
export function validateStrictIndianMobile(
  value: string
): { ok: true; digits: string } | { ok: false; message: string } {
  return validatePhoneDigits(value, { required: true })
}

export function validatePhoneDigits(
  value: string,
  options: { required?: boolean } = {}
): { ok: true; digits: string } | { ok: false; message: string } {
  const { required = true } = options
  const trimmed = String(value || '').trim()
  if (!trimmed || trimmed === '0') {
    if (!required) return { ok: true, digits: '' }
    return { ok: false, message: PHONE_DIGITS_MESSAGE }
  }
  if (/\D/.test(trimmed) || !PHONE_DIGITS_REGEX.test(trimmed)) {
    return { ok: false, message: PHONE_DIGITS_MESSAGE }
  }
  return { ok: true, digits: trimmed }
}

/** Phone/mobile: digits only, length 10–15. */
export function validateIndianMobile(
  value: string,
  fieldLabel: string
): { ok: true; digits: string } | { ok: false; message: string } {
  const digits = sanitizePhoneInput(value, 15)
  if (!digits) {
    return { ok: false, message: `${fieldLabel} must be 10 to 15 digits` }
  }
  if (!PHONE_DIGITS_REGEX.test(digits)) {
    return { ok: false, message: `${fieldLabel} must be 10 to 15 digits` }
  }
  return { ok: true, digits }
}
