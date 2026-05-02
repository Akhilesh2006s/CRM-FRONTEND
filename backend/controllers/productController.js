const Product = require('../models/Product');

// Get all products (filtered by status if provided)
const list = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    
    // If status is provided, filter by it
    if (status !== undefined) {
      filter.prodStatus = Number(status);
    }
    
    const products = await Product.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(products);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Get single product
const getOne = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Create new product
const create = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      createdBy: req.user._id,
    };
    
    // Validate required fields
    if (!payload.productName) {
      return res.status(400).json({ message: 'Product name is required' });
    }
    
    // If hasSubjects is true, ensure subjects array is provided
    if (payload.hasSubjects && (!payload.subjects || payload.subjects.length === 0)) {
      return res.status(400).json({ message: 'Subjects are required when hasSubjects is true' });
    }
    
    // If hasSpecs is true, ensure specs array is provided and not empty
    if (payload.hasSpecs && (!payload.specs || !Array.isArray(payload.specs) || payload.specs.length === 0)) {
      return res.status(400).json({ message: 'At least one spec is required when hasSpecs is true' });
    }
    
    // Ensure specs is always an array (convert if needed for backward compatibility)
    if (payload.specs && !Array.isArray(payload.specs)) {
      payload.specs = [payload.specs];
    }
    
    // If hasCategory is true, ensure categories array is provided
    if (payload.hasCategory && (!payload.categories || !Array.isArray(payload.categories) || payload.categories.length === 0)) {
      return res.status(400).json({ message: 'At least one product category is required when hasCategory is true' });
    }
    
    // Ensure categories is always an array
    if (payload.categories && !Array.isArray(payload.categories)) {
      payload.categories = [payload.categories];
    }

    const allowedCalc = new Set(['none', 'level_based', 'subject_based']);
    if (payload.calculationType != null) {
      const ct = String(payload.calculationType);
      if (!allowedCalc.has(ct)) {
        return res.status(400).json({ message: 'Invalid calculationType' });
      }
      payload.calculationType = ct;
    }
    if (payload.calculationType === 'subject_based' && !payload.hasSubjects) {
      return res.status(400).json({ message: 'subject_based requires hasSubjects to be true' });
    }
    if (payload.calculationType === 'level_based' && (!payload.productLevels || payload.productLevels.length === 0)) {
      return res.status(400).json({ message: 'level_based requires at least one product level' });
    }
    
    const product = await Product.create(payload);
    
    const populated = await Product.findById(product._id)
      .populate('createdBy', 'name email');
    
    res.status(201).json(populated);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ message: 'Product name already exists' });
    }
    res.status(500).json({ message: e.message });
  }
};

// Update product
const update = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Update fields
    const updateData = {};
    const fieldsToUpdate = [
      'productName',
      'productLevels',
      'hasSubjects',
      'subjects',
      'hasSpecs',
      'specs',
      'hasCategory',
      'categories',
      'prodStatus',
      'calculationType',
    ];
    
    fieldsToUpdate.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const allowedCalc = new Set(['none', 'level_based', 'subject_based']);
    if (updateData.calculationType !== undefined) {
      if (!allowedCalc.has(String(updateData.calculationType))) {
        return res.status(400).json({ message: 'Invalid calculationType' });
      }
    }
    const nextCalc =
      updateData.calculationType !== undefined ? String(updateData.calculationType) : String(product.calculationType || 'none');
    const nextHasSubjects =
      updateData.hasSubjects !== undefined ? updateData.hasSubjects : product.hasSubjects;
    const nextLevels =
      updateData.productLevels !== undefined ? updateData.productLevels : product.productLevels;
    if (nextCalc === 'subject_based' && !nextHasSubjects) {
      return res.status(400).json({ message: 'subject_based requires hasSubjects to be true' });
    }
    const levelsArr = Array.isArray(nextLevels) ? nextLevels : [];
    if (nextCalc === 'level_based' && levelsArr.length === 0) {
      return res.status(400).json({ message: 'level_based requires at least one product level' });
    }
    
    // Validate if hasSubjects is true, subjects must be provided
    if (updateData.hasSubjects && (!updateData.subjects || updateData.subjects.length === 0)) {
      // If subjects not in updateData, check existing product
      if (!updateData.subjects && (!product.subjects || product.subjects.length === 0)) {
        return res.status(400).json({ message: 'Subjects are required when hasSubjects is true' });
      }
    }
    
    // Handle specs - ensure it's always an array
    if (updateData.specs !== undefined) {
      // Convert to array if it's not already
      if (!Array.isArray(updateData.specs)) {
        updateData.specs = [updateData.specs];
      }
      // Validate if hasSpecs is true, specs must be provided
      if (updateData.hasSpecs !== undefined && updateData.hasSpecs) {
        if (updateData.specs.length === 0) {
          return res.status(400).json({ message: 'At least one spec is required when hasSpecs is true' });
        }
      }
      // Specs can be any custom values - no validation needed (like subjects)
    } else if (updateData.hasSpecs !== undefined && updateData.hasSpecs) {
      // If hasSpecs is being set to true but specs not provided, check existing
      const existingSpecs = product.specs || [];
      const specsArray = Array.isArray(existingSpecs) ? existingSpecs : (existingSpecs ? [existingSpecs] : []);
      if (specsArray.length === 0) {
        return res.status(400).json({ message: 'At least one spec is required when hasSpecs is true' });
      }
    }
    
    // Handle categories - ensure it's always an array
    if (updateData.categories !== undefined) {
      // Convert to array if it's not already
      if (!Array.isArray(updateData.categories)) {
        updateData.categories = [updateData.categories];
      }
      // Validate if hasCategory is true, categories must be provided
      if (updateData.hasCategory !== undefined && updateData.hasCategory) {
        if (updateData.categories.length === 0) {
          return res.status(400).json({ message: 'At least one product category is required when hasCategory is true' });
        }
      }
    } else if (updateData.hasCategory !== undefined && updateData.hasCategory) {
      // If hasCategory is being set to true but categories not provided, check existing
      const existingCategories = product.categories || [];
      const categoriesArray = Array.isArray(existingCategories) ? existingCategories : (existingCategories ? [existingCategories] : []);
      if (categoriesArray.length === 0) {
        return res.status(400).json({ message: 'At least one product category is required when hasCategory is true' });
      }
    }
    
    // Update the product directly to avoid casting issues
    Object.keys(updateData).forEach(key => {
      product[key] = updateData[key];
    });
    
    // Validate before saving
    await product.validate();
    
    // Save the product
    await product.save();
    
    const updatedProduct = await Product.findById(product._id)
      .populate('createdBy', 'name email');
    
    res.json(updatedProduct);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ message: 'Product name already exists' });
    }
    // Provide more detailed error message
    console.error('Product update error:', e);
    res.status(500).json({ 
      message: e.message || 'Failed to update product',
      error: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
};

// Delete product
const remove = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Get active products only (for use throughout the application)
const getActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({ prodStatus: 1 })
      .select('productName productLevels hasSubjects subjects hasSpecs specs hasCategory categories calculationType')
      .sort({ productName: 1 });
    
    res.json(products);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  getActiveProducts,
};

