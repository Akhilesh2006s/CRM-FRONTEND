const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { isSuperAdminUser } = require('../utils/permissions');
const {
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
} = require('../controllers/settingsController');

const LEGACY_SETTINGS_ROLES = ['Admin', 'Super Admin'];

const settingsPage = (resource) => {
  const permissionMw = requirePermission(`settings.${resource}.page.view`);
  return (req, res, next) => {
    if (isSuperAdminUser(req.user) || LEGACY_SETTINGS_ROLES.includes(req.user?.role)) {
      return next();
    }
    return permissionMw(req, res, next);
  };
};

router.use(authMiddleware);

router.get('/sms', settingsPage('sms'), getSmsSettings);
router.put('/sms', settingsPage('sms'), updateSmsSettings);

router.get('/uploads', settingsPage('upload'), listUploads);
router.post('/upload', settingsPage('upload'), (req, res, next) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload error' });
    }
    next();
  });
}, uploadDashboardData);

router.get('/backup', settingsPage('backup'), getBackupSettings);
router.put('/backup', settingsPage('backup'), updateBackupSettings);
router.post('/backup/run', settingsPage('backup'), runBackup);
router.get('/backup/download/:filename', settingsPage('backup'), downloadBackup);

router.get('/expense-policy', settingsPage('expenses'), getExpensePolicyAdmin);
router.put('/expense-policy', settingsPage('expenses'), updateExpensePolicyAdmin);

module.exports = router;
