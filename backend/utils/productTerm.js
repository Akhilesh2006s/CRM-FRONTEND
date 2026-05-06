const ALLOWED_PRODUCT_TERMS = ['Term 1', 'Term 2', 'Both'];

/**
 * Maps UI / legacy values (e.g. "Term1", "term_2") to DcOrder / Lead enum values.
 */
function normalizeProductTerm(term) {
  if (term == null || term === '') return 'Term 1';
  const t = String(term).trim();
  if (ALLOWED_PRODUCT_TERMS.includes(t)) return t;
  const collapsed = t.toLowerCase().replace(/[\s_-]+/g, '');
  if (collapsed === 'term1' || collapsed === 't1') return 'Term 1';
  if (collapsed === 'term2' || collapsed === 't2') return 'Term 2';
  if (collapsed === 'both') return 'Both';
  return 'Term 1';
}

function normalizeDcOrderProductTermsInArray(products) {
  if (!Array.isArray(products)) return products;
  return products.map((p) => {
    if (!p || typeof p !== 'object') return p;
    return { ...p, term: normalizeProductTerm(p.term) };
  });
}

module.exports = {
  ALLOWED_PRODUCT_TERMS,
  normalizeProductTerm,
  normalizeDcOrderProductTermsInArray,
};
