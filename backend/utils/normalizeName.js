function normalizeName(name) {
  return (name || '').trim();
}

function normalizeNameLower(name) {
  return normalizeName(name).toLowerCase();
}

module.exports = { normalizeName, normalizeNameLower };
