const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    module: { type: String, required: true, trim: true },
    resource: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['module', 'page', 'button', 'api'],
      required: true,
    },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    group: { type: String, default: '' },
    href: { type: String, default: '' },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, type: 1 });

module.exports = mongoose.model('Permission', permissionSchema);
