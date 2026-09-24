const Lead = require('../models/Lead');
const DcOrder = require('../models/DcOrder');

/**
 * Generate a unique school code from state + district (city used as district).
 * Format: ST(2) + DIST(3) + sequence  e.g. TSHYD1
 * Client may confirm exact format later — keep this as the interim rule.
 */
async function generateSchoolCode({ state, district, city, region } = {}) {
  try {
    const stateKey = (state || region || '').trim().toLowerCase();
    const distKey = (district || city || '').trim().toLowerCase();

    const statePrefix =
      stateKey.replace(/[^a-z]/g, '').substring(0, 2).toUpperCase() || 'XX';
    const distPrefix =
      distKey.replace(/[^a-z]/g, '').substring(0, 3).toUpperCase() || 'XXX';

    const prefix = `${statePrefix}${distPrefix}`;

    const [existingLeads, existingDcOrders] = await Promise.all([
      Lead.find({
        school_code: { $regex: `^${prefix}\\d+$`, $options: 'i' },
      }).select('school_code'),
      DcOrder.find({
        school_code: { $regex: `^${prefix}\\d+$`, $options: 'i' },
      }).select('school_code'),
    ]);

    const allCodes = [
      ...existingLeads.map((l) => l.school_code),
      ...existingDcOrders.map((d) => d.school_code),
    ].filter(Boolean);

    let maxNumber = 0;
    allCodes.forEach((code) => {
      const match = String(code).match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    return `${prefix}${maxNumber + 1}`;
  } catch (error) {
    console.error('Error generating school code:', error);
    throw error;
  }
}

module.exports = { generateSchoolCode };
