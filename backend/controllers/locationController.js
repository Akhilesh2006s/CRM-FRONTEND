const PincodeMapping = require('../models/PincodeMapping');
const ZoneCluster = require('../models/ZoneCluster');
const { fetchPincodeFromApi } = require('../utils/fetchPincodeFromApi');

const getTownFromPincode = async (req, res) => {
  try {
    const pincode = (req.query.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      return res.status(400).json({ message: 'Valid 6-digit pincode is required' });
    }

    const mapping = await PincodeMapping.findOne({ pincode })
      .populate('zoneId', 'name')
      .populate('clusterId', 'name');

    if (mapping) {
      return res.json({
        pincode,
        town: mapping.city,
        district: mapping.district,
        state: mapping.state,
        zone: mapping.zoneId?.name || '',
        cluster: mapping.clusterId?.name || '',
        success: true,
        fromMapping: true,
      });
    }

    try {
      const api = await fetchPincodeFromApi(pincode);
      if (api.success) {
        return res.json({
          pincode,
          town: api.town,
          district: api.district,
          state: api.state,
          region: api.region,
          success: true,
        });
      }
      return res.status(404).json({ message: 'Pincode not found', success: false });
    } catch (fetchError) {
      console.error('Pincode API error:', fetchError);
      return res.json({
        pincode,
        success: false,
        message: 'Pincode lookup service unavailable. Please enter details manually.',
      });
    }
  } catch (error) {
    console.error('Error getting town from pincode:', error);
    res.status(500).json({ message: error.message });
  }
};

const resolveLocation = async (req, res) => {
  try {
    const pincode = (req.query.pincode || '').replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      return res.status(400).json({ message: 'Valid 6-digit pincode is required', success: false });
    }

    const mapping = await PincodeMapping.findOne({ pincode })
      .populate('zoneId', 'name')
      .populate('clusterId', 'name');

    if (mapping) {
      return res.json({
        pincode,
        city: mapping.city || '',
        district: mapping.district || '',
        state: mapping.state || '',
        zone: mapping.zoneId?.name || '',
        cluster: mapping.clusterId?.name || '',
        success: true,
        fromMapping: true,
      });
    }

    let city = '';
    let district = '';
    let state = '';

    try {
      const api = await fetchPincodeFromApi(pincode);
      if (api.success) {
        city = api.town || '';
        district = api.district || '';
        state = api.state || '';
      }
    } catch (fetchError) {
      console.error('Pincode API error:', fetchError);
    }

    let zone = '';
    let cluster = '';

    if (district && state) {
      const districtMapping = await PincodeMapping.findOne({
        district: new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        state: new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      })
        .populate('zoneId', 'name')
        .populate('clusterId', 'name')
        .limit(1);

      if (districtMapping) {
        zone = districtMapping.zoneId?.name || '';
        cluster = districtMapping.clusterId?.name || '';
      }
    }

    if (zone && !cluster) {
      const zoneDoc = await require('../models/Zone').findOne({
        name: new RegExp(`^${zone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
      if (zoneDoc) {
        const firstPair = await ZoneCluster.findOne({ zoneId: zoneDoc._id }).populate('clusterId', 'name');
        if (firstPair?.clusterId?.name) cluster = firstPair.clusterId.name;
      }
    }

    res.json({
      pincode,
      city,
      district,
      state,
      zone,
      cluster,
      success: !!(city || district || state),
      fromMapping: false,
    });
  } catch (error) {
    console.error('Error resolving location:', error);
    res.status(500).json({ message: error.message, success: false });
  }
};

module.exports = {
  getTownFromPincode,
  resolveLocation,
};
