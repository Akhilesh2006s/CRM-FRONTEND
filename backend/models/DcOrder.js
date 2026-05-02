const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 0 },
    unit_price: { type: Number, default: 0, min: 0 },
    // SKU category for the product (e.g. EduApt, Risers+, etc.)
    // Needed so "Raise DC" can prefill productCategory based on Close Lead selections.
    productCategory: { type: String },
    // Legacy / compatibility field (some older flows stored category-like values here)
    category: { type: String },
    expiry_date: { type: Date },
    term: { type: String, enum: ['Term 1', 'Term 2', 'Both'], default: 'Term 1' },
    // Per-product lead metadata
    status: {
      type: String,
      enum: ['Hot', 'Warm', 'Not Interested', 'Management Not Met', 'Visit Again'],
      default: 'Warm',
    },
    chance: {
      // Percentage chance (0–100) for this product
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    strength: {
      // Student strength for this specific product
      type: Number,
      default: 0,
      min: 0,
    },
    deliverables: { type: [String], default: [] }, // Transaction-level: deliverables selected when closing lead
    // Snapshot of enrollment shape for payment divisor / reporting (optional)
    level: { type: String, trim: true },
    subject: { type: String, trim: true },
    selected_subjects: { type: [String], default: [] },
    levels_snapshot: { type: [String], default: [] }, // distinct levels in bucket at close
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

const dcOrderSchema = new mongoose.Schema(
  {
    dc_code: { type: String, index: true },
    school_name: { type: String, required: true },
    contact_person: { type: String },
    contact_mobile: { type: String },
    contact_person2: { type: String },
    contact_mobile2: { type: String },
    email: { type: String },
    address: { type: String },
    school_type: { type: String },
    branches: { type: Number, default: 0, min: 0 },
    zone: { type: String },
    location: { type: String },
    pincode: { type: String },
    state: { type: String },
    city: { type: String },
    region: { type: String },
    area: { type: String },
    // Old Delivery and Address fields (kept for backwards compatibility)
    property_number: { type: String },
    floor: { type: String },
    tower_block: { type: String },
    nearby_landmark: { type: String },
    // New Transport fields
    transport_name: { type: String },
    transport_location: { type: String },
    transportation_landmark: { type: String },
    average_fee: { type: Number },
    strength: { type: Number, default: 0, min: 0 },
    products: { type: [productSchema], default: [] },
    priority: { type: String, enum: ['Hot', 'Warm', 'Cold', 'Visit Again', 'Not Met Management', 'Not Interested'], default: 'Hot' },
    lead_status: { type: String, enum: ['Hot', 'Warm', 'Cold'], default: 'Cold', index: true },
    status: {
      type: String,
      enum: ['saved', 'pending', 'in_transit', 'completed', 'hold', 'dc_requested', 'dc_accepted', 'dc_approved', 'dc_sent_to_senior'],
      default: 'pending',
      index: true,
    },
    hold: {
      type: Boolean,
      default: false,
    },
    estimated_delivery_date: { type: Date },
    year: { type: String, trim: true },
    actual_delivery_date: { type: Date },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    follow_up_date: { type: Date },
    remarks: { type: String },
    school_code: {
      type: String,
      trim: true,
    },
    cluster_code: {
      type: String,
      trim: true,
      index: true,
    },
    schoolCategory: {
      type: String,
      enum: ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'],
    },
    // Location tracking for mobile app
    latitude: { type: Number },
    longitude: { type: Number },
    total_amount: { type: Number, default: 0 },
    pod_proof_url: { type: String },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // History tracking for remarks and updates
    updateHistory: [{
      follow_up_date: { type: Date },
      remarks: { type: String },
      priority: { type: String, enum: ['Hot', 'Warm', 'Cold', 'Dropped', 'Visit Again', 'Not Met Management', 'Not Interested'] },
      productsInterested: { type: [followUpProductSchema], default: [] },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedAt: { type: Date, default: Date.now },
    }],
    // When executive requests DC (moves to Closed Sales)
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date },
    // DC request data (stored when employee requests DC)
    dcRequestData: {
      type: {
        dcDate: { type: Date },
        dcRemarks: { type: String },
        dcNotes: { type: String },
        dcCategory: { type: String },
        requestedQuantity: { type: Number },
        productDetails: { type: Array },
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
      default: null,
    },
    // PO PDF change request (Executive → assigned Executive Manager only)
    poChangeRequest: {
      type: {
        status: {
          type: String,
          enum: ['PENDING_MANAGER_APPROVAL', 'APPROVED', 'REJECTED'],
          default: 'PENDING_MANAGER_APPROVAL',
        },
        oldPdfUrl: { type: String },
        newPdfUrl: { type: String },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: { type: Date },
        remarks: { type: String }, // Executive's reason for update
        assignedExecutiveManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Only this manager sees/approves
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        rejectionReason: { type: String }, // legacy / when rejected
        managerRemarks: { type: String }, // Mandatory remarks from Manager (approve or reject) - visible to Executive
      },
      default: null,
    },
    // Pending edit request (when Executive edits a PO in closed sales)
    pendingEdit: {
      type: {
        // Store all editable fields
        school_name: { type: String },
        contact_person: { type: String },
        contact_mobile: { type: String },
        contact_person2: { type: String },
        contact_mobile2: { type: String },
        email: { type: String },
        address: { type: String },
        school_type: { type: String },
        zone: { type: String },
        location: { type: String },
        products: { type: [productSchema], default: [] },
        pod_proof_url: { type: String },
        remarks: { type: String },
        total_amount: { type: Number },
        // Delivery and Address fields (old)
        property_number: { type: String },
        floor: { type: String },
        tower_block: { type: String },
        nearby_landmark: { type: String },
        area: { type: String },
        city: { type: String },
        pincode: { type: String },
        // Transport fields (new)
        transport_name: { type: String },
        transport_location: { type: String },
        transportation_landmark: { type: String },
        // Metadata
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        requestedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: { type: Date },
        rejectionReason: { type: String },
      },
      default: null,
    },
  },
  { timestamps: true }
);

// Compound indexes for common query patterns
dcOrderSchema.index({ assigned_to: 1, status: 1 });
dcOrderSchema.index({ assigned_to: 1, follow_up_date: 1 });
dcOrderSchema.index({ status: 1, createdAt: -1 });
dcOrderSchema.index({ school_name: 1, contact_mobile: 1 });

dcOrderSchema.pre('save', function (next) {
  if (!this.dc_code) {
    this.dc_code = `DC-${Date.now().toString().slice(-6)}`;
  }
  next();
});

module.exports = mongoose.model('DcOrder', dcOrderSchema);


