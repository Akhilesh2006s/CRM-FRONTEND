const mongoose = require('mongoose');

const zoneClusterSchema = new mongoose.Schema(
  {
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    clusterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cluster', required: true },
  },
  { timestamps: true }
);

zoneClusterSchema.index({ zoneId: 1, clusterId: 1 }, { unique: true });

module.exports = mongoose.model('ZoneCluster', zoneClusterSchema);
