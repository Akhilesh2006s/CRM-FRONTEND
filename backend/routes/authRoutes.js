const express = require('express');
const router = express.Router();
const { register, login, getMe, firebaseLogin, changePassword } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/firebase-login', firebaseLogin);
router.get('/me', authMiddleware, getMe);
router.put('/change-password', authMiddleware, changePassword);

module.exports = router;

