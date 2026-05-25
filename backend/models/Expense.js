const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: [
        'travel',
        'food',
        'accommodation',
        'other',
        'Travel',
        'Food',
        'Accommodation',
        'others',
        'Other',
        'Others',
      ],
      required: true,
    },
    expItemId: { type: String },
    submissionBatchId: { type: String, index: true },

    gpsDistance: { type: Number, default: 0 },
    gpsProvider: { type: String, enum: ['google', 'manual', 'none', ''], default: '' },
    gpsCalculatedAt: { type: Date },

    employeeRemarks: { type: String },
    managerRemarks: { type: String },
    amount: { type: Number, required: true, min: 0 },
    employeeAmount: { type: Number, min: 0 },
    approvedAmount: { type: Number, min: 0 },
    date: { type: Date, default: Date.now },

    paymentMethod: {
      type: String,
      enum: ['Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Other'],
    },
    receipt: { type: String },
    ticketReceipt: { type: String },
    receiptNumber: { type: String },

    transportType: {
      type: String,
      enum: ['Bike', 'Car', 'Bus', 'Train', 'Flight', 'Auto', 'Other'],
    },
    travelFrom: { type: String },
    travelTo: { type: String },
    approxKms: { type: Number, default: 0, min: 0 },
    claimedDistanceKm: { type: Number, min: 0 },
    travelDate: { type: Date },

    lodgeName: { type: String },
    city: { type: String },
    stayDate: { type: Date },
    stayDateEnd: { type: Date },
    hotelAddress: { type: String },

    restaurantName: { type: String },
    mealDate: { type: Date },

    otherExpenseType: {
      type: String,
      enum: ['Parking', 'Toll', 'Courier', 'Printing', 'Miscellaneous', 'Other'],
    },
    expenseName: { type: String },
    otherDate: { type: Date },

    dcId: { type: String },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    department: { type: String },

    status: {
      type: String,
      enum: [
        'Pending',
        'Executive Manager Approved',
        'Manager Approved',
        'Approved',
        'Rejected',
        'Needs Correction',
      ],
      default: 'Pending',
    },
    pendingMonth: { type: String },
    rejectionReason: { type: String },
    returnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnedAt: { type: Date },

    executiveManagerApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    executiveManagerApprovedAt: { type: Date },
    managerApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    managerApprovedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Expense', expenseSchema);
