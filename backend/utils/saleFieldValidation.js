/**
 * Create Sale / DcOrder field validation.
 * Keep in sync with lib/saleFormValidation.ts
 */

const SCHOOL_NAME_ALLOWED = /^[A-Za-z0-9 .,'&()\-]+$/;
const SCHOOL_NAME_CONSECUTIVE_SPECIAL = /[.,'&()\-]{2,}/;
const CONTACT_PERSON_ALLOWED = /^[A-Za-z .'\-]+$/;
const SCHOOL_CODE_ALLOWED = /^[A-Za-z0-9_-]+$/;
const MOBILE_DIGITS = /^\d{10}$/;

function validateSchoolName(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return { ok: false, message: 'School Name is required' };
  }
  if (value.length > 100) {
    return { ok: false, message: 'School name contains invalid characters.' };
  }
  if (!SCHOOL_NAME_ALLOWED.test(value) || SCHOOL_NAME_CONSECUTIVE_SPECIAL.test(value)) {
    return { ok: false, message: 'School name contains invalid characters.' };
  }
  if (!/[A-Za-z0-9]/.test(value)) {
    return { ok: false, message: 'School name contains invalid characters.' };
  }
  return { ok: true, value };
}

function validateContactPerson(raw, { required = false, label = 'Contact person' } = {}) {
  const value = String(raw || '').trim();
  if (!value) {
    if (required) return { ok: false, message: `${label} is required` };
    return { ok: true, value: '' };
  }
  if (!CONTACT_PERSON_ALLOWED.test(value)) {
    return { ok: false, message: `${label} contains invalid characters.` };
  }
  return { ok: true, value };
}

function validateContactMobile(raw, { required = true } = {}) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    if (required) return { ok: false, message: 'Enter a valid 10-digit mobile number.' };
    return { ok: true, value: '' };
  }
  if (/\D/.test(trimmed) || !MOBILE_DIGITS.test(trimmed)) {
    return { ok: false, message: 'Enter a valid 10-digit mobile number.' };
  }
  return { ok: true, value: trimmed };
}

function validateSchoolCode(raw, { required = true } = {}) {
  const value = String(raw || '').trim();
  if (!value) {
    if (required) return { ok: false, message: 'School Code is required' };
    return { ok: true, value: '' };
  }
  if (!SCHOOL_CODE_ALLOWED.test(value)) {
    return { ok: false, message: 'School code contains invalid characters.' };
  }
  return { ok: true, value };
}

/**
 * Validate products on Create Sale / DcOrder create.
 * Every product in the array is treated as selected.
 */
function validateSaleProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { ok: false, message: 'Please select at least one product.' };
  }

  for (let i = 0; i < products.length; i++) {
    const row = products[i] || {};
    const name = String(row.product_name || row.product || row.name || `Product ${i + 1}`).trim();
    const status = String(row.status || '').trim();
    const price = Number(row.unit_price ?? row.price);
    const quantity = Number(row.quantity);
    // Close Lead class-wise rows often store class strength on `quantity` and may omit `strength`.
    // Prefer explicit strength when present; otherwise fall back to quantity.
    const hasExplicitStrength =
      row.strength !== undefined && row.strength !== null && row.strength !== '';
    const strength = Number(hasExplicitStrength ? row.strength : row.quantity);

    // Module 2: Not Interested — reason required; skip price/strength rules
    if (status === 'Not Interested') {
      if (!String(row.not_interested_reason || '').trim()) {
        return {
          ok: false,
          message: `${name}: Please enter a reason why the school is not interested.`,
        };
      }
      continue;
    }

    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        message: `${name}: Unit Price must be greater than 0.`,
      };
    }
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        message: `${name}: Quantity must be greater than 0.`,
      };
    }
    // Strength required only for Hot / Warm (Module 2)
    if (status === 'Hot' || status === 'Warm') {
      if (!Number.isFinite(strength) || !Number.isInteger(strength) || strength <= 0) {
        return {
          ok: false,
          message: `${name}: Strength must be greater than 0.`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Validate and normalize Create Sale / DcOrder identity fields.
 * Returns { ok: true, fields } or { ok: false, message }.
 */
function validateSaleIdentityFields(body = {}) {
  const schoolName = validateSchoolName(body.school_name);
  if (!schoolName.ok) return schoolName;

  const schoolCodeRaw =
    body.school_code !== undefined && body.school_code !== null
      ? String(body.school_code).trim()
      : '';
  const schoolCode = validateSchoolCode(schoolCodeRaw, { required: false });
  if (!schoolCode.ok) return schoolCode;

  const contactPerson = validateContactPerson(body.contact_person, {
    required: true,
    label: 'Contact person',
  });
  if (!contactPerson.ok) return contactPerson;

  const contactMobile = validateContactMobile(body.contact_mobile, { required: true });
  if (!contactMobile.ok) return contactMobile;

  const contactPerson2 = validateContactPerson(body.contact_person2, {
    required: true,
    label: 'Contact Person 2',
  });
  if (!contactPerson2.ok) return contactPerson2;

  const contactMobile2 = validateContactMobile(body.contact_mobile2, { required: true });
  if (!contactMobile2.ok) return contactMobile2;

  return {
    ok: true,
    fields: {
      school_name: schoolName.value,
      school_code: schoolCodeRaw ? schoolCode.value : undefined,
      contact_person: contactPerson.value,
      contact_mobile: contactMobile.value,
      contact_person2: contactPerson2.value,
      contact_mobile2: contactMobile2.value,
    },
  };
}

module.exports = {
  validateSchoolName,
  validateContactPerson,
  validateContactMobile,
  validateSchoolCode,
  validateSaleProducts,
  validateSaleIdentityFields,
};
