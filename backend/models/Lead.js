const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 0 },
    unit_price: { type: Number, default: 0, min: 0 },
    expiry_date: { type: Date },
    deliverables: { type: [String], default: [] }, // Transaction-level: deliverables selected when closing lead
    term: {
      type: String,
      enum: ['Term 1', 'Term 2', 'Both'],
      default: 'Term 1',
    },
    level: { type: String, trim: true },
    subject: { type: String, trim: true },
    selected_subjects: { type: [String], default: [] },
    levels_snapshot: { type: [String], default: [] },
  },
  { _id: false }
);

const followUpProductSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true, trim: true },
    term: { type: String, enum: ['Term 1', 'Term 2', 'Both'], default: 'Term 1' },
    status: {
      type: String,
      enum: ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'],
      default: 'Warm',
    },
    strength: { type: Number, default: 0, min: 0 },
    chance: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    // Segmentation: new school vs existing school (DcOrder) renewal
    lead_type: {
      type: String,
      enum: ['new', 'renewal'],
      default: 'new',
      index: true,
    },
    // Existing client / school record (DcOrder) — required for renewal leads
    school_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DcOrder',
      index: true,
    },
    // Audit snapshot when renewal lead was created
    renewalSource: {
      snapshotAt: { type: Date },
      sourceSchoolName: { type: String, trim: true },
      sourceSchoolCode: { type: String, trim: true },
    },

    // Core school/deal info
    school_name: {
      type: String,
      required: true,
      trim: true,
    },
    contact_person: {
      type: String,
      required: true,
      trim: true,
    },
    contact_mobile: {
      type: String,
      required: true,
      trim: true,
    },
    products: {
      type: [productSchema],
      default: [],
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
      trim: true,
    },

    // Assignment
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Deal Conversion status
    status: {
      type: String,
      enum: ['Pending', 'Processing', 'Saved', 'Closed'],
      default: 'Pending',
      index: true,
    },

    // Business metadata
    school_code: {
      type: String,
      unique: false,
      sparse: true,
      trim: true,
    },
    po_number: {
      type: String,
      trim: true,
    },
    follow_up_date: {
      type: Date,
    },
    year: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Hot', 'Warm', 'Cold'],
      default: 'Cold',
      index: true,
    },
    zone: {
      type: String,
      default: '',
      trim: true,
    },
    strength: {
      // student count
      type: Number,
      default: 0,
      min: 0,
    },
    updateHistory: [{
      follow_up_date: { type: Date },
      remarks: { type: String },
      priority: { type: String, enum: ['Hot', 'Warm', 'Cold', 'Visit Again', 'Not Met Management', 'Not Interested'] },
      productsInterested: { type: [followUpProductSchema], default: [] },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedAt: { type: Date, default: Date.now },
    }],

    // Ownership
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    managed_by: {
      // current executive handling the deal
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

leadSchema.index({ lead_type: 1, status: 1 });
leadSchema.index({ school_id: 1, lead_type: 1 });

module.exports = mongoose.model('Lead', leadSchema);

