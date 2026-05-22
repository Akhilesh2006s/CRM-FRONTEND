const mongoose = require('mongoose');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mockDataService = require('../services/mockDataService');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, department } = req.body;
    const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'amenityforge@gmail.com')
      .split(',')
      .map((s) => s.trim().toLowerCase())

    // Check if database is available
    if (mongoose.connection.readyState === 1) {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: superAdminEmails.includes(String(email).toLowerCase()) ? 'Super Admin' : (role || 'Executive'),
      phone,
      department,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
      }
    } else {
      // Use mock data service
      const userExists = await mockDataService.findUser({ email });

      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

    const user = await mockDataService.createUser({
        name,
        email,
        password: await bcrypt.hash(password, 10),
      role: superAdminEmails.includes(String(email).toLowerCase()) ? 'Super Admin' : (role || 'Executive'),
        phone,
        department,
      });

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (mongoose.connection.readyState === 1) {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      // Ensure special admin emails have correct role
      const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'amenityforge@gmail.com')
        .split(',')
        .map((s) => s.trim().toLowerCase())
      if (superAdminEmails.includes(String(email).toLowerCase()) && user.role !== 'Super Admin') {
        user.role = 'Super Admin'
      }
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles || [],
        hasCompletedFirstTimeSetup: user.hasCompletedFirstTimeSetup || false,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      // Use mock data service
      const user = await mockDataService.findUser({ email });

      if (user && (await bcrypt.compare(password, user.password))) {
        const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || 'amenityforge@gmail.com')
          .split(',')
          .map((s) => s.trim().toLowerCase())
        if (superAdminEmails.includes(String(email).toLowerCase()) && user.role !== 'Super Admin') {
          user.role = 'Super Admin'
        }
        // Update last login
        await mockDataService.updateUser(user._id, { lastLogin: new Date() });

        res.json({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          roles: user.roles || [],
          hasCompletedFirstTimeSetup: user.hasCompletedFirstTimeSetup || false,
          token: generateToken(user._id),
        });
      } else {
        res.status(401).json({ message: 'Invalid email or password' });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
    } else {
      // Use mock data service
      const user = await mockDataService.findUser({ _id: req.user._id });
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } else {
        res.status(404).json({ message: 'User not found' });
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Firebase login
// @route   POST /api/auth/firebase-login
// @access  Public
const firebaseLogin = async (req, res) => {
  try {
    const { firebaseUID, email, name } = req.body;

    let user = await User.findOne({ firebaseUID });

    if (!user) {
      // Create user if doesn't exist
      user = await User.create({
        firebaseUID,
        email,
        name,
        role: 'Executive',
      });
    }

    user.lastLogin = new Date();
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change password for logged-in user
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const valid = await user.comparePassword(oldPassword);
    if (!valid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getMe,
  firebaseLogin,
  changePassword,
};

