const express = require('express');
const router = express.Router();
const { getTownFromPincode, resolveLocation } = require('../controllers/locationController');

router.get('/get-town', getTownFromPincode);
router.get('/resolve', resolveLocation);

module.exports = router;

