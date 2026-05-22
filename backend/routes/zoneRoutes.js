const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { listZones, createZone, deleteZone } = require('../controllers/zoneController');
const {
  listPincodeMappings,
  createPincodeMapping,
  deletePincodeMapping,
} = require('../controllers/pincodeMappingController');

router.get('/pincode-mappings', authMiddleware, listPincodeMappings);
router.post('/pincode-mappings', authMiddleware, createPincodeMapping);
router.delete('/pincode-mappings/:id', authMiddleware, deletePincodeMapping);

router.get('/', authMiddleware, listZones);
router.post('/', authMiddleware, createZone);
router.delete('/:id', authMiddleware, deleteZone);

module.exports = router;
