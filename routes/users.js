const express = require('express');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
require('dotenv').config({ path: path.join(__dirname, '../config.env') });
const { 
  getProfile,
  updateProfile,
  getTeam,
  getIncome,
  getRank,
  getSponsor,
  uploadPhoto
} = require('../controllers/userController');

const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Cloudinary storage setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'avasar-profile-photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'limit' }],
  },
});
const upload = multer({ storage });

// Get user profile
router.get('/profile', auth, getProfile);

// Update user profile
router.put('/profile', auth, updateProfile);

// Get user's team structure
router.get('/team', auth, getTeam);

// Get user's income details
router.get('/income', auth, getIncome);

// Get user's rank details
router.get('/rank', auth, getRank);

// Get sponsor details
router.get('/sponsor', auth, getSponsor);

// Upload profile photo
router.post('/upload-photo', auth, upload.single('photo'), uploadPhoto);

module.exports = router; 