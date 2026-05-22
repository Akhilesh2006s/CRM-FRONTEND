const Warehouse = require('../models/Warehouse');
const StockMovement = require('../models/StockMovement');

// @desc    Get distinct warehouse locations (for return form dropdown)
// @route   GET /api/warehouse/locations
// @access  Private
const getWarehouseLocations = async (req, res) => {
  try {
    const locations = await Warehouse.distinct('location', { location: { $exists: true, $ne: '' } });
    res.json(locations.filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all warehouse items
// @route   GET /api/warehouse
// @access  Private
const getWarehouse = async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    const items = await Warehouse.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update stock
// @route   POST /api/warehouse/stock
// @access  Private
const updateStock = async (req, res) => {
  try {
    const { productId, quantity, movementType, reason, relatedSaleId, vendor } = req.body;

    if (movementType === 'In' && (!reason || !String(reason).trim())) {
      return res.status(400).json({ message: 'Comments are required when adding stock' });
    }

    const product = await Warehouse.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let newStock = product.currentStock;
    if (movementType === 'In') {
      newStock += quantity;
    } else if (movementType === 'Out' || movementType === 'Return') {
      newStock -= quantity;
    } else if (movementType === 'Adjustment') {
      newStock = quantity;
    }

    product.currentStock = newStock;
    if (movementType === 'In') {
      product.lastRestocked = new Date();
      if (vendor && String(vendor).trim()) {
        product.supplier = String(vendor).trim();
      }
    }
    await product.save();

    // Record stock movement
    await StockMovement.create({
      productId,
      movementType,
      quantity,
      reason,
      vendor: vendor && String(vendor).trim() ? String(vendor).trim() : undefined,
      relatedSaleId,
      createdBy: req.user._id,
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get warehouse reports
// @route   GET /api/warehouse/reports
// @access  Private
const getWarehouseReports = async (req, res) => {
  try {
    const lowStockItems = await Warehouse.find({
      status: 'Low Stock',
    });

    const outOfStockItems = await Warehouse.find({
      status: 'Out of Stock',
    });

    const totalItems = await Warehouse.countDocuments();
    const totalValue = await Warehouse.aggregate([
      {
        $project: {
          total: { $multiply: ['$currentStock', '$unitPrice'] },
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: '$total' },
        },
      },
    ]);

    res.json({
      lowStockItems,
      outOfStockItems,
      totalItems,
      totalValue: totalValue[0]?.totalValue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single warehouse item
// @route   GET /api/warehouse/:id
// @access  Private
const getWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Warehouse item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create warehouse item
// @route   POST /api/warehouse
// @access  Private
const createWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.create(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update warehouse item
// @route   PUT /api/warehouse/:id
// @access  Private
const updateWarehouseItem = async (req, res) => {
  try {
    const item = await Warehouse.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'Warehouse item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getWarehouse,
  getWarehouseLocations,
  getWarehouseItem,
  createWarehouseItem,
  updateWarehouseItem,
  updateStock,
  getWarehouseReports,
};

