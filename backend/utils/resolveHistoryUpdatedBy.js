const mongoose = require('mongoose');
const User = require('../models/User');

function formatUserDisplayName(user) {
  if (!user) return null;
  if (typeof user === 'string') return null;
  const name = String(user.name || '').trim();
  if (name) return name;
  const combined = [user.firstName, user.lastName]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
  if (combined) return combined;
  const email = String(user.email || '').trim();
  return email || null;
}

function resolveHistoryUpdatedByForResponse(entry = {}, doc = {}) {
  const direct = formatUserDisplayName(entry.updatedBy);
  if (direct) {
    return {
      name: direct,
      _id: entry.updatedBy?._id || entry.updatedBy || null,
    };
  }

  const assigned = formatUserDisplayName(doc.assigned_to);
  if (assigned) {
    return { name: assigned, _id: doc.assigned_to?._id || doc.assigned_to || null };
  }

  const created = formatUserDisplayName(doc.created_by);
  if (created) {
    return { name: created, _id: doc.created_by?._id || doc.created_by || null };
  }

  return { name: 'Unknown', _id: null };
}

async function attachResolvedUpdatedByToHistory(history = [], doc = {}) {
  if (!Array.isArray(history) || history.length === 0) return history;

  const missingIds = new Set();
  for (const entry of history) {
    if (formatUserDisplayName(entry.updatedBy)) continue;
    const rawId = entry.updatedBy?._id || entry.updatedBy;
    if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
      missingIds.add(String(rawId));
    }
  }

  let usersById = {};
  if (missingIds.size > 0) {
    const users = await User.find({ _id: { $in: [...missingIds] } })
      .select('name email firstName lastName')
      .lean();
    usersById = Object.fromEntries(users.map((u) => [String(u._id), u]));
  }

  return history.map((entry) => {
    let entryForResolve = entry;
    if (!formatUserDisplayName(entry.updatedBy)) {
      const rawId = entry.updatedBy?._id || entry.updatedBy;
      const id = rawId && mongoose.Types.ObjectId.isValid(rawId) ? String(rawId) : null;
      if (id && usersById[id]) {
        entryForResolve = { ...entry, updatedBy: usersById[id] };
      }
    }
    return {
      ...entry,
      updatedBy: resolveHistoryUpdatedByForResponse(entryForResolve, doc),
    };
  });
}

module.exports = {
  formatUserDisplayName,
  resolveHistoryUpdatedByForResponse,
  attachResolvedUpdatedByToHistory,
};
