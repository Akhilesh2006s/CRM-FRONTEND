function normalizeName(name) {
  return (name || '').trim().replace(/\s+/g, ' ');
}

function normalizeNameLower(name) {
  return normalizeName(name).toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { normalizeName, normalizeNameLower, escapeRegex };
