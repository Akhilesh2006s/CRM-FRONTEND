const express = require('express');
const router = express.Router();
const partnerController = require('../controllers/vendorController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.use(roleMiddleware('Admin', 'Super Admin'));

router.get('/', partnerController.list);
router.post('/', partnerController.create);
router.put('/:id/products', partnerController.updateProducts);
router.get('/:id', partnerController.getOne);

module.exports = router;
