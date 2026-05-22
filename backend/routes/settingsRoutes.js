const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
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
} = require('../controllers/settingsController');

const adminOnly = roleMiddleware('Admin', 'Super Admin');

router.use(authMiddleware);

router.get('/sms', adminOnly, getSmsSettings);
router.put('/sms', adminOnly, updateSmsSettings);

router.get('/uploads', adminOnly, listUploads);
router.post('/upload', adminOnly, (req, res, next) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload error' });
    }
    next();
  });
}, uploadDashboardData);

router.get('/backup', adminOnly, getBackupSettings);
router.put('/backup', adminOnly, updateBackupSettings);
router.post('/backup/run', adminOnly, runBackup);
router.get('/backup/download/:filename', adminOnly, downloadBackup);

module.exports = router;
