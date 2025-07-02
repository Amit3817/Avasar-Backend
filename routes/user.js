import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import cloudinary from 'cloudinary';
import fs from 'fs';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus } from '../controllers/adminController.js';
import upload from '../middleware/upload.js';

const router = express.Router();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Add user profile endpoints here

router.get('/profile', requireAuth, (req, res) => {
  const { _id, firstName, lastName, email, phone, referralCode, referredBy, isAdmin } = req.user;
  res.json({ _id, firstName, lastName, email, phone, referralCode, referredBy, isAdmin });
});

// USER: Upload profile picture (Cloudinary)
router.post('/profile-picture', requireAuth, upload.single('profilePicture'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await cloudinary.v2.uploader.upload_stream(
      { folder: 'avasar/profile-pictures', public_id: file.originalname },
      async (error, result) => {
        if (error) return res.status(500).json({ error: 'Cloudinary upload failed' });
        req.user.profilePicture = result.secure_url;
        await req.user.save();
        res.json({ message: 'Profile picture uploaded', url: req.user.profilePicture });
      }
    );
    result.end(file.buffer);
  } catch (err) {
    res.status(500).json({ error: 'Profile picture upload failed' });
  }
});

export default router; 