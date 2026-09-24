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
    enum: ['Super Admin', 'Admin', 'Finance Manager', 'HR Manager', 'Trainer', 'Coordinator', 'Senior Coordinator', 'Manager', 'Executive', 'Sales BDE', 'Executive Manager', 'Warehouse Executive', 'Warehouse Manager', 'Vendor', 'Partner', 'Franchise'],
    default: 'Executive',
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null,
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
  /** Temporary / current address (Module 1 KYC). */
  temporaryAddress: { type: String, default: '' },
  /** Permanent address (Module 1 KYC). */
  permanentAddress: { type: String, default: '' },
  /** Two emergency / character references. */
  references: [
    {
      relation: {
        type: String,
        enum: ['Wife', 'Brother', 'Sister', 'Father', 'Mother'],
      },
      name: { type: String, trim: true },
      mobile: { type: String, trim: true },
    },
  ],
  /** Uploaded Aadhaar document URL. */
  aadhaarUrl: { type: String, default: '' },
  /** Location / geo photo upload URL. */
  locationPhotoUrl: { type: String, default: '' },
  /**
   * Onboarding verification: pending until HR + Zonal (etc.) all approve.
   */
  verificationStatus: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvals: [
    {
      roleKey: {
        type: String,
        enum: ['hr_manager', 'zonal_manager', 'training_head', 'vertical_manager'],
      },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
      note: { type: String, default: '' },
      at: { type: Date, default: null },
    },
  ],
  /** For trainers: second vertical manager (zone manager is executiveManagerId / zone). */
  verticalManagerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
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
  trainerAbacusLevels: { type: String },
  trainerVedicLevels: { type: String },
  trainerType: { type: String, enum: ['BDE', 'Employee', 'Freelancer', 'Teachers'], default: undefined },
  taggedEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: {
    type: Boolean,
    default: true,
  },
  avatar: {
    type: String,
  },
  lastLogin: {
    type: Date,
  },
  // Mobile device lock — first successful login with deviceId binds the account
  boundDeviceId: {
    type: String,
    default: null,
  },
  boundDeviceAt: {
    type: Date,
    default: null,
  },
  // Forgot-password OTP (hashed). Cleared after successful reset.
  resetOtpHash: {
    type: String,
    default: null,
    select: false,
  },
  resetOtpExpires: {
    type: Date,
    default: null,
    select: false,
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
  // Partner-specific: products assigned to this partner (only used when role is Partner)
  partnerAssignedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
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

