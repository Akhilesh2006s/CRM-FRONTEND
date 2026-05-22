const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  listZoneClusters,
  createZoneCluster,
  deleteZoneCluster,
} = require('../controllers/zoneClusterController');

router.get('/', authMiddleware, listZoneClusters);
router.post('/', authMiddleware, createZoneCluster);
router.delete('/:id', authMiddleware, deleteZoneCluster);

module.exports = router;
