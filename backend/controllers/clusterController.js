const Cluster = require('../models/Cluster');
const Zone = require('../models/Zone');
const ZoneCluster = require('../models/ZoneCluster');
const { normalizeName, normalizeNameLower, escapeRegex } = require('../utils/normalizeName');

// Get all active clusters (optional ?zoneId=)
const getClusters = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.zoneId) {
      filter.zoneId = req.query.zoneId;
    }
    const clusters = await Cluster.find(filter)
      .populate('zoneId', 'name managerId')
      .sort({ name: 1 });
    res.json(clusters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

async function ensureZoneClusterLink(zone, cluster) {
  if (!zone || !cluster) return;
  const existing = await ZoneCluster.findOne({
    zone: zone.name,
    cluster: cluster.name,
  });
  if (!existing) {
    await ZoneCluster.create({
      zone: zone.name,
      cluster: cluster.name,
      isActive: true,
    });
  } else if (!existing.isActive) {
    existing.isActive = true;
    await existing.save();
  }
}

// Create or update a cluster (prefer zoneId on create)
const upsertCluster = async (req, res) => {
  try {
    const { id, name: rawName, isActive = true, zoneId } = req.body;
    const name = normalizeName(rawName);

    if (!name) {
      return res.status(400).json({ message: 'Cluster name is required' });
    }

    const nameLower = normalizeNameLower(name);

    let zone = null;
    if (zoneId) {
      zone = await Zone.findById(zoneId);
      if (!zone) {
        return res.status(400).json({ message: 'Invalid zone' });
      }
    }

    if (id) {
      const update = { name, nameLower, isActive };
      if (zoneId !== undefined) {
        update.zoneId = zoneId || null;
      }

      const dupFilter = {
        _id: { $ne: id },
        nameLower,
      };
      if (update.zoneId) {
        dupFilter.zoneId = update.zoneId;
      }
      const duplicate = await Cluster.findOne(dupFilter);
      if (duplicate) {
        return res.status(400).json({ message: 'Cluster already exists in this zone' });
      }

      const cluster = await Cluster.findByIdAndUpdate(id, update, {
        new: true,
        upsert: false,
      }).populate('zoneId', 'name managerId');

      if (zone && cluster) {
        await ensureZoneClusterLink(zone, cluster);
      }

      return res.status(200).json(cluster);
    }

    // New cluster should be assigned to a zone (Module 1 Step 2)
    if (!zoneId) {
      return res.status(400).json({ message: 'zoneId is required when creating a cluster' });
    }

    const existing = await Cluster.findOne({
      zoneId,
      $or: [
        { nameLower },
        { name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } },
      ],
    });
    if (existing) {
      return res.status(400).json({ message: 'Cluster already exists in this zone' });
    }

    const cluster = await Cluster.create({
      name,
      nameLower,
      zoneId,
      isActive,
    });

    await ensureZoneClusterLink(zone, cluster);

    const populated = await Cluster.findById(cluster._id).populate('zoneId', 'name managerId');
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Cluster already exists in this zone' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Delete a cluster
const deleteCluster = async (req, res) => {
  try {
    const cluster = await Cluster.findByIdAndDelete(req.params.id);
    if (!cluster) {
      return res.status(404).json({ message: 'Cluster not found' });
    }
    if (cluster.name) {
      await ZoneCluster.deleteMany({ cluster: cluster.name });
    }
    res.json({ message: 'Cluster deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getClusters,
  upsertCluster,
  deleteCluster,
};
