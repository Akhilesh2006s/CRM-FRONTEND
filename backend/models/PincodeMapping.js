const mongoose = require('mongoose');

const pincodeMappingSchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, trim: true, match: /^\d{6}$/ },
    city: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    clusterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster', required: true },
  },
  { timestamps: true }
);

pincodeMappingSchema.index({ pincode: 1 }, { unique: true });

module.exports = mongoose.model('PincodeMapping', pincodeMappingSchema);
