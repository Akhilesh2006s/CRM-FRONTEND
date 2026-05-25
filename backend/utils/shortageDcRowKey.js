const STUDENT_ENROLLMENT_CATEGORIES = new Set([
  'new students',
  'existing students',
  'both',
  'new school',
  'existing school',
  'shortage',
]);

function normalizeProductForKey(name = '') {
  let s = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (s.startsWith('vedh')) {
    s = `vedic${s.slice(4)}`;
  }
  return s.replace(/maths$/, 'math');
}

function skuPart(row = {}) {
  const pc = String(row.productCategory || '').trim().toLowerCase();
  if (pc && !STUDENT_ENROLLMENT_CATEGORIES.has(pc)) return pc;
  const specs = String(row.specs || '').trim().toLowerCase();
  if (specs && specs !== 'regular') return specs;
  return '';
}

function getShortageParentMatchKey(row = {}) {
  const product = normalizeProductForKey(row.product || row.productName || '');
  const cls = String(row.class || '').trim().toLowerCase();
  const term = String(row.term || 'Term 1').trim().toLowerCase();
  const sku = skuPart(row);
  return sku ? `${product}::${cls}::${term}::${sku}` : `${product}::${cls}::${term}`;
}

function getShortageParentBaseKey(row = {}) {
  const product = normalizeProductForKey(row.product || row.productName || '');
  const cls = String(row.class || '').trim().toLowerCase();
  const term = String(row.term || 'Term 1').trim().toLowerCase();
  return `${product}::${cls}::${term}`;
}

function findParentRowForShortage(parentDetails = [], shortageRow = {}) {
  const rows = Array.isArray(parentDetails) ? parentDetails : [];
  const fullKey = getShortageParentMatchKey(shortageRow);
  const exact = rows.find((p) => getShortageParentMatchKey(p) === fullKey);
  if (exact) return exact;

  const baseKey = getShortageParentBaseKey(shortageRow);
  const candidates = rows.filter((p) => getShortageParentBaseKey(p) === baseKey);
  if (candidates.length === 1) return candidates[0];

  const rawProduct = String(shortageRow.product || shortageRow.productName || '').trim().toLowerCase();
  if (rawProduct) {
    const byLabel = candidates.find((p) => {
      const label = String(p.product || p.productName || '').trim().toLowerCase();
      return label === rawProduct;
    });
    if (byLabel) return byLabel;
  }

  return null;
}

module.exports = {
  normalizeProductForKey,
  getShortageParentMatchKey,
  getShortageParentBaseKey,
  findParentRowForShortage,
};
