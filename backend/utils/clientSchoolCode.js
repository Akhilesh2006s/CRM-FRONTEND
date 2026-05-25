const { generateSchoolCode } = require('./schoolCodeGenerator');

/** Prefer permanent school_code; dc_code is legacy fallback only. */
function displayClientSchoolCode(record) {
  if (!record) return '';
  return String(record.school_code || record.dc_code || '').trim();
}

/**
 * Generate a school_code when missing (region/city from record or overrides).
 * @returns {Promise<string>}
 */
async function ensureSchoolCode(record, overrides = {}) {
  const existing = String(record?.school_code || '').trim();
  if (existing) return existing;

  try {
    const code = await generateSchoolCode({
      region: overrides.region ?? record?.region ?? '',
      city: overrides.city ?? record?.city ?? '',
    });
    return code || '';
  } catch (err) {
    console.warn('ensureSchoolCode failed:', err.message);
    return '';
  }
}

/** Close-lead / client conversion: commercial products, POD, or saved/completed status. */
function isClientConversionUpdate(body = {}, item = {}) {
  if (body.pod_proof_url) return true;
  if (['saved', 'completed'].includes(String(body.status || '').toLowerCase())) return true;

  if (Array.isArray(body.products) && body.products.length > 0) {
    return body.products.some((row) => {
      if (!row) return false;
      const hasLeadStatus =
        row.status !== undefined && row.status !== null && String(row.status).trim() !== '';
      const hasLeadChance =
        row.chance !== undefined && row.chance !== null && String(row.chance).trim() !== '';
      if (hasLeadStatus || hasLeadChance) return false;
      const qty = Number(row.quantity) || Number(row.strength) || 0;
      const unitPrice = Number(row.unit_price) || 0;
      return qty > 0 && unitPrice > 0;
    });
  }

  if (!item.school_code && item.products?.length > 0) {
    return item.products.some((row) => {
      const qty = Number(row?.quantity) || Number(row?.strength) || 0;
      const unitPrice = Number(row?.unit_price) || 0;
      return qty > 0 && unitPrice > 0;
    });
  }

  return false;
}

module.exports = {
  displayClientSchoolCode,
  ensureSchoolCode,
  isClientConversionUpdate,
};
