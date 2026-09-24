const Lead = require('../models/Lead');
const DcOrder = require('../models/DcOrder');
const Zone = require('../models/Zone');
const Cluster = require('../models/Cluster');
const PincodeMapping = require('../models/PincodeMapping');
const { displayClientSchoolCode } = require('../utils/clientSchoolCode');

function schoolCodeFilter(codes) {
  const list = (codes || []).filter(Boolean);
  if (list.length === 0) return null;
  return {
    $or: [
      { school_code: { $in: list } },
      { dc_code: { $in: list } },
    ],
  };
}

// @desc    Get schools (optional filters: cluster, zone, pincode)
// @route   GET /api/schools
// @access  Private
const getSchools = async (req, res) => {
  try {
    const { cluster, zone, pincode } = req.query;
    const orderFilter = {};
    const leadFilter = {};

    // When filtering by cluster/zone/pincode, include all matching leads (not only closed)
    // so Assign Areas / Move Schools reflect current membership.
    const filtering = Boolean(cluster || zone || pincode);
    if (!filtering) {
      orderFilter.school_code = { $exists: true, $ne: '' };
      leadFilter.status = 'Closed';
      leadFilter.school_code = { $exists: true, $ne: '' };
    }

    if (cluster) {
      const c = String(cluster).trim();
      orderFilter.cluster_code = c;
      leadFilter.cluster = c;
    }
    if (zone) {
      const z = String(zone).trim();
      orderFilter.zone = z;
      leadFilter.zone = z;
    }
    if (pincode) {
      const pin = String(pincode).replace(/\D/g, '').slice(0, 6);
      orderFilter.pincode = pin;
      leadFilter.pincode = pin;
    }

    const [orders, leads] = await Promise.all([
      DcOrder.find(orderFilter)
        .select(
          'school_name school_code contact_person contact_mobile location strength dc_code status zone cluster_code pincode'
        )
        .sort({ school_name: 1 })
        .lean(),
      Lead.find(leadFilter)
        .select(
          'school_name school_code contact_person contact_mobile location strength zone cluster pincode status dc_code'
        )
        .sort({ school_name: 1 })
        .lean(),
    ]);

    const byCode = new Map();

    const addRow = (row, id, source) => {
      const schoolCode = displayClientSchoolCode(row) || String(id);
      const key = schoolCode.toLowerCase();
      // Prefer DC row when both exist, but always keep latest zone/cluster from whichever we process last if DC already set
      if (byCode.has(key) && source === 'lead') return;
      byCode.set(key, {
        _id: id,
        source,
        schoolCode: displayClientSchoolCode(row) || '',
        schoolName: row.school_name || '',
        contactName: row.contact_person || '',
        mobileNumber: row.contact_mobile || '',
        location: row.location || '',
        avgStrength: row.strength || 0,
        zone: row.zone || '',
        cluster: row.cluster_code || row.cluster || '',
        pincode: row.pincode || '',
      });
    };

    // Leads first, then DC overwrites — DC is treated as source of truth for converted schools
    leads.forEach((l) => addRow(l, l._id, 'lead'));
    orders.forEach((o) => addRow(o, o._id, 'dc'));

    const schools = Array.from(byCode.values()).sort((a, b) =>
      a.schoolName.localeCompare(b.schoolName)
    );

    res.json(schools);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Resolve school codes + ids so a move updates BOTH Lead and DcOrder copies
 * of the same school (selection previously only updated one _id).
 */
async function resolveMoveTargets({ mode, pincode, schoolIds }) {
  if (mode === 'pincode') {
    const pin = String(pincode || '').replace(/\D/g, '').slice(0, 6);
    if (pin.length !== 6) {
      const err = new Error('Valid 6-digit pincode required');
      err.status = 400;
      throw err;
    }
    const [leads, orders] = await Promise.all([
      Lead.find({ pincode: pin }).select('_id school_code dc_code zone cluster pincode').lean(),
      DcOrder.find({ pincode: pin })
        .select('_id school_code dc_code zone cluster_code pincode')
        .lean(),
    ]);
    return { pin, leads, orders };
  }

  const ids = Array.isArray(schoolIds) ? schoolIds.filter(Boolean) : [];
  if (ids.length === 0) {
    const err = new Error('schoolIds required for selection mode');
    err.status = 400;
    throw err;
  }

  const [leadsById, ordersById] = await Promise.all([
    Lead.find({ _id: { $in: ids } }).select('_id school_code dc_code zone cluster pincode').lean(),
    DcOrder.find({ _id: { $in: ids } })
      .select('_id school_code dc_code zone cluster_code pincode')
      .lean(),
  ]);

  const codes = new Set();
  [...leadsById, ...ordersById].forEach((r) => {
    const code = displayClientSchoolCode(r);
    if (code) codes.add(code);
  });
  const codeList = [...codes];
  const codeQ = schoolCodeFilter(codeList);

  // Pull sibling records with the same school_code so old cluster is cleared everywhere
  const [moreLeads, moreOrders] = await Promise.all([
    codeQ ? Lead.find(codeQ).select('_id school_code dc_code zone cluster pincode').lean() : [],
    codeQ
      ? DcOrder.find(codeQ).select('_id school_code dc_code zone cluster_code pincode').lean()
      : [],
  ]);

  const leadMap = new Map();
  [...leadsById, ...moreLeads].forEach((l) => leadMap.set(String(l._id), l));
  const orderMap = new Map();
  [...ordersById, ...moreOrders].forEach((o) => orderMap.set(String(o._id), o));

  return {
    pin: null,
    leads: [...leadMap.values()],
    orders: [...orderMap.values()],
    ids,
    codeList,
  };
}

// @desc    Admin: move schools between clusters/zones by pincode or selection
// @route   POST /api/schools/move
// @access  Private (Admin / Super Admin)
const moveSchools = async (req, res) => {
  try {
    const { mode, pincode, schoolIds, targetZoneId, targetClusterId } = req.body;

    if (!targetZoneId || !targetClusterId) {
      return res.status(400).json({ message: 'targetZoneId and targetClusterId are required' });
    }
    if (!['pincode', 'selection'].includes(mode)) {
      return res.status(400).json({ message: 'mode must be pincode or selection' });
    }

    const zone = await Zone.findById(targetZoneId);
    const cluster = await Cluster.findById(targetClusterId);
    if (!zone || !cluster) {
      return res.status(400).json({ message: 'Invalid target zone or cluster' });
    }

    let targets;
    try {
      targets = await resolveMoveTargets({ mode, pincode, schoolIds });
    } catch (e) {
      return res.status(e.status || 400).json({ message: e.message });
    }

    const leadIds = targets.leads.map((l) => l._id);
    const orderIds = targets.orders.map((o) => o._id);
    const fromClusters = [
      ...new Set(
        [
          ...targets.leads.map((l) => l.cluster).filter(Boolean),
          ...targets.orders.map((o) => o.cluster_code).filter(Boolean),
        ].map((c) => String(c).trim())
      ),
    ].filter((c) => c && c !== cluster.name);

    const leadUpdate = {
      $set: {
        zone: zone.name,
        cluster: cluster.name,
      },
    };
    const orderUpdate = {
      $set: {
        zone: zone.name,
        cluster_code: cluster.name,
      },
    };

    const [leadResult, orderResult] = await Promise.all([
      leadIds.length
        ? Lead.updateMany({ _id: { $in: leadIds } }, leadUpdate)
        : Promise.resolve({ modifiedCount: 0, matchedCount: 0 }),
      orderIds.length
        ? DcOrder.updateMany({ _id: { $in: orderIds } }, orderUpdate)
        : Promise.resolve({ modifiedCount: 0, matchedCount: 0 }),
    ]);

    // Keep pincode → zone/cluster mapping in sync (so future auto-fill uses new cluster)
    if (mode === 'pincode' && targets.pin) {
      await PincodeMapping.findOneAndUpdate(
        { pincode: targets.pin },
        {
          pincode: targets.pin,
          zoneId: zone._id,
          clusterId: cluster._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      // Selection: update mappings for any pincodes on the moved schools
      const pins = [
        ...new Set(
          [...targets.leads, ...targets.orders]
            .map((r) => String(r.pincode || '').replace(/\D/g, '').slice(0, 6))
            .filter((p) => p.length === 6)
        ),
      ];
      if (pins.length > 0) {
        await PincodeMapping.updateMany(
          { pincode: { $in: pins } },
          { $set: { zoneId: zone._id, clusterId: cluster._id } }
        );
      }
    }

    // Ensure cluster belongs to target zone
    if (!cluster.zoneId || String(cluster.zoneId) !== String(zone._id)) {
      cluster.zoneId = zone._id;
      await cluster.save();
    }

    res.json({
      message: 'Schools moved successfully',
      leadsUpdated: leadResult.modifiedCount || 0,
      leadsMatched: leadResult.matchedCount || leadIds.length,
      ordersUpdated: orderResult.modifiedCount || 0,
      ordersMatched: orderResult.matchedCount || orderIds.length,
      removedFromClusters: fromClusters,
      targetZone: zone.name,
      targetCluster: cluster.name,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSchools,
  moveSchools,
};
