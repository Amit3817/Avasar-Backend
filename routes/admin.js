import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { paginationMiddleware } from '../middleware/pagination.js';
import { validateUserExists, validateUserActive } from '../middleware/userValidation.js';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus, getUserRewards } from '../controllers/adminController.js';
import { adminUploadSlip, approveWithdrawal, rejectWithdrawal, getAllWithdrawals } from '../controllers/paymentController.js';
import upload from '../middleware/upload.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import referralService from '../services/referralService.js';
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
    const indirectIds = await referralService.getIndirectReferrals(id, 10);
    const users = await User.find({ _id: { $in: indirectIds } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get direct referrals (all leftChildren + rightChildren)
router.get('/user/:id/direct-referrals', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('leftChildren rightChildren');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const allIds = [
      ...(user.leftChildren || []),
      ...(user.rightChildren || [])
    ];
    const users = await User.find({ _id: { $in: allIds } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get direct left referrals (leftChildren)
router.get('/user/:id/direct-left', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('leftChildren');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const users = await User.find({ _id: { $in: user.leftChildren || [] } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get direct right referrals (rightChildren)
router.get('/user/:id/direct-right', requireAuth, requireAdmin, validateUserExists, validateUserActive, userIdParamValidator, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('rightChildren');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const users = await User.find({ _id: { $in: user.rightChildren || [] } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Get all withdrawal requests
router.get('/withdrawals', requireAuth, requireAdmin, paginationMiddleware, getAllWithdrawals);

// ADMIN: Approve withdrawal request
router.put('/withdrawal/:withdrawalId/approve', requireAuth, requireAdmin, withdrawalIdParamValidator, handleValidation, approveWithdrawal);

// ADMIN: Reject withdrawal request
router.put('/withdrawal/:withdrawalId/reject', requireAuth, requireAdmin, withdrawalIdParamValidator, handleValidation, rejectWithdrawal);

export default router; 