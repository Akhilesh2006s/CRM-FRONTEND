const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const multer = require('multer');
const {
  createExecutiveReturn,
  updateExecutiveReturn,
  getExecutiveReturnById,
  listExecutiveReturns,
  listMyExecutiveReturns,
  listWarehouseExecutiveQueue,
  getReturnForWarehouseExecutive,
  listWarehouseManagerQueue,
  getReturnForWarehouseManager,
  createWarehouseReturn,
  listWarehouseReturns,
  warehouseVerifyReturn,
  managerAction,
  uploadReturnPhoto,
  uploadReturnPhotoMiddleware,
} = require('../controllers/stockReturnController');

// Static paths first (before /:id)
router.post('/executive', authMiddleware, createExecutiveReturn);
router.get('/executive/list', authMiddleware, listExecutiveReturns);
router.get('/executive', authMiddleware, listExecutiveReturns);
router.get('/executive/mine', authMiddleware, listMyExecutiveReturns);

router.post('/warehouse', authMiddleware, createWarehouseReturn);
router.get('/warehouse', authMiddleware, listWarehouseReturns);

router.get('/warehouse-executive/queue', authMiddleware, listWarehouseExecutiveQueue);
router.get('/warehouse-executive/:id', authMiddleware, getReturnForWarehouseExecutive);

router.get('/warehouse-manager/queue', authMiddleware, listWarehouseManagerQueue);
router.get('/warehouse-manager/:id', authMiddleware, getReturnForWarehouseManager);

router.post('/upload-photo', authMiddleware, (req, res, next) => {
  uploadReturnPhotoMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size exceeds 5MB limit' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, uploadReturnPhoto);

router.put(
  '/:id/warehouse-verify',
  authMiddleware,
  requirePermission('returns.warehouse.verify'),
  warehouseVerifyReturn
);
router.put(
  '/:id/manager-action',
  authMiddleware,
  requirePermission('returns.warehouse.approve'),
  managerAction
);

router.get('/:id', authMiddleware, getExecutiveReturnById);
router.put('/:id', authMiddleware, updateExecutiveReturn);

module.exports = router;
