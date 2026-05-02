const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    productLevels: {
      type: [String], // Array of levels like ['L1', 'L2', 'L3']
      default: [],
    },
    hasSubjects: {
      type: Boolean,
      default: false,
    },
    subjects: {
      type: [String], // Array of subject names
      default: [],
    },
    hasSpecs: {
      type: Boolean,
      default: false,
    },
    specs: {
      type: [String], // Array of specs - can be any custom values
      default: [],
    },
    hasCategory: {
      type: Boolean,
      default: false,
    },
    categories: {
      type: [String], // Array of product category names
      default: [],
    },
    // Payment: final line amount = (sum participation × unit price) ÷ divisor; divisor from levels or subjects
    calculationType: {
      type: String,
      enum: ['none', 'level_based', 'subject_based'],
      default: 'none',
    },
    prodStatus: {
      type: Number,
      enum: [0, 1], // 0 = not available, 1 = available
      default: 1,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true, // This adds createdAt and updatedAt automatically
  }
);

// Pre-save hook to ensure specs is always an array
productSchema.pre('save', function(next) {
  // Convert specs to array if it's a string (for backward compatibility)
  if (this.specs && typeof this.specs === 'string') {
    this.specs = [this.specs];
  }
  // Ensure it's an array
  if (this.specs && !Array.isArray(this.specs)) {
    this.specs = [];
  }
  next();
});

// Pre-update hook to handle specs conversion
productSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function(next) {
  const update = this.getUpdate();
  if (update && update.specs !== undefined) {
    // Convert specs to array if it's a string
    if (typeof update.specs === 'string') {
      update.specs = [update.specs];
    }
    // Ensure it's an array
    if (!Array.isArray(update.specs)) {
      update.specs = [];
    }
  }
  // Handle $set operator
  if (update && update.$set && update.$set.specs !== undefined) {
    if (typeof update.$set.specs === 'string') {
      update.$set.specs = [update.$set.specs];
    }
    if (!Array.isArray(update.$set.specs)) {
      update.$set.specs = [];
    }
  }
  next();
});

// Index for faster queries
productSchema.index({ prodStatus: 1, productName: 1 });

module.exports = mongoose.model('Product', productSchema);

