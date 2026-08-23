/** Shared frontend validation for Add / Edit Trainer forms. */

export const TRAINER_MOBILE_REGEX = /^[0-9]{10,15}$/

/** Practical email check: local@domain.tld (rejects abc@, abc@gmail, @@, etc.). */
export const TRAINER_EMAIL_REGEX =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

export type FieldValidation =
  | { ok: true; value: string }
  | { ok: false; message: string }

/** Digits only, capped at 15 (for controlled mobile input). */
export function sanitizeTrainerMobileInput(value: string): string {
  return String(value || '').replace(/\D/g, '').slice(0, 15)
}

/** Mobile: required; digits only; length 10–15. */
export function validateTrainerMobile(value: string): FieldValidation {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'Mobile number is required.' }
  }
  if (/\D/.test(trimmed) || !TRAINER_MOBILE_REGEX.test(trimmed)) {
    return {
      ok: false,
      message: 'Mobile must be 10–15 digits only (no letters, spaces, or special characters).',
    }
  }
  return { ok: true, value: trimmed }
}

/** Email: required; valid format. */
export function validateTrainerEmail(value: string): FieldValidation {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'Email is required.' }
  }
  if (!TRAINER_EMAIL_REGEX.test(trimmed)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  return { ok: true, value: trimmed }
}

/** Zone: required selection. */
export function validateTrainerZone(value: string): FieldValidation {
  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return { ok: false, message: 'Zone is required. Please select a zone.' }
  }
  return { ok: true, value: trimmed }
}

export type TrainerContactFields = {
  mobile: string
  email: string
  zone: string
}

export type TrainerContactErrors = {
  mobile?: string
  email?: string
  zone?: string
}

export function validateTrainerContactFields(
  fields: TrainerContactFields
):
  | { ok: true; values: TrainerContactFields }
  | { ok: false; errors: TrainerContactErrors } {
  const errors: TrainerContactErrors = {}
  const mobile = validateTrainerMobile(fields.mobile)
  if (!mobile.ok) errors.mobile = mobile.message
  const email = validateTrainerEmail(fields.email)
  if (!email.ok) errors.email = email.message
  const zone = validateTrainerZone(fields.zone)
  if (!zone.ok) errors.zone = zone.message

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }
  return {
    ok: true,
    values: {
      mobile: mobile.ok ? mobile.value : fields.mobile,
      email: email.ok ? email.value : fields.email,
      zone: zone.ok ? zone.value : fields.zone,
    },
  }
}
