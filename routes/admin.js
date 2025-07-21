import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import { validateUserExists, validateUserActive } from '../middleware/userValidation.js';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus, getUserRewards, getDashboardStats, getPlatformIncomeStats } from '../controllers/adminController.js';
import { adminUploadSlip, approveWithdrawal, rejectWithdrawal, getAllWithdrawals } from '../controllers/paymentController.js';
import upload from '../middleware/upload.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import referralService from '../services/referralService.js';
import investmentService from '../services/investmentService.js';
import { userIdParamValidator, withdrawalIdParamValidator, updateUserIncomeValidator } from '../validators/adminValidators.js';
import { validationResult } from 'express-validator';

const router = express.Router();

// ADMIN: Get all users
router.get('/users', requireAuth, requireAdmin, paginationMiddleware, getAllUsers);

// ADMIN: Update user income
router.put('/user/:id/income', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, updateUserIncomeValidator, handleValidation, updateUserIncome);

// ADMIN: Get all payment slips
router.get('/payment-slips', requireAuth, requireAdmin, paginationMiddleware, getAllPaymentSlips);

// ADMIN: Update payment slip status
router.put('/payment-slip/:id/status', requireAuth, requireAdmin, userIdParamValidator, handleValidation, updatePaymentSlipStatus);

// ADMIN: Manually upload a payment slip for any user
router.post('/payment-slip/upload', requireAuth, requireAdmin, upload.single('file'), adminUploadSlip);

// Admin: Get a user's reward milestones and awarded rewards
router.get('/user/:id/rewards', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, getUserRewards);

// Admin: Get user's referral income summary
router.get('/user/:id/referral-summary', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await referralService.getUserReferralSummary(id);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get user's investment summary
router.get('/user/:id/investment-summary', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const summary = await investmentService.getInvestmentSummary(id);
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

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

// Add route to get indirect referrals up to level 10
router.get('/user/:id/indirect-referrals', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const indirectResult = await referralService.getIndirectReferrals(id, 10);
    
    // If indirectResult is a number (not an array of IDs), return empty array
    if (typeof indirectResult === 'number') {
      return res.json([]);
    }
    
    // Only try to find users if indirectIds is an array with elements
    if (Array.isArray(indirectResult) && indirectResult.length > 0) {
      const users = await User.find({ _id: { $in: indirectResult } })
        .select('profile.fullName auth.email profile.phone createdAt profile.position');
      return res.json(users);
    }
    
    // Default: return empty array
    return res.json([]);
  } catch (err) {
    console.error('Error fetching indirect referrals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch indirect referrals' });
  }
});

// Get direct referrals (all leftChildren + rightChildren)
router.get('/user/:id/direct-referrals', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Use the referralService method instead of direct DB access
    const directReferrals = await referralService.getDirectReferrals(id);
    
    // Return the original format for compatibility
    res.json(directReferrals);
  } catch (err) {
    console.error('Error fetching direct referrals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch direct referrals' });
  }
});

// Get direct left referrals (leftChildren)
router.get('/user/:id/direct-left', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    // Use the referralService method instead of direct DB access
    const leftReferrals = await referralService.getDirectLeft(id);
    // Return the original format for compatibility
    res.json(leftReferrals);
  } catch (err) {
    console.error('Error fetching left referrals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch left referrals' });
  }
});

// Get direct right referrals (rightChildren)
router.get('/user/:id/direct-right', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    // Use the referralService method instead of direct DB access
    const rightReferrals = await referralService.getDirectRight(id);
    // Return the original format for compatibility
    res.json(rightReferrals);
  } catch (err) {
    console.error('Error fetching right referrals:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch right referrals' });
  }
});

// ADMIN: Get all withdrawal requests
router.get('/withdrawals', requireAuth, requireAdmin, paginationMiddleware, getAllWithdrawals);
router.get('/dashboard-stats', requireAuth, requireAdmin, getDashboardStats);

// ADMIN: Approve withdrawal request
router.put('/withdrawal/:withdrawalId/approve', requireAuth, requireAdmin, withdrawalIdParamValidator, handleValidation, approveWithdrawal);

// ADMIN: Reject withdrawal request
router.put('/withdrawal/:withdrawalId/reject', requireAuth, requireAdmin, withdrawalIdParamValidator, handleValidation, rejectWithdrawal);

// Platform-wide income stats
router.get('/platform-income-stats', requireAuth, requireAdmin, getPlatformIncomeStats);

router.get('/user/:id', requireAuth, requireAdmin, async (req, res) => {
  await import('../controllers/adminController.js').then(ctrl => ctrl.getUserById(req, res));
});

export default router; 