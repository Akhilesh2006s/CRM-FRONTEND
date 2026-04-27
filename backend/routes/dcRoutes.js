const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getDCs,
  getDC,
  raiseDC,
  requestWarehouse,
  warehouseSubmit,
  deliverySubmit,
  completeDC,
  holdDC,
  getPendingDCs,
  getWarehouseDCs,
  getEmployeeDCs,
  getCompletedDCs,
  getHoldDCs,
  employeeStats,
  submitPO,
  adminReviewPO,
  managerRequestWarehouse,
  warehouseProcess,
  getPOSubmittedDCs,
  getSentToManagerDCs,
  getPendingWarehouseDCs,
  getMyDCs,
  recordShortageDC,
  updateDC,
  submitDCToManager,
  exportSalesVisit,
  uploadPO,
  uploadPOMiddleware,
} = require('../controllers/dcController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get all DCs with filtering
router.get('/', authMiddleware, getDCs);
router.get('/export-sales-visit', authMiddleware, exportSalesVisit);

// Status-specific endpoints (new workflow)
router.get('/po-submitted', authMiddleware, getPOSubmittedDCs);
router.get('/sent-to-manager', authMiddleware, getSentToManagerDCs);
router.get('/pending-warehouse', authMiddleware, getPendingWarehouseDCs);
router.get('/employee/my', authMiddleware, getMyDCs);

// Status-specific endpoints (legacy)
router.get('/pending', authMiddleware, getPendingDCs);
router.get('/warehouse', authMiddleware, getWarehouseDCs);
router.get('/employee', authMiddleware, getEmployeeDCs);
router.get('/completed', authMiddleware, getCompletedDCs);
router.get('/hold', authMiddleware, getHoldDCs);

// Stats
router.get('/stats/employee', authMiddleware, employeeStats);

// File upload - must be before /:id routes to avoid route conflicts
router.post('/upload-po', authMiddleware, (req, res, next) => {
  uploadPOMiddleware(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size exceeds 5MB limit' });
        }
        return res.status(400).json({ message: err.message });
      }
      // Handle other errors
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, uploadPO);

// New workflow actions
router.post('/:id/submit-po', authMiddleware, submitPO);
router.post('/:id/admin-review', authMiddleware, adminReviewPO);
router.post('/:id/manager-request', authMiddleware, managerRequestWarehouse);
router.post('/:id/warehouse-process', authMiddleware, warehouseProcess);
router.post('/:id/submit-to-manager', authMiddleware, submitDCToManager);
router.post('/:id/record-shortage', authMiddleware, recordShortageDC);

// Legacy actions
router.post('/raise', authMiddleware, raiseDC);
router.post('/:id/request-warehouse', authMiddleware, requestWarehouse);
router.post('/:id/warehouse-submit', authMiddleware, warehouseSubmit);
router.post('/:id/delivery-submit', authMiddleware, deliverySubmit);
router.post('/:id/complete', authMiddleware, completeDC);
router.post('/:id/hold', authMiddleware, holdDC);

// Update DC
router.put('/:id', authMiddleware, updateDC);

// Get single DC
router.get('/:id', authMiddleware, getDC);

module.exports = router;

