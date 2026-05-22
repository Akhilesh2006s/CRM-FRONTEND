const Cluster = require('../models/Cluster');
const ZoneCluster = require('../models/ZoneCluster');
const PincodeMapping = require('../models/PincodeMapping');
const User = require('../models/User');
const { normalizeName, normalizeNameLower } = require('../utils/normalizeName');

const listClusters = async (req, res) => {
  try {
    const clusters = await Cluster.find().sort({ name: 1 });
    res.json(clusters);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createCluster = async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: 'Cluster is required' });

    const existing = await Cluster.findOne({ nameLower: normalizeNameLower(name) });
    if (existing) return res.status(400).json({ message: 'Cluster already exists' });

    const cluster = await Cluster.create({ name, nameLower: normalizeNameLower(name) });
    res.status(201).json(cluster);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Cluster already exists' });
    res.status(500).json({ message: e.message });
  }
};

const deleteCluster = async (req, res) => {
  try {
    const cluster = await Cluster.findById(req.params.id);
    if (!cluster) return res.status(404).json({ message: 'Cluster not found' });

    const inPairs = await ZoneCluster.countDocuments({ clusterId: cluster._id });
    if (inPairs > 0) {
      return res.status(400).json({ message: 'Cannot delete cluster: linked to zones. Remove zone–cluster links first.' });
    }

    const inPincode = await PincodeMapping.countDocuments({ clusterId: cluster._id });
    if (inPincode > 0) {
      return res.status(400).json({ message: 'Cannot delete cluster: used in pincode mappings.' });
    }

    const inUsers = await User.countDocuments({ cluster: cluster.name });
    if (inUsers > 0) {
      return res.status(400).json({ message: 'Cannot delete cluster: assigned to employees.' });
    }

    await Cluster.findByIdAndDelete(req.params.id);
    res.json({ message: 'Cluster deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { listClusters, createCluster, deleteCluster };
