/**
 * Aggregate executive "lead status" from follow-up product rows (Hot wins over weaker states).
 */
function derivePriorityFromFollowUpProducts(rows = []) {
  const order = ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'];
  let best = '';
  let bestIdx = order.length;
  for (const row of rows) {
    const st = row.status ? String(row.status).trim() : '';
    const i = order.indexOf(st);
    if (i !== -1 && i < bestIdx) {
      bestIdx = i;
      best = st;
    }
  }
  return best || null;
}

module.exports = { derivePriorityFromFollowUpProducts };
