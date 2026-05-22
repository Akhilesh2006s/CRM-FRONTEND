const mongoose = require('mongoose');
const EmpDC = require('../models/EmpDC');

const create = async (req, res) => {
  try {
    const { employee_id, kit_type, distribution_date, expected_return_date } = req.body;

    if (!employee_id) {
      return res.status(400).json({ message: 'Employee is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(employee_id)) {
      return res.status(400).json({ message: 'Invalid employee. Please select an employee from the list.' });
    }
    if (!distribution_date) {
      return res.status(400).json({ message: 'Distribution date is required' });
    }
    const distDate = new Date(distribution_date);
    if (Number.isNaN(distDate.getTime())) {
      return res.status(400).json({ message: 'Invalid distribution date' });
    }
    const validKitTypes = ['Sales', 'Training', 'Field'];
    if (!kit_type || !validKitTypes.includes(kit_type)) {
      return res.status(400).json({ message: 'Invalid kit type' });
    }

    const payload = {
      employee_id,
      kit_type,
      distribution_date: distDate,
      created_by: req.user._id,
    };

    if (expected_return_date) {
      const returnDate = new Date(expected_return_date);
      if (Number.isNaN(returnDate.getTime())) {
        return res.status(400).json({ message: 'Invalid expected return date' });
      }
      payload.expected_return_date = returnDate;
    }

    const item = await EmpDC.create(payload);
    const populated = await EmpDC.findById(item._id).populate('employee_id', 'name email');
    res.status(201).json(populated);
  } catch (e) {
    if (e.name === 'ValidationError') {
      return res.status(400).json({ message: e.message });
    }
    if (e.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid data provided. Please check employee and dates.' });
    }
    res.status(500).json({ message: e.message || 'Failed to create EMP DC' });
  }
};

const list = async (req, res) => {
  try {
    const items = await EmpDC.find({}).populate('employee_id', 'name email').sort({ createdAt: -1 });
    res.json(items);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getOne = async (req, res) => {
  try {
    const item = await EmpDC.findById(req.params.id).populate('employee_id', 'name email');
    if (!item) return res.status(404).json({ message: 'EMP DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const markReturned = async (req, res) => {
  try {
    const item = await EmpDC.findByIdAndUpdate(
      req.params.id,
      { status: 'returned' },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'EMP DC not found' });
    res.json(item);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { create, list, getOne, markReturned };
