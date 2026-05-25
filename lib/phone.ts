/** Strip non-digits and cap length for phone/mobile fields. */
export function sanitizePhoneInput(value: string, maxDigits = 15): string {
  return String(value || '').replace(/\D/g, '').slice(0, maxDigits)
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
