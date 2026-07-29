const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/permissionMiddleware');
const {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  updateRolePermissions,
  listPermissionsCatalog,
  assignUserRole,
} = require('../controllers/roleController');

router.use(authMiddleware);
router.use(requireSuperAdmin());

router.get('/permissions/catalog', listPermissionsCatalog);
router.get('/', listRoles);
router.post('/', createRole);
router.get('/:id/permissions', getRolePermissions);
router.put('/:id/permissions', updateRolePermissions);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
