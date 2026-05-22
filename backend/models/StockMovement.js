const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Warehouse',
    required: true,
  },
  movementType: {
    type: String,
    enum: ['In', 'Out', 'Return', 'Adjustment'],
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  reason: {
    type: String,
  },
  vendor: {
    type: String,
  },
  relatedSaleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('StockMovement', stockMovementSchema);

