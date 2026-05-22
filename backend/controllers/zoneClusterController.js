const Zone = require('../models/Zone');
const Cluster = require('../models/Cluster');
const ZoneCluster = require('../models/ZoneCluster');
const { normalizeName, normalizeNameLower } = require('../utils/normalizeName');

const listZoneClusters = async (req, res) => {
  try {
    const pairs = await ZoneCluster.find()
      .populate('zoneId', 'name')
      .populate('clusterId', 'name')
      .sort({ createdAt: -1 });

    res.json(
      pairs.map((p) => ({
        _id: p._id,
        zone: p.zoneId?.name || '',
        cluster: p.clusterId?.name || '',
        zoneId: p.zoneId?._id,
        clusterId: p.clusterId?._id,
      }))
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createZoneCluster = async (req, res) => {
  try {
    let zoneId = req.body.zoneId;
    let clusterId = req.body.clusterId;
    const zoneName = normalizeName(req.body.zone);
    const clusterName = normalizeName(req.body.cluster);

    if (!zoneId && zoneName) {
      const z = await Zone.findOne({ nameLower: normalizeNameLower(zoneName) });
      if (!z) return res.status(400).json({ message: `Zone "${zoneName}" not found` });
      zoneId = z._id;
    }
    if (!clusterId && clusterName) {
      const c = await Cluster.findOne({ nameLower: normalizeNameLower(clusterName) });
      if (!c) return res.status(400).json({ message: `Cluster "${clusterName}" not found` });
      clusterId = c._id;
    }

    if (!zoneId || !clusterId) {
      return res.status(400).json({ message: 'Zone and cluster are required' });
    }

    const existing = await ZoneCluster.findOne({ zoneId, clusterId });
    if (existing) return res.status(400).json({ message: 'This zone–cluster link already exists' });

    const pair = await ZoneCluster.create({ zoneId, clusterId });
    const populated = await ZoneCluster.findById(pair._id)
      .populate('zoneId', 'name')
      .populate('clusterId', 'name');

    res.status(201).json({
      _id: populated._id,
      zone: populated.zoneId?.name,
      cluster: populated.clusterId?.name,
      zoneId: populated.zoneId?._id,
      clusterId: populated.clusterId?._id,
    });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'This zone–cluster link already exists' });
    res.status(500).json({ message: e.message });
  }
};

const deleteZoneCluster = async (req, res) => {
  try {
    const pair = await ZoneCluster.findByIdAndDelete(req.params.id);
    if (!pair) return res.status(404).json({ message: 'Zone–cluster link not found' });
    res.json({ message: 'Link removed' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { listZoneClusters, createZoneCluster, deleteZoneCluster };
