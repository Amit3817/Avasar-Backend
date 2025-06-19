const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { 
  registerUser,
  loginUser,
  getMe,
  getReferral,
  sendOtp,
  verifyOtp,
  resetPassword,
  checkUsernameAvailability
} = require('../controllers/authController');

const router = express.Router();

// Register new user
router.post('/register', registerUser);

// Login user
router.post('/login', loginUser);

// Get current user
router.get('/me', auth, getMe);

// Get referral info
router.get('/referral/:referralCode', getReferral);

// OTP routes
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// Reset password
router.post('/reset-password', resetPassword);

// Check username availability
router.get('/check-username', checkUsernameAvailability);

module.exports = router; 