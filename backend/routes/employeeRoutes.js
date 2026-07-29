const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  getEmployeeLeaves,
  resetEmployeePassword,
  getEmployeeTracking,
  exportEmployeeTracking,
} = require('../controllers/employeeController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission, requirePermissionWhen } = require('../middleware/permissionMiddleware');

router.get('/', authMiddleware, getEmployees);
router.get('/tracking', authMiddleware, getEmployeeTracking);
router.get('/tracking/export', authMiddleware, exportEmployeeTracking);
router.get('/:id', authMiddleware, getEmployee);
router.get('/:id/leaves', authMiddleware, getEmployeeLeaves);
router.post('/create', authMiddleware, requirePermission('employees.active.add'), createEmployee);
router.put(
  '/:id',
  authMiddleware,
  requirePermissionWhen(
    (req) => req.body?.isActive === false,
    'employees.active.delete'
  ),
  requirePermissionWhen(
    (req) => req.body?.isActive !== false,
    'employees.active.edit'
  ),
  updateEmployee
);
router.put('/:id/reset-password', authMiddleware, resetEmployeePassword);

module.exports = router;

