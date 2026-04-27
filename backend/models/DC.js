const mongoose = require('mongoose');

const dcSchema = new mongoose.Schema({
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: false,
    index: true,
  },
  dcOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DcOrder',
    required: false,
    index: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerEmail: {
    type: String,
  },
  customerAddress: {
    type: String,
    default: 'N/A',
  },
  customerPhone: {
    type: String,
    required: true,
  },
  product: {
    type: String,
    required: true,
  },
  // Customer requested quantity (from Manager request)
  requestedQuantity: {
    type: Number,
    required: true,
    default: 0,
  },
  // Warehouse available quantity
  availableQuantity: {
    type: Number,
    default: 0,
  },
  // Final deliverable quantity (after warehouse comparison)
  deliverableQuantity: {
    type: Number,
    default: 0,
  },
  deliveryDate: {
    type: Date,
    required: false,
  },
  // DC status transitions: created -> po_submitted -> sent_to_manager -> pending_dc -> warehouse_processing -> completed/hold
  // scheduled_for_later: Used for Term 2 DCs when DC is split by terms
  status: {
    type: String,
    enum: ['created', 'po_submitted', 'sent_to_manager', 'pending_dc', 'warehouse_processing', 'completed', 'hold', 'scheduled_for_later'],
    default: 'created',
    index: true,
  },
  // Purchase Order photo URL (image file)
  poPhotoUrl: {
    type: String,
  },
  // Purchase Order document URL (legacy field for backward compatibility)
  poDocument: {
    type: String,
  },
  // Admin who reviewed and approved PO
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Manager who raised quantity request
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Warehouse employee who processed the DC
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Delivery notes and proof
  deliveryNotes: {
    type: String,
  },
  // Timestamp when DC was listed (available quantity > deliverable quantity)
  listedAt: {
    type: Date,
  },
  deliveryProof: {
    type: String,
  },
  deliveredAt: {
    type: Date,
  },
  // Timestamps for tracking journey
  poSubmittedAt: {
    type: Date,
  },
  adminReviewedAt: {
    type: Date,
  },
  sentToManagerAt: {
    type: Date,
  },
  managerRequestedAt: {
    type: Date,
  },
  warehouseProcessedAt: {
    type: Date,
  },
  deliverySubmittedAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  // Legacy timestamps for backward compatibility
  submittedAt: {
    type: Date,
  },
  warehouseRequestedAt: {
    type: Date,
  },
  holdReason: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Track who processed at each stage
  poSubmittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  adminReviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  managerRequestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  warehouseProcessedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  deliverySubmittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Legacy fields for backward compatibility
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // DC form fields
  dcDate: {
    type: Date,
  },
  dcRemarks: {
    type: String,
  },
  dcCategory: {
    type: String,
  },
  dcNotes: {
    type: String,
  },
  // Transport and delivery fields
  transport: {
    type: String,
  },
  lrNo: {
    type: String,
  },
  lrDate: {
    type: Date,
  },
  lrCost: {
    type: String,
  },
  boxes: {
    type: String,
  },
  transportArea: {
    type: String,
  },
  deliveryStatus: {
    type: String,
    enum: ['Pending', 'In Transit', 'Delivered', 'Completed'],
  },
  financeRemarks: {
    type: String,
  },
  splApproval: {
    type: String,
  },
  smeRemarks: {
    type: String,
  },
  // Product details array for detailed product breakdown
  productDetails: [{
    product: {
      type: String,
    },
    class: {
      type: String,
    },
    category: {
      type: String,
    },
    productCategory: {
      type: String,
      enum: ['Hot', 'Warm', 'Visit Again', 'Not Met Management', 'Not Interested'],
    },
    productName: {
      type: String,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    deliveredQuantity: {
      type: Number,
      default: 0,
    },
    shortageQuantity: {
      type: Number,
      default: 0,
    },
    strength: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    level: {
      type: String,
      default: 'L2',
    },
    specs: {
      type: String,
      default: 'Regular',
    },
    subject: {
      type: String,
    },
    term: {
      type: String,
      enum: ['Term 1', 'Term 2', 'Both'],
      default: 'Term 1',
    },
  }],
  // Location tracking for mobile app
  latitude: {
    type: Number,
  },
  longitude: {
    type: Number,
  },
  // Attendance record linked to this DC
  attendanceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
  },
  // DC code for unique identification
  dc_code: {
    type: String,
    unique: true,
    sparse: true,
  },
  // Cluster ID to group related DCs (for split DCs)
  clusterId: {
    type: String,
  },
  // Explicit parent-child linking for shortage/re-issue flows
  parentDcId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DC',
    index: true,
  },
  // Distinguish regular DCs from shortage follow-ups
  dcType: {
    type: String,
    enum: ['normal', 'shortage'],
    default: 'normal',
    index: true,
  },
  // Tracks whether fulfillment needed/used shortage follow-up DCs
  fulfillmentStatus: {
    type: String,
    enum: ['full', 'partial', 'completed_via_shortage'],
    default: 'full',
    index: true,
  },
}, {
  timestamps: true,
});

// Index for efficient queries by status and employee
dcSchema.index({ status: 1, employeeId: 1 });
dcSchema.index({ employeeId: 1 }); // Single index for queries filtering only by employeeId
dcSchema.index({ saleId: 1 });
dcSchema.index({ dcOrderId: 1 });
dcSchema.index({ employeeId: 1, createdAt: -1 }); // Compound index for sorting by createdAt
dcSchema.index({ clusterId: 1 }); // Index for cluster ID queries
dcSchema.index({ parentDcId: 1 });
dcSchema.index({ dcType: 1, status: 1 });

// Pre-save hook to generate DC code if not provided
dcSchema.pre('save', async function (next) {
  if (!this.dc_code && this.isNew) {
    // Generate unique DC code: DC-{timestamp}-{random}
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.dc_code = `DC-${timestamp}-${random}`;
  }
  next();
});

// Ensure at least one of saleId or dcOrderId is provided (only on creation)
dcSchema.pre('validate', function(next) {
  // Only validate on new documents, not on updates
  if (this.isNew && !this.saleId && !this.dcOrderId) {
    return next(new Error('Either saleId or dcOrderId must be provided'));
  }
  next();
});

module.exports = mongoose.model('DC', dcSchema);
