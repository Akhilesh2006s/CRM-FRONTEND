const express = require('express');
const router = express.Router();
const { getSchools, moveSchools } = require('../controllers/schoolController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getSchools);
router.post('/move', authMiddleware, roleMiddleware('Admin', 'Super Admin'), moveSchools);

module.exports = router;
