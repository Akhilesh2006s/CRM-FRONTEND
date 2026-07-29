const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Get active products (public endpoint for use throughout the app)
router.get('/active', productController.getActiveProducts);

// All other routes require authentication
router.use(authMiddleware);

// Get all products (admin only)
router.get('/', requirePermission('products.list.page.view'), productController.list);

router.get('/:id', requirePermission('products.list.page.view'), productController.getOne);

router.post('/', requirePermission('products.new.page.view'), productController.create);

router.put('/:id', requirePermission('products.new.page.view'), productController.update);

router.delete('/:id', requirePermission('products.new.page.view'), productController.remove);

module.exports = router;

