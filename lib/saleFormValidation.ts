/** Shared Create Sale field validation (frontend). Keep in sync with backend/utils/saleFieldValidation.js */

const SCHOOL_NAME_ALLOWED = /^[A-Za-z0-9 .,'&()\-]+$/
const SCHOOL_NAME_CONSECUTIVE_SPECIAL = /[.,'&()\-]{2,}/
const CONTACT_PERSON_ALLOWED = /^[A-Za-z .'\-]+$/
const SCHOOL_CODE_ALLOWED = /^[A-Za-z0-9_-]+$/
const MOBILE_DIGITS = /^\d{10}$/

export type FieldValidationResult = { ok: true; value: string } | { ok: false; message: string }

export function validateSchoolName(raw: string): FieldValidationResult {
  const value = String(raw || '').trim()
  if (!value) {
    return { ok: false, message: 'School Name is required' }
  }
  if (value.length > 100) {
    return { ok: false, message: 'School name contains invalid characters.' }
  }
  if (!SCHOOL_NAME_ALLOWED.test(value) || SCHOOL_NAME_CONSECUTIVE_SPECIAL.test(value)) {
    return { ok: false, message: 'School name contains invalid characters.' }
  }
  if (!/[A-Za-z0-9]/.test(value)) {
    return { ok: false, message: 'School name contains invalid characters.' }
  }
  return { ok: true, value }
}

export function validateContactPerson(
  raw: string,
  options: { required?: boolean; label?: string } = {}
): FieldValidationResult {
  const { required = false, label = 'Contact person' } = options
  const value = String(raw || '').trim()
  if (!value) {
    if (required) return { ok: false, message: `${label} is required` }
    return { ok: true, value: '' }
  }
  if (!CONTACT_PERSON_ALLOWED.test(value)) {
    return { ok: false, message: `${label} contains invalid characters.` }
  }
  return { ok: true, value }
}

export function validateContactMobile(
  raw: string,
  options: { required?: boolean } = {}
): FieldValidationResult {
  const { required = true } = options
  const trimmed = String(raw || '').trim()
  if (!trimmed) {
    if (required) return { ok: false, message: 'Enter a valid 10-digit mobile number.' }
    return { ok: true, value: '' }
  }
  if (/\D/.test(trimmed) || !MOBILE_DIGITS.test(trimmed)) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' }
  }
  return { ok: true, value: trimmed }
}

/** Sanitize mobile as the user types: digits only, max 10. */
export function sanitizeMobileInput(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 10)
}

export function validateSchoolCode(raw: string): FieldValidationResult {
  const value = String(raw || '').trim()
  if (!value) {
    return { ok: false, message: 'School Code is required' }
  }
  if (!SCHOOL_CODE_ALLOWED.test(value)) {
    return { ok: false, message: 'School code contains invalid characters.' }
  }
  return { ok: true, value }
}

export type ProductNumericErrors = {
  price?: string
  quantity?: string
  strength?: string
}

/** Validate one selected product's price / quantity / strength. */
export function validateSelectedProductFields(product: {
  price?: number | string | null
  quantity?: number | string | null
  strength?: number | string | null
}): ProductNumericErrors {
  const errors: ProductNumericErrors = {}
  const price = Number(product.price)
  const quantity = Number(product.quantity)
  const strength = Number(product.strength)

  if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Unit Price must be greater than 0.'
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
    errors.quantity = 'Quantity must be greater than 0.'
  }
  if (!Number.isFinite(strength) || !Number.isInteger(strength) || strength <= 0) {
    errors.strength = 'Strength must be greater than 0.'
  }
  return errors
}
