const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  getExpenses,
  getExpense,
  createExpense,
  createExpenseBatch,
  calculateRouteDistance,
  getExpensePolicySettings,
  resubmitExpense,
  approveExpense,
  getManagerPendingExpenses,
  getExecutiveManagerPendingExpenses,
  getFinancePendingExpenses,
  getExpensesByEmployee,
  approveMultipleExpenses,
  getExpensesReport,
  exportExpenses,
  updateExpense,
  uploadExpenseBill,
  uploadExpenseBillMiddleware,
  uploadExpenseBillSingleMiddleware,
} = require('../controllers/expenseController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Specific routes must come before parameterized routes
router.get('/', authMiddleware, getExpenses);
router.get('/manager-pending', authMiddleware, getManagerPendingExpenses);
router.get('/executive-manager-pending', authMiddleware, getExecutiveManagerPendingExpenses);
router.get('/finance-pending', authMiddleware, getFinancePendingExpenses);
router.get('/report', authMiddleware, getExpensesReport);
router.get('/export', authMiddleware, exportExpenses);
router.get('/employee/:employeeId', authMiddleware, getExpensesByEmployee);
router.get('/policy', authMiddleware, getExpensePolicySettings);
router.post('/calculate-distance', authMiddleware, calculateRouteDistance);
router.post('/create-batch', authMiddleware, createExpenseBatch);
// File upload - must be before /:id routes to avoid route conflicts
router.post('/upload-bill', authMiddleware, (req, res, next) => {
  uploadExpenseBillSingleMiddleware(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
        }
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, uploadExpenseBill);
router.post('/create', authMiddleware, (req, res, next) => {
  uploadExpenseBillMiddleware(req, res, (err) => {
    if (err) {
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
        }
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, createExpense);
router.post(
  '/approve-multiple',
  authMiddleware,
  requirePermission('expenses.pending.page.view', 'expenses.finance_pending.page.view'),
  approveMultipleExpenses
);
router.put('/:id/resubmit', authMiddleware, (req, res, next) => {
  uploadExpenseBillMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    next();
  });
}, resubmitExpense);
router.put(
  '/:id/approve',
  authMiddleware,
  requirePermission('expenses.pending.page.view', 'expenses.finance_pending.page.view'),
  approveExpense
);
// Parameterized routes must come last
router.get('/:id', authMiddleware, getExpense);
router.put('/:id', authMiddleware, updateExpense);

module.exports = router;

