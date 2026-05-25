const mongoose = require('mongoose');

const sampleProductSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    class: { type: String, default: '1' },
    productCategory: { type: String },
    specs: { type: String, default: 'Regular' },
    strength: { type: Number, default: 0, min: 0 },
    level: { type: String, default: 'L1' },
  },
  { _id: false }
);

const sampleRequestSchema = new mongoose.Schema(
  {
    request_code: {
      type: String,
      unique: true,
      index: true,
    },
    employee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dc_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DcOrder',
      index: true,
    },
    school_name: {
      type: String,
      required: true,
      trim: true,
    },
    contact_person: { type: String, trim: true },
    contact_mobile: { type: String, trim: true },
    address: { type: String, trim: true },
    location: { type: String, trim: true },
    zone: { type: String, trim: true },
    property_number: { type: String, trim: true },
    floor: { type: String, trim: true },
    tower_block: { type: String, trim: true },
    nearby_landmark: { type: String, trim: true },
    area: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    transport_name: { type: String, trim: true },
    transport_location: { type: String, trim: true },
    transportation_landmark: { type: String, trim: true },
    products: {
      type: [sampleProductSchema],
      default: [],
    },
    purpose: {
      type: String,
      default: 'To show schools',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Accepted', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    accepted_at: { type: Date },
    rejected_at: { type: Date },
    accepted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejection_reason: { type: String, trim: true },
    emp_dc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'EmpDC' },
    dc_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DC', index: true },
  },
  { timestamps: true }
);

sampleRequestSchema.pre('save', async function (next) {
  if (!this.request_code) {
    let code;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = `SAMPLE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const existing = await mongoose.model('SampleRequest').findOne({ request_code: code });
      if (!existing) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      return next(new Error('Failed to generate unique request code'));
    }
    this.request_code = code;
  }
  next();
});

module.exports = mongoose.model('SampleRequest', sampleRequestSchema);
