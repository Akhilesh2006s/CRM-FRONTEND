const User = require('../models/User');

// List trainers with filters
const listTrainers = async (req, res) => {
  try {
    const { q, status, type, zone, isActive } = req.query;
    const filter = { role: 'Trainer' };
    if (typeof isActive !== 'undefined') filter.isActive = isActive === 'true';
    if (type) filter.trainerType = type;
    if (zone) filter.zone = zone;
    if (status === 'inactive') filter.isActive = false;
    if (status === 'active') filter.isActive = true;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { mobile: { $regex: q, $options: 'i' } },
      ];
    }
    const trainers = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(trainers);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Create trainer (as a User with role Trainer)
const createTrainer = async (req, res) => {
  try {
    const { name, email, mobile, trainerProducts, trainerLevels, trainerAbacusLevels, trainerVedicLevels, trainerType, state, zone, cluster, address1 } = req.body;
    if (!mobile) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }
    const exists = await User.findOne({ mobile: mobile.trim() });
    if (exists) {
      return res.status(400).json({ message: 'Mobile number already exists. Please use a different mobile number.' });
    }
    const trainer = await User.create({
      name,
      email,
      password: 'Password123',
      role: 'Trainer',
      mobile,
      trainerProducts,
      trainerLevels,
      trainerAbacusLevels,
      trainerVedicLevels,
      trainerType,
      state,
      zone,
      cluster,
      address1,
    });
    const data = await User.findById(trainer._id).select('-password');
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update trainer
const updateTrainer = async (req, res) => {
  try {
    const trainer = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    res.json(trainer);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Activate/Inactive
const setTrainerActive = async (req, res) => {
  try {
    const { isActive } = req.body;
    const trainer = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-password');
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    res.json(trainer);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Reset trainer password
const resetTrainerPassword = async (req, res) => {
  try {
    const trainer = await User.findById(req.params.id);
    if (!trainer) return res.status(404).json({ message: 'Trainer not found' });
    trainer.password = 'Password123';
    await trainer.save();
    res.json({ message: 'Password reset to Password123' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  listTrainers,
  createTrainer,
  updateTrainer,
  setTrainerActive,
  resetTrainerPassword,
};


