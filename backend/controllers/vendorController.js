const User = require('../models/User');
const Product = require('../models/Product');

const PARTNER_ROLES = ['Partner', 'Vendor'];

// List all partners (include legacy Vendor role for existing records)
const list = async (req, res) => {
  try {
    const partners = await User.find({ role: { $in: PARTNER_ROLES } })
      .select('-password')
      .populate('partnerAssignedProducts', 'productName')
      .populate('vendorAssignedProducts', 'productName')
      .sort({ createdAt: -1 });

    const normalized = partners.map((p) => {
      const doc = p.toObject();
      if (!doc.partnerAssignedProducts?.length && doc.vendorAssignedProducts?.length) {
        doc.partnerAssignedProducts = doc.vendorAssignedProducts;
      }
      return doc;
    });

    res.json(normalized);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Create partner
const create = async (req, res) => {
  try {
    const { name, email, password, assignedProducts } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Partner name is required' });
    }
    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Partner email is required' });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ message: 'Partner password is required' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const productIds = Array.isArray(assignedProducts) ? assignedProducts.filter(Boolean) : [];
    if (productIds.length === 0) {
      return res.status(400).json({ message: 'At least one product must be assigned to the partner' });
    }

    const products = await Product.find({ _id: { $in: productIds } });
    if (products.length !== productIds.length) {
      return res.status(400).json({ message: 'One or more selected products are invalid' });
    }

    const userExists = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (userExists) {
      return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
    }

    const partner = await User.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
      role: 'Partner',
      partnerAssignedProducts: productIds,
      isActive: true,
    });

    const populated = await User.findById(partner._id)
      .select('-password')
      .populate('partnerAssignedProducts', 'productName');
    res.status(201).json(populated);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(400).json({ message: 'Email already exists. Please use a different email.' });
    }
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map((err) => err.message).join('. ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: e.message });
  }
};

// Get single partner
const getOne = async (req, res) => {
  try {
    const partner = await User.findOne({
      _id: req.params.id,
      role: { $in: PARTNER_ROLES },
    })
      .select('-password')
      .populate('partnerAssignedProducts', 'productName')
      .populate('vendorAssignedProducts', 'productName');

    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    const doc = partner.toObject();
    if (!doc.partnerAssignedProducts?.length && doc.vendorAssignedProducts?.length) {
      doc.partnerAssignedProducts = doc.vendorAssignedProducts;
    }
    res.json(doc);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update partner products
const updateProducts = async (req, res) => {
  try {
    const { assignedProducts } = req.body;
    const partnerId = req.params.id;

    const partner = await User.findOne({ _id: partnerId, role: { $in: PARTNER_ROLES } });
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    if (assignedProducts !== undefined) {
      const productIds = Array.isArray(assignedProducts) ? assignedProducts.filter(Boolean) : [];

      if (productIds.length === 0) {
        return res.status(400).json({ message: 'At least one product must be assigned to the partner' });
      }

      const products = await Product.find({ _id: { $in: productIds } });
      if (products.length !== productIds.length) {
        return res.status(400).json({ message: 'One or more selected products are invalid' });
      }

      partner.role = 'Partner';
      partner.partnerAssignedProducts = productIds;
      partner.vendorAssignedProducts = productIds;
      await partner.save();
    }

    const updated = await User.findById(partnerId)
      .select('-password')
      .populate('partnerAssignedProducts', 'productName');
    res.json(updated);
  } catch (e) {
    if (e.name === 'ValidationError') {
      const messages = Object.values(e.errors).map((err) => err.message).join('. ');
      return res.status(400).json({ message: messages });
    }
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  list,
  create,
  getOne,
  updateProducts,
};
