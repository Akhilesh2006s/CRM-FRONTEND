const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  getEmployeeLeaves,
  resetEmployeePassword,
  resetEmployeeDevice,
  getEmployeeTracking,
  exportEmployeeTracking,
  uploadEmployeeFile,
  uploadEmployeeFileMiddleware,
  submitEmployeeApproval,
  getPendingVerifications,
} = require('../controllers/employeeController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { requirePermission, requirePermissionWhen } = require('../middleware/permissionMiddleware');

router.get('/', authMiddleware, getEmployees);
router.get('/tracking', authMiddleware, getEmployeeTracking);
router.get('/tracking/export', authMiddleware, exportEmployeeTracking);
router.get('/verification/pending', authMiddleware, getPendingVerifications);
router.post(
  '/upload',
  authMiddleware,
  uploadEmployeeFileMiddleware,
  uploadEmployeeFile
);
router.post('/create', authMiddleware, requirePermission('employees.active.add'), createEmployee);
router.post('/:id/approvals', authMiddleware, submitEmployeeApproval);
router.get('/:id', authMiddleware, getEmployee);
router.get('/:id/leaves', authMiddleware, getEmployeeLeaves);
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
router.put(
  '/:id/reset-device',
  authMiddleware,
  roleMiddleware('Admin', 'Super Admin'),
  resetEmployeeDevice
);

module.exports = router;
