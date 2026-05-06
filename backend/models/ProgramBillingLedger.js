const mongoose = require('mongoose');

const programBillingLedgerSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgramBilling',
      required: true,
      index: true,
    },
    sourceDcId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DC',
      index: true,
    },
    eventType: {
      type: String,
      enum: ['RECOMPUTE', 'PAYABLE_UPSERT', 'CREDIT_NOTE', 'WAITING_FINAL_TERM'],
      required: true,
      index: true,
    },
    previousPayable: {
      type: Number,
      default: 0,
    },
    newPayable: {
      type: Number,
      default: 0,
    },
    delta: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

programBillingLedgerSchema.index({ programId: 1, createdAt: -1 });

module.exports = mongoose.model('ProgramBillingLedger', programBillingLedgerSchema);
