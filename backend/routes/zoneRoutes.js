const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const { getZones, getZoneClusters, upsertZone, deleteZone } = require('../controllers/zoneController');
const {
  listPincodeMappings,
  createPincodeMapping,
  deletePincodeMapping,
} = require('../controllers/pincodeMappingController');

router.get('/pincode-mappings', authMiddleware, listPincodeMappings);
router.post('/pincode-mappings', authMiddleware, createPincodeMapping);
router.delete('/pincode-mappings/:id', authMiddleware, deletePincodeMapping);

// Get all zones
router.get('/', authMiddleware, getZones);

// Clusters under a zone
router.get('/:id/clusters', authMiddleware, getZoneClusters);

// Create / update zone (Admin / Super Admin)
router.post('/', authMiddleware, roleMiddleware('Admin', 'Super Admin'), upsertZone);

// Delete zone (Admin / Super Admin)
router.delete('/:id', authMiddleware, roleMiddleware('Admin', 'Super Admin'), deleteZone);

module.exports = router;

