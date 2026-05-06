const { normalizeProductTerm } = require('./productTerm');

const SNAPSHOT_STATUSES = new Set(['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested']);

/**
 * Map main deal `products[]` into `updateHistory[].productsInterested` shape.
 */
function dealProductsToFollowUpSnapshot(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && (row.product_name || row.product))
    .map((row) => {
      let status = row.status;
      if (status === 'Management Not Met') status = 'Not Met Management';
      if (!SNAPSHOT_STATUSES.has(status)) status = 'Warm';
      return {
        product_name: String(row.product_name || row.product || '').trim(),
        term: normalizeProductTerm(row.term),
        status,
        strength: Number(row.strength) || 0,
        chance: Math.max(0, Math.min(100, Number(row.chance) || 0)),
      };
    });
}

module.exports = { dealProductsToFollowUpSnapshot };
