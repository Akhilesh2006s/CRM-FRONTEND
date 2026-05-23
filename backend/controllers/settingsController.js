const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const AppSettings = require('../models/AppSettings');
const User = require('../models/User');
const Product = require('../models/Product');
const Lead = require('../models/Lead');
const ContactQuery = require('../models/ContactQuery');
const Zone = require('../models/Zone');

const SETTINGS_KEY = 'global';
const BACKUP_DIR = path.join(__dirname, '../uploads/backups');
const UPLOAD_DIR = path.join(__dirname, '../uploads/dashboard-data');

const ensureDirs = () => {
  [BACKUP_DIR, UPLOAD_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
};
ensureDirs();

async function getOrCreateSettings() {
  let doc = await AppSettings.findOne({ key: SETTINGS_KEY });
  if (!doc) {
    doc = await AppSettings.create({ key: SETTINGS_KEY });
  }
  return doc;
}

function maskApiKey(key) {
  if (!key || key.length < 4) return key ? '****' : '';
  return `${'*'.repeat(Math.max(0, key.length - 4))}${key.slice(-4)}`;
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDirs();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(csv|xlsx|xls|json)$/i;
    if (allowed.test(file.originalname || '')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, Excel, or JSON files are allowed'));
    }
  },
});

const getSmsSettings = async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json({
      senderId: doc.sms?.senderId || '',
      apiKey: doc.sms?.apiKey || '',
      apiKeyMasked: maskApiKey(doc.sms?.apiKey || ''),
      template: doc.sms?.template || '',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateSmsSettings = async (req, res) => {
  try {
    const { senderId, apiKey, template } = req.body;
    if (!senderId || !String(senderId).trim()) {
      return res.status(400).json({ message: 'Sender ID is required' });
    }
    if (!apiKey || !String(apiKey).trim()) {
      return res.status(400).json({ message: 'API Key is required' });
    }

    const doc = await getOrCreateSettings();
    doc.sms = {
      senderId: String(senderId).trim(),
      apiKey: String(apiKey).trim(),
      template: String(template || '').trim(),
    };
    doc.updatedBy = req.user._id;
    await doc.save();

    res.json({
      message: 'SMS settings saved',
      senderId: doc.sms.senderId,
      apiKeyMasked: maskApiKey(doc.sms.apiKey),
      template: doc.sms.template,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const listUploads = async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const uploads = (doc.uploads || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((u) => ({
        _id: u._id,
        fileName: u.fileName,
        originalName: u.originalName,
        description: u.description,
        dataType: u.dataType,
        filePath: u.filePath,
        uploadedByName: u.uploadedByName,
        createdAt: u.createdAt,
      }));
    res.json(uploads);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const uploadDashboardData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const description = (req.body.description || '').trim();
    const dataType = req.body.dataType || 'other';
    const allowedTypes = ['schools', 'employees', 'products', 'other'];
    const type = allowedTypes.includes(dataType) ? dataType : 'other';

    const doc = await getOrCreateSettings();
    const filePath = `/uploads/dashboard-data/${req.file.filename}`;

    doc.uploads.push({
      fileName: req.file.filename,
      originalName: req.file.originalname,
      description,
      dataType: type,
      filePath,
      uploadedBy: req.user._id,
      uploadedByName: req.user.name || req.user.email,
    });
    doc.updatedBy = req.user._id;
    await doc.save();

    const entry = doc.uploads[doc.uploads.length - 1];

    res.status(201).json({
      message: 'File uploaded successfully',
      upload: {
        _id: entry._id,
        fileName: entry.fileName,
        originalName: entry.originalName,
        description: entry.description,
        dataType: entry.dataType,
        filePath: entry.filePath,
        uploadedByName: entry.uploadedByName,
        createdAt: entry.createdAt,
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Upload failed' });
  }
};

const getBackupSettings = async (req, res) => {
  try {
    ensureDirs();
    const doc = await getOrCreateSettings();
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          fileName: f,
          size: stat.size,
          createdAt: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      notificationEmail: doc.backup?.notificationEmail || '',
      schedule: doc.backup?.schedule || '',
      lastRunAt: doc.backup?.lastRunAt,
      lastBackupFile: doc.backup?.lastBackupFile || '',
      files,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateBackupSettings = async (req, res) => {
  try {
    const email = (req.body.email || req.body.notificationEmail || '').trim();
    const schedule = (req.body.schedule || '').trim();

    if (!email) {
      return res.status(400).json({ message: 'Notification email is required' });
    }

    const doc = await getOrCreateSettings();
    if (!doc.backup) doc.backup = {};
    doc.backup.notificationEmail = email;
    doc.backup.schedule = schedule;
    doc.markModified('backup');
    doc.updatedBy = req.user._id;
    await doc.save();

    res.json({
      message: 'Backup settings saved',
      notificationEmail: doc.backup.notificationEmail,
      schedule: doc.backup.schedule,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const runBackup = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database not connected' });
    }

    ensureDirs();

    const [users, products, leads, contactQueries, zones] = await Promise.all([
      User.find().select('-password').lean(),
      Product.find().lean(),
      Lead.find().lean(),
      ContactQuery.find().lean(),
      Zone.find().lean(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      collections: {
        users: users.length,
        products: products.length,
        leads: leads.length,
        contactQueries: contactQueries.length,
        zones: zones.length,
      },
      data: { users, products, leads, contactQueries, zones },
    };

    const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const fullPath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf8');

    const doc = await getOrCreateSettings();
    if (!doc.backup) doc.backup = {};
    doc.backup.lastRunAt = new Date();
    doc.backup.lastBackupFile = fileName;
    doc.markModified('backup');
    doc.updatedBy = req.user._id;
    await doc.save();

    res.status(201).json({
      message: 'Backup created successfully',
      fileName,
      downloadPath: `/api/settings/backup/download/${encodeURIComponent(fileName)}`,
    });
  } catch (e) {
    res.status(500).json({ message: e.message || 'Backup failed' });
  }
};

const getExpensePolicyAdmin = async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    const expense = doc.expense || {};
    res.json({
      skipFinanceStage: Boolean(expense.skipFinanceStage),
      foodBillMandatoryAbove: Number(expense.foodBillMandatoryAbove) || 500,
      requireTicketForModes: Array.isArray(expense.requireTicketForModes)
        ? expense.requireTicketForModes
        : ['Bus', 'Train', 'Flight', 'Other'],
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const updateExpensePolicyAdmin = async (req, res) => {
  try {
    const { skipFinanceStage, foodBillMandatoryAbove, requireTicketForModes } = req.body;
    const doc = await getOrCreateSettings();
    doc.expense = {
      skipFinanceStage: Boolean(skipFinanceStage),
      foodBillMandatoryAbove: Math.max(0, Number(foodBillMandatoryAbove) || 500),
      requireTicketForModes: Array.isArray(requireTicketForModes)
        ? requireTicketForModes.filter(Boolean)
        : ['Bus', 'Train', 'Flight', 'Other'],
    };
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json(doc.expense);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const downloadBackup = async (req, res) => {
  try {
    const fileName = path.basename(req.params.filename || '');
    if (!fileName || !fileName.endsWith('.json')) {
      return res.status(400).json({ message: 'Invalid backup file' });
    }

    const fullPath = path.join(BACKUP_DIR, fileName);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }

    res.download(fullPath, fileName);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  getSmsSettings,
  updateSmsSettings,
  listUploads,
  uploadDashboardData,
  uploadMiddleware,
  getBackupSettings,
  updateBackupSettings,
  runBackup,
  downloadBackup,
  getExpensePolicyAdmin,
  updateExpensePolicyAdmin,
};
