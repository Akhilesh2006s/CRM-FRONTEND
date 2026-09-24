const Zone = require('../models/Zone');
const Cluster = require('../models/Cluster');
const User = require('../models/User');
const { normalizeName, normalizeNameLower, escapeRegex } = require('../utils/normalizeName');

async function findExistingZoneByName(name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const lower = normalizeNameLower(normalized);
  return Zone.findOne({
    $or: [
      { nameLower: lower },
      { name: { $regex: `^${escapeRegex(normalized)}$`, $options: 'i' } },
    ],
  });
}

function populateManager(query) {
  return query.populate('managerId', 'name email role mobile phone');
}

// Get all active zones (with manager)
const getZones = async (req, res) => {
  try {
    const zones = await populateManager(Zone.find({ isActive: true })).sort({ name: 1 });
    const seen = new Set();
    const deduped = [];
    for (const zone of zones) {
      const key = normalizeNameLower(zone.nameLower || zone.name);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(zone);
    }
    res.json(deduped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get clusters for a zone
const getZoneClusters = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    const clusters = await Cluster.find({
      isActive: true,
      zoneId: zone._id,
    }).sort({ name: 1 });

    res.json(clusters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create or update a zone
const upsertZone = async (req, res) => {
  try {
    const { id, name: rawName, isActive = true, managerId } = req.body;
    const name = normalizeName(rawName);

    if (!name) {
      return res.status(400).json({ message: 'Zone name is required' });
    }

    const nameLower = normalizeNameLower(name);

    let resolvedManagerId = managerId === '' || managerId === undefined ? undefined : managerId;
    if (resolvedManagerId === null) {
      resolvedManagerId = null;
    }
    if (resolvedManagerId) {
      const manager = await User.findById(resolvedManagerId).select('role isActive');
      if (!manager || !manager.isActive) {
        return res.status(400).json({ message: 'Manager not found or inactive' });
      }
      const allowed = ['Executive Manager', 'Manager', 'Admin', 'Super Admin'];
      if (!allowed.includes(manager.role)) {
        return res.status(400).json({
          message: 'Zone manager must be an Executive Manager or Manager',
        });
      }
    }

    if (id) {
      const duplicate = await Zone.findOne({
        _id: { $ne: id },
        $or: [
          { nameLower },
          { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
        ],
      });
      if (duplicate) {
        return res.status(400).json({ message: 'Zone already exists' });
      }

      const update = { name, nameLower, isActive };
      if (resolvedManagerId !== undefined) {
        update.managerId = resolvedManagerId;
      }

      const zone = await populateManager(
        Zone.findByIdAndUpdate(id, update, { new: true, upsert: false })
      );
      return res.status(200).json(zone);
    }

    const existing = await findExistingZoneByName(name);
    if (existing) {
      return res.status(400).json({ message: 'Zone already exists' });
    }

    const zone = await Zone.create({
      name,
      nameLower,
      isActive,
      managerId: resolvedManagerId || null,
    });

    const populated = await populateManager(Zone.findById(zone._id));
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Zone already exists' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Delete a zone
const deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) {
      return res.status(404).json({ message: 'Zone not found' });
    }
    // Detach clusters from this zone (keep cluster docs)
    await Cluster.updateMany({ zoneId: zone._id }, { $set: { zoneId: null } });
    res.json({ message: 'Zone deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getZones,
  getZoneClusters,
  upsertZone,
  deleteZone,
};
