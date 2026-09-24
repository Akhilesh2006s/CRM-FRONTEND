const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameLower: {
      type: String,
      trim: true,
      lowercase: true,
    },
    /** Parent zone — required for new clusters (legacy rows may be null). */
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Zone',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique cluster name per zone (allow multiple null zoneId legacy names via sparse compound)
clusterSchema.index(
  { zoneId: 1, nameLower: 1 },
  { unique: true, partialFilterExpression: { nameLower: { $type: 'string' } } }
);

module.exports = mongoose.model('Cluster', clusterSchema);
