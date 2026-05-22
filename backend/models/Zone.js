const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true, lowercase: true, trim: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Zone', zoneSchema);
