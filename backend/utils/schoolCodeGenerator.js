const Lead = require('../models/Lead');
const DcOrder = require('../models/DcOrder');

// Region prefix mapping (2 chars, uppercase)
const REGION_PREFIXES = {
  'hyderabad city': 'HY',
  'karimnagar': 'KR',
  'khammam': 'KH',
  'secunderabad': 'SC',
  'ghaziabad': 'GH',
  // add more regions here as they appear in your DB
};

// City code mapping (3 chars, uppercase)
const CITY_CODES = {
  hyderabad: 'HYD',
  'karim nagar': 'KRN',
  karimnagar: 'KRN',
  khammam: 'KHM',
  secunderabad: 'SEC',
  delhi: 'DEL',
  'new delhi': 'DEL',
  mumbai: 'MUM',
  bangalore: 'BLR',
  chennai: 'CHN',
  kolkata: 'KOL',
  pune: 'PUN',
  ahmedabad: 'AMD',
  'gautam buddha nagar': 'GBN',
  'k.v.rangareddy': 'KVR',
  // add more cities here as they appear in your DB
};

/**
 * Generate a unique school code based on region + city
 * Format: RegionPrefix (2 chars) + CityCode (3 chars) + Global sequence number
 * Example: HYHYD1, HYHYD2, KRKRN1, etc.
 *
 * @param {Object} options - { region, city }
 * @returns {Promise<String>} - The generated school code
 */
async function generateSchoolCode({ region, city } = {}) {
  try {
    // Resolve region prefix
    const regionKey = (region || '').trim().toLowerCase();
    const regionPrefix =
      REGION_PREFIXES[regionKey] ||
      regionKey.substring(0, 2).toUpperCase() ||
      'XX';

    // Resolve city code
    const cityKey = (city || '').trim().toLowerCase();
    const cityCode =
      CITY_CODES[cityKey] ||
      cityKey.substring(0, 3).toUpperCase() ||
      'XXX';

    const prefix = `${regionPrefix}${cityCode}`;

    // Find all existing codes globally with any prefix (global counter)
    const [existingLeads, existingDcOrders] = await Promise.all([
      Lead.find({ school_code: { $regex: '^[A-Z]{2}[A-Z]{3}\\d+$', $options: 'i' } }).select('school_code'),
      DcOrder.find({ school_code: { $regex: '^[A-Z]{2}[A-Z]{3}\\d+$', $options: 'i' } }).select('school_code'),
    ]);

    // Extract the numeric suffix from all existing codes globally
    const allCodes = [
      ...existingLeads.map((l) => l.school_code),
      ...existingDcOrders.map((d) => d.school_code),
    ].filter(Boolean);

    let maxNumber = 0;
    allCodes.forEach((code) => {
      const match = code.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    const nextNumber = maxNumber + 1;
    const schoolCode = `${prefix}${nextNumber}`;

    return schoolCode;
  } catch (error) {
    console.error('Error generating school code:', error);
    throw error;
  }
}

module.exports = { generateSchoolCode };
