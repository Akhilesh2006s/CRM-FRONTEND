const mongoose = require('mongoose');

const programBillingSchema = new mongoose.Schema(
  {
    programCode: {
      type: String,
      index: true,
      unique: true,
      sparse: true,
      trim: true,
    },
    dcOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DcOrder',
      index: true,
      required: true,
    },
    product: {
      type: String,
      required: true,
      trim: true,
    },
    totalLevels: {
      type: Number,
      required: true,
      min: 1,
    },
    deliveredLevelsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
      index: true,
    },
    lastComputedPayable: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastComputedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

programBillingSchema.index({ dcOrderId: 1, product: 1 }, { unique: true });
programBillingSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model('ProgramBilling', programBillingSchema);
