/** Strip non-digits and cap length for phone/mobile fields. */
export function sanitizePhoneInput(value: string, maxDigits = 15): string {
  return String(value || '').replace(/\D/g, '').slice(0, maxDigits)
}

/** Indian mobile: exactly 10 digits, first digit 6–9. */
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/

/**
 * Strict Indian mobile validation (New Employee, etc.).
 * Message matches product requirement.
 */
export function validateStrictIndianMobile(
  value: string
): { ok: true; digits: string } | { ok: false; message: string } {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' }
  }
  // Reject if any non-digit remains (emails, spaces, symbols, decimals)
  if (/\D/.test(trimmed)) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' }
  }
  if (!INDIAN_MOBILE_REGEX.test(trimmed)) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' }
  }
  return { ok: true, digits: trimmed }
}

/** Indian-style mobile: 10 digits, starting with 6–9 (optional strictness). */
export function validateIndianMobile(
  value: string,
  fieldLabel: string
): { ok: true; digits: string } | { ok: false; message: string } {
  const digits = sanitizePhoneInput(value, 15)
  if (!digits) {
    return { ok: false, message: `${fieldLabel} is required` }
  }
  if (digits.length < 10) {
    return { ok: false, message: `${fieldLabel} must be at least 10 digits` }
  }
  if (digits.length > 15) {
    return { ok: false, message: `${fieldLabel} must be at most 15 digits` }
  }
  return { ok: true, digits }
}
