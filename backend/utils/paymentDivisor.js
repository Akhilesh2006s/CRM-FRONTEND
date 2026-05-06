/**
 * Payment divisor rules: (sum participation × unit price) ÷ divisor
 * divisor from product.calculationType and distinct levels/subjects in rows.
 */

const roundToTwo = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const ALLOWED_CALC = new Set(['normal', 'none', 'level_based', 'subject_based']);

const normalizeCalculationType = (t) => {
  const v = String(t || 'normal').toLowerCase();
  if (!ALLOWED_CALC.has(v)) return 'normal';
  return v === 'none' ? 'normal' : v;
};

const normalizeLevel = (level) =>
  String(level || '').trim().toLowerCase().replace(/\s+/g, '');

const normalizeSubject = (subject) =>
  String(subject || '').trim().toLowerCase();

/**
 * @param {object} opts
 * @param {string} opts.calculationType - normal | level_based | subject_based
 * @param {Array<{ strength?: number, level?: string, subject?: string }>} opts.rows
 * @param {number} [opts.catalogFallbackCount] - e.g. productLevels.length or subjects.length
 */
const resolveDivisor = ({
  calculationType,
  rows = [],
  catalogFallbackCount = 0,
}) => {
  const ct = normalizeCalculationType(calculationType);
  if (ct === 'normal') return 1;

  const activeRows = rows.filter((r) => (Number(r.strength) || 0) > 0);

  if (ct === 'level_based') {
    const levels = new Set();
    activeRows.forEach((r) => {
      const n = normalizeLevel(r.level);
      if (n) levels.add(n);
    });
    let d = levels.size;
    if (d === 0 && catalogFallbackCount > 0) d = Number(catalogFallbackCount) || 0;
    return Math.max(1, d);
  }

  if (ct === 'subject_based') {
    const subjects = new Set();
    activeRows.forEach((r) => {
      const n = normalizeSubject(r.subject);
      if (n) subjects.add(n);
    });
    let d = subjects.size;
    if (d === 0 && catalogFallbackCount > 0) d = Number(catalogFallbackCount) || 0;
    return Math.max(1, d);
  }

  return 1;
};

/**
 * Normal: sum of (strength × price) per row when prices may differ.
 * level_based / subject_based: (sumStrength × unitPrice) ÷ divisor using rows for divisor.
 */
const computeBucketAmount = ({
  calculationType,
  rows = [],
  unitPrice,
  catalogFallbackCount = 0,
}) => {
  const ct = normalizeCalculationType(calculationType);
  const price = Number(unitPrice) || 0;

  if (ct === 'normal') {
    const sum = rows.reduce((s, r) => {
      const st = Number(r.strength) || 0;
      const pr = Number(r.price !== undefined ? r.price : unitPrice) || 0;
      return s + st * pr;
    }, 0);
    return roundToTwo(sum);
  }

  const sumStrength = rows.reduce(
    (s, r) => s + (Number(r.strength) || 0),
    0
  );
  const divisor = resolveDivisor({
    calculationType: ct,
    rows,
    catalogFallbackCount,
  });
  return roundToTwo((sumStrength * price) / divisor);
};

/**
 * Group rows by product+class key for billing buckets.
 */
const bucketKey = (row) =>
  `${String(row.product || row.product_name || '').trim()}::${String(row.class || '').trim()}`;

module.exports = {
  roundToTwo,
  normalizeCalculationType,
  resolveDivisor,
  computeBucketAmount,
  bucketKey,
};
