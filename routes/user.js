import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import Withdrawal from '../models/Withdrawal.js';
import { uploadProfilePicture } from '../services/cloudinaryService.js';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus } from '../controllers/adminController.js';
import { requestWithdrawal, withdrawValidators } from '../controllers/userController.js';
import investmentService from '../services/investmentService.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// Add user profile endpoints here

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('referredBy', 'fullName email')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// USER: Upload profile picture (Cloudinary)
router.post('/profile-picture', requireAuth, upload.single('profilePicture'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  
  try {
    // Upload to Cloudinary using centralized service
    const result = await uploadProfilePicture(file.buffer, file.originalname);
    
    // Update user's profile picture
    req.user.profilePicture = result.secure_url;
    await req.user.save();
    
    res.json({ 
      message: 'Profile picture uploaded successfully', 
      url: req.user.profilePicture 
    });
  } catch (err) {
    console.error('Profile picture upload error:', err);
    res.status(500).json({ error: 'Profile picture upload failed' });
  }
});

// USER: Request withdrawal
router.post('/withdraw', requireAuth, withdrawValidators, requestWithdrawal);

// USER: Get withdrawal history
router.get('/withdrawals', requireAuth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    
    res.json({ 
      success: true, 
      data: { withdrawals }, 
      message: 'Withdrawal history fetched successfully!', 
      error: null 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      data: null, 
      message: 'Failed to fetch withdrawal history.', 
      error: err.message 
    });
  }
});

// USER: Get investment summary with withdrawal restrictions
router.get('/investment-summary', requireAuth, async (req, res) => {
  try {
    const summary = await investmentService.getInvestmentSummary(req.user._id);
    
    res.json({ 
      success: true, 
      data: { summary }, 
      message: 'Investment summary fetched successfully!', 
      error: null 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      data: null, 
      message: 'Failed to fetch investment summary.', 
      error: err.message 
    });
  }
});



export default router; 