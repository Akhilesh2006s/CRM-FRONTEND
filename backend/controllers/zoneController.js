const Zone = require('../models/Zone');
const ZoneCluster = require('../models/ZoneCluster');
const PincodeMapping = require('../models/PincodeMapping');
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

const listZones = async (req, res) => {
  try {
    const zones = await Zone.find().sort({ name: 1 });
    const seen = new Set();
    const deduped = [];
    for (const zone of zones) {
      const key = normalizeNameLower(zone.nameLower || zone.name);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(zone);
    }
    res.json(deduped);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createZone = async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: 'Zone is required' });

    const existing = await findExistingZoneByName(name);
    if (existing) return res.status(400).json({ message: 'Zone already exists' });

    const zone = await Zone.create({ name, nameLower: normalizeNameLower(name) });
    res.status(201).json(zone);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Zone already exists' });
    res.status(500).json({ message: e.message });
  }
};

const deleteZone = async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) return res.status(404).json({ message: 'Zone not found' });

    const inPairs = await ZoneCluster.countDocuments({ zoneId: zone._id });
    if (inPairs > 0) {
      return res.status(400).json({ message: 'Cannot delete zone: linked to clusters. Remove zone–cluster links first.' });
    }

    const inPincode = await PincodeMapping.countDocuments({ zoneId: zone._id });
    if (inPincode > 0) {
      return res.status(400).json({ message: 'Cannot delete zone: used in pincode mappings.' });
    }

    const inUsers = await User.countDocuments({ zone: zone.name });
    if (inUsers > 0) {
      return res.status(400).json({ message: 'Cannot delete zone: assigned to employees.' });
    }

    await Zone.findByIdAndDelete(req.params.id);
    res.json({ message: 'Zone deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { listZones, createZone, deleteZone };
