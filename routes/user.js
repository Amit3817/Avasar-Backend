import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import Withdrawal from '../models/Withdrawal.js';
import { uploadProfilePicture } from '../services/cloudinaryService.js';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus } from '../controllers/adminController.js';
import { requestWithdrawal, withdrawValidators, getDirectReferrals, getIndirectReferrals, getDirectLeft, getDirectRight, updateReferralCounts } from '../controllers/userController.js';
import investmentService from '../services/investmentService.js';
import referralService from '../services/referralService.js';
import upload from '../middleware/upload.js';
import { handleGetUserHistoryByUserId } from '../controllers/historyController.js';

const router = express.Router();

// Add user profile endpoints here

router.get('/profile', requireAuth, async (req, res) => {
  try {
    // Get user data
    const user = await User.findById(req.user._id)
      .populate('referral.referredBy', 'profile.fullName auth.email')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Get direct referrals
    const directReferrals = await referralService.getDirectReferrals(req.user._id);
    const directCount = directReferrals.length;
    
    // Get the user with leftChildren and rightChildren arrays
    const currentUser = await User.findById(req.user._id)
      .select('referral.leftChildren referral.rightChildren')
      .lean();
    
    // Count left and right team from the arrays
    const leftTeamCount = Array.isArray(currentUser.referral?.leftChildren) ? 
      currentUser.referral.leftChildren.length : 0;
    
    const rightTeamCount = Array.isArray(currentUser.referral?.rightChildren) ? 
      currentUser.referral.rightChildren.length : 0;
    
    console.log(`Team counts from arrays: left=${leftTeamCount}, right=${rightTeamCount}`);
    
    console.log(`Direct DB counts: left=${leftTeamCount}, right=${rightTeamCount}`);
    
    // Get indirect referrals
    const indirectResult = await referralService.getIndirectReferrals(req.user._id);
    let indirectCount = 0;
    if (typeof indirectResult === 'number') {
      indirectCount = indirectResult;
    } else if (Array.isArray(indirectResult)) {
      indirectCount = indirectResult.length;
    }
    
    // Team size is direct + indirect
    const teamSize = directCount + indirectCount;
    
    // Update user with all counts
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        'referral.directReferrals': directCount,
        'referral.teamSize': teamSize,
        'referral.indirectReferrals': indirectCount,
        'referral.leftCount': leftTeamCount,
        'referral.rightCount': rightTeamCount
      }
    });
    
    // Merge counts with user data
    const userWithStats = {
      ...user,
      isAdmin: user.auth?.isAdmin || false,
      directReferrals: directCount,
      directReferralCount: directCount,
      teamSize: teamSize, // Direct + indirect
      indirectReferrals: indirectCount,
      leftTeam: leftTeamCount,
      rightTeam: rightTeamCount,
      leftCount: leftTeamCount,
      rightCount: rightTeamCount,
      leftReferrals: leftTeamCount,
      rightReferrals: rightTeamCount
    };
    
    // Also update nested fields
    if (!userWithStats.referral) userWithStats.referral = {};
    userWithStats.referral.directReferrals = directCount;
    userWithStats.referral.directReferralCount = directCount;
    userWithStats.referral.teamSize = teamSize; // Direct + indirect
    userWithStats.referral.indirectReferrals = indirectCount;
    
    res.json({ success: true, user: userWithStats, message: 'Profile fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, user: null, message: 'Failed to fetch profile.', error: err.message });
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
    req.user.profile.profilePicture = result.secure_url;
    await req.user.save();
    
    res.json({ 
      message: 'Profile picture uploaded successfully', 
      url: req.user.profile?.profilePicture 
    });
  } catch (err) {
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
    // Force recalculation of investment status
    await investmentService.calculateInvestmentStatus(req.user._id);
    
    // Get the updated investment summary
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

router.get('/direct-referrals', requireAuth, getDirectReferrals);
router.get('/indirect-referrals', requireAuth, getIndirectReferrals);
router.get('/direct-left', requireAuth, getDirectLeft);
router.get('/direct-right', requireAuth, getDirectRight);

// New endpoint to update all referral counts
router.get('/update-referral-counts', requireAuth, updateReferralCounts);
router.get('/history/',requireAuth,handleGetUserHistoryByUserId)

export default router; 