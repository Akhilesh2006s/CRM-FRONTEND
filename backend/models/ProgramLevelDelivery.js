const mongoose = require('mongoose');

const programLevelDeliverySchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProgramBilling',
      required: true,
      index: true,
    },
    levelNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    studentsCount: {
      type: Number,
      required: true,
      min: 0,
    },
    dcId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DC',
      required: true,
      index: true,
    },
    deliveredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

programLevelDeliverySchema.index({ programId: 1, levelNumber: 1 }, { unique: true });
programLevelDeliverySchema.index({ programId: 1, deliveredAt: -1 });

module.exports = mongoose.model('ProgramLevelDelivery', programLevelDeliverySchema);
