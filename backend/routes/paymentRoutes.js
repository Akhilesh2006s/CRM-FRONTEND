const express = require('express');
const router = express.Router();
const {
  getPayments,
  getPayment,
  createPayment,
  updatePayment,
  approvePayment,
  exportPayments,
} = require('../controllers/paymentController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.get('/export', authMiddleware, exportPayments);
router.get('/', authMiddleware, getPayments);
router.post('/create', authMiddleware, createPayment);
router.get('/:id', authMiddleware, getPayment);
router.put('/:id', authMiddleware, updatePayment);
router.put(
  '/:id/approve',
  authMiddleware,
  requirePermission('payments.approval_cash.page.view', 'payments.approval_cheques.page.view'),
  approvePayment
);

module.exports = router;

