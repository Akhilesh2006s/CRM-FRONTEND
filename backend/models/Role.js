const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    description: { type: String, default: '' },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    permissionKeys: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
