/** Shared frontend validation for Employee Create / Edit forms. */

export const EMPLOYEE_NAME_REGEX = /^[A-Za-z ]+$/
export const EMPLOYEE_CODE_REGEX = /^[A-Za-z0-9_-]+$/

export type FieldValidation =
  | { ok: true; value: string }
  | { ok: false; message: string }

/** First Name: required; letters and spaces only. */
export function validateEmployeeFirstName(value: string): FieldValidation {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'First Name is required.' }
  }
  if (!EMPLOYEE_NAME_REGEX.test(trimmed)) {
    return {
      ok: false,
      message: 'First Name may only contain letters and spaces.',
    }
  }
  return { ok: true, value: trimmed }
}

/**
 * Last Name: optional when empty; if provided, letters and spaces only.
 */
export function validateEmployeeLastName(value: string): FieldValidation {
  const raw = String(value || '')
  const trimmed = raw.trim()
  if (!trimmed) {
    return { ok: true, value: '' }
  }
  if (!EMPLOYEE_NAME_REGEX.test(trimmed)) {
    return {
      ok: false,
      message: 'Last Name may only contain letters and spaces.',
    }
  }
  return { ok: true, value: trimmed }
}

/** Emp ID / Code: required; letters, numbers, underscore, hyphen; no spaces. */
export function validateEmployeeCode(value: string): FieldValidation {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'Emp ID / Code is required.' }
  }
  if (/\s/.test(trimmed) || !EMPLOYEE_CODE_REGEX.test(trimmed)) {
    return {
      ok: false,
      message: 'Emp ID / Code may only contain letters, numbers, underscore (_) and hyphen (-). No spaces.',
    }
  }
  return { ok: true, value: trimmed }
}

export type EmployeeIdentityFields = {
  firstName: string
  lastName: string
  empCode: string
}

export type EmployeeIdentityErrors = {
  firstName?: string
  lastName?: string
  empCode?: string
}

/** Validate identity fields; returns field errors (empty object if all ok). */
export function validateEmployeeIdentityFields(
  fields: EmployeeIdentityFields
): { ok: true; values: EmployeeIdentityFields } | { ok: false; errors: EmployeeIdentityErrors } {
  const errors: EmployeeIdentityErrors = {}
  const first = validateEmployeeFirstName(fields.firstName)
  if (!first.ok) errors.firstName = first.message
  const last = validateEmployeeLastName(fields.lastName)
  if (!last.ok) errors.lastName = last.message
  const code = validateEmployeeCode(fields.empCode)
  if (!code.ok) errors.empCode = code.message

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    values: {
      firstName: first.ok ? first.value : fields.firstName,
      lastName: last.ok ? last.value : fields.lastName,
      empCode: code.ok ? code.value : fields.empCode,
    },
  }
}
