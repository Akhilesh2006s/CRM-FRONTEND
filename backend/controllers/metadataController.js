const User = require('../models/User');
const Lead = require('../models/Lead');

// @desc    Get inventory metadata options
// @route   GET /api/metadata/inventory-options
// @access  Private
const getInventoryOptions = async (req, res) => {
  try {
    let vendorNames = ['Vendor 1', 'Vendor 2', 'Vendor 3'];
    try {
      const vendorUsers = await User.find({ role: 'Vendor', isActive: { $ne: false } })
        .select('name email')
        .lean();
      const fromDb = vendorUsers
        .map((v) => (v.name || v.email || '').trim())
        .filter(Boolean);
      if (fromDb.length > 0) vendorNames = [...new Set(fromDb)].sort();
    } catch (_) {
      /* keep defaults */
    }

    const options = {
      products: [
        'Abacus',
        'Vedic Maths',
        'EEL',
        'IIT',
        'Financial literacy',
        'Brain bytes',
        'Spelling bee',
        'Skill pro',
        'Maths lab',
        'Codechamp',
      ],
      uoms: ['Pieces (pcs)', 'boxes'],
      itemTypes: ['Books', 'Question Paper', 'Instruments'],
      vendors: vendorNames,
    };

    res.json(options);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unique states from users and leads
// @route   GET /api/metadata/states
// @access  Private
const getStates = async (req, res) => {
  try {
    // Get unique states from users
    const userStates = await User.distinct('state', { state: { $exists: true, $ne: null, $ne: '' } });
    
    // Get unique states from leads
    const leadStates = await Lead.distinct('state', { state: { $exists: true, $ne: null, $ne: '' } });
    
    // Combine and get unique states, sorted alphabetically
    const allStates = [...new Set([...userStates, ...leadStates])]
      .filter(state => state && state.trim() !== '')
      .sort();
    
    res.json(allStates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unique cities from users and leads (optionally filtered by state)
// @route   GET /api/metadata/cities?state=StateName
// @access  Private
const getCities = async (req, res) => {
  try {
    const { state } = req.query;
    
    // Build filter for state if provided
    const stateFilter = state ? { state: state } : {};
    
    // Get unique cities from users
    const userFilter = { city: { $exists: true, $ne: null, $ne: '' }, ...stateFilter };
    const userCities = await User.distinct('city', userFilter);
    
    // Get unique cities from leads
    const leadFilter = { city: { $exists: true, $ne: null, $ne: '' }, ...stateFilter };
    const leadCities = await Lead.distinct('city', leadFilter);
    
    // Get unique assigned cities from users (these might not have state, so only if no state filter)
    let assignedCities = [];
    if (!state) {
      assignedCities = await User.distinct('assignedCity', { assignedCity: { $exists: true, $ne: null, $ne: '' } });
    }
    
    // Combine and get unique cities, sorted alphabetically
    const allCities = [...new Set([...userCities, ...leadCities, ...assignedCities])]
      .filter(city => city && city.trim() !== '')
      .sort();
    
    res.json(allCities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getInventoryOptions,
  getStates,
  getCities,
};

