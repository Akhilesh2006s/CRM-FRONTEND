const PincodeMapping = require('../models/PincodeMapping');
const Zone = require('../models/Zone');
const Cluster = require('../models/Cluster');

const listPincodeMappings = async (req, res) => {
  try {
    const items = await PincodeMapping.find()
      .populate('zoneId', 'name')
      .populate('clusterId', 'name')
      .sort({ pincode: 1 });

    res.json(
      items.map((m) => ({
        _id: m._id,
        pincode: m.pincode,
        city: m.city,
        district: m.district,
        state: m.state,
        zone: m.zoneId?.name || '',
        cluster: m.clusterId?.name || '',
        zoneId: m.zoneId?._id,
        clusterId: m.clusterId?._id,
      }))
    );
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const createPincodeMapping = async (req, res) => {
  try {
    const pincode = (req.body.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      return res.status(400).json({ message: 'Valid 6-digit pincode is required' });
    }

    const { zoneId, clusterId, city, district, state } = req.body;
    if (!zoneId || !clusterId) {
      return res.status(400).json({ message: 'Zone and cluster are required' });
    }

    const existing = await PincodeMapping.findOne({ pincode });
    if (existing) return res.status(400).json({ message: 'Pincode mapping already exists' });

    const zone = await Zone.findById(zoneId);
    const cluster = await Cluster.findById(clusterId);
    if (!zone || !cluster) {
      return res.status(400).json({ message: 'Invalid zone or cluster' });
    }

    const item = await PincodeMapping.create({
      pincode,
      city: (city || '').trim(),
      district: (district || '').trim(),
      state: (state || '').trim(),
      zoneId,
      clusterId,
    });

    const populated = await PincodeMapping.findById(item._id)
      .populate('zoneId', 'name')
      .populate('clusterId', 'name');

    res.status(201).json({
      _id: populated._id,
      pincode: populated.pincode,
      city: populated.city,
      district: populated.district,
      state: populated.state,
      zone: populated.zoneId?.name,
      cluster: populated.clusterId?.name,
      zoneId: populated.zoneId?._id,
      clusterId: populated.clusterId?._id,
    });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: 'Pincode mapping already exists' });
    res.status(500).json({ message: e.message });
  }
};

const deletePincodeMapping = async (req, res) => {
  try {
    const item = await PincodeMapping.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Pincode mapping not found' });
    res.json({ message: 'Pincode mapping deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { listPincodeMappings, createPincodeMapping, deletePincodeMapping };
