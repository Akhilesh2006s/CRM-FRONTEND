const Lead = require('../models/Lead');
const DcOrder = require('../models/DcOrder');
const { displayClientSchoolCode } = require('../utils/clientSchoolCode');

// @desc    Get all client schools (converted — keyed by school_code)
// @route   GET /api/schools
// @access  Private
const getSchools = async (req, res) => {
  try {
    const [orders, closedLeads] = await Promise.all([
      DcOrder.find({
        school_code: { $exists: true, $ne: '' },
      })
        .select(
          'school_name school_code contact_person contact_mobile location strength dc_code status'
        )
        .sort({ school_name: 1 })
        .lean(),
      Lead.find({
        status: 'Closed',
        school_code: { $exists: true, $ne: '' },
      })
        .select('school_name school_code contact_person contact_mobile location strength')
        .sort({ school_name: 1 })
        .lean(),
    ]);

    const byCode = new Map();

    const addRow = (row, id) => {
      const schoolCode = displayClientSchoolCode(row);
      if (!schoolCode) return;
      const key = schoolCode.toLowerCase();
      if (byCode.has(key)) return;
      byCode.set(key, {
        _id: id,
        schoolCode,
        schoolName: row.school_name || '',
        contactName: row.contact_person || '',
        mobileNumber: row.contact_mobile || '',
        location: row.location || '',
        avgStrength: row.strength || 0,
      });
    };

    orders.forEach((o) => addRow(o, o._id));
    closedLeads.forEach((l) => addRow(l, l._id));

    const schools = Array.from(byCode.values()).sort((a, b) =>
      a.schoolName.localeCompare(b.schoolName)
    );

    res.json(schools);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSchools,
};
