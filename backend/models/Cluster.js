const mongoose = require('mongoose');

const clusterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, lowercase: true, trim: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cluster', clusterSchema);
