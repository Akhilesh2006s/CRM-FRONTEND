const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function() {
      return !this.firebaseUID;
    },
  },
  firebaseUID: {
    type: String,
    sparse: true,
    unique: true,
  },
  role: {
    type: String,
    enum: ['Super Admin', 'Admin', 'Finance Manager', 'Trainer', 'Coordinator', 'Senior Coordinator', 'Manager', 'Executive', 'Sales BDE', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Vendor', 'Partner'],
    default: 'Executive',
  },
  // Support for multiple roles (for mobile app employees who can be both Sales BDE and Trainer)
  roles: [{
    type: String,
    enum: ['Sales BDE', 'Trainer'],
  }],
  hasCompletedFirstTimeSetup: {
    type: Boolean,
    default: false,
  },
  firstName: { type: String },
  lastName: { type: String },
  empCode: { type: String },
  phone: { type: String, default: '0' },
  mobile: { type: String },
  address1: { type: String },
  state: { type: String },
  zone: { type: String },
  cluster: { type: String },
  district: { type: String },
  city: { type: String },
  pincode: { type: String },
  department: { type: String },
  // Trainer specific fields (optional)
  trainerProducts: [{ type: String }],
  trainerLevels: { type: String },
  trainerType: { type: String, enum: ['BDE', 'Employee', 'Freelancer', 'Teachers'], default: undefined },
  isActive: {
    type: Boolean,
    default: true,
  },
  inactiveReason: {
    type: String,
    enum: ['on_leave', 'manual'],
  },
  avatar: {
    type: String,
  },
  lastLogin: {
    type: Date,
  },
  // Executive Manager hierarchy fields
  executiveManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  assignedState: {
    type: String,
    default: null,
  },
  assignedCity: {
    type: String,
    default: null,
  },
  assignedArea: {
    type: String,
    default: null,
  },
  assignedDistrict: {
    type: String,
    default: null,
  },
  // Partner-specific: products assigned to this partner
  partnerAssignedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  // Legacy vendor field (kept for existing records)
  vendorAssignedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

