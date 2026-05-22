const mongoose = require('mongoose');

const uploadEntrySchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    originalName: { type: String },
    description: { type: String, trim: true },
    dataType: {
      type: String,
      enum: ['schools', 'employees', 'products', 'other'],
      default: 'other',
    },
    filePath: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByName: { type: String, trim: true },
  },
  { timestamps: true }
);

const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    sms: {
      senderId: { type: String, trim: true, default: '' },
      apiKey: { type: String, default: '' },
      template: { type: String, default: '' },
    },
    backup: {
      notificationEmail: { type: String, trim: true, default: '' },
      schedule: { type: String, trim: true, default: '' },
      lastRunAt: { type: Date },
      lastBackupFile: { type: String, trim: true },
    },
    uploads: [uploadEntrySchema],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
