const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireSuperAdmin } = require('../middleware/permissionMiddleware');
const { assignUserRole } = require('../controllers/roleController');

router.put('/:id/role', authMiddleware, requireSuperAdmin(), assignUserRole);

module.exports = router;
