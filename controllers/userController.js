import { body, validationResult } from 'express-validator';
import userService from '../services/userService.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import withdrawalService from '../services/withdrawalService.js';
import referralService from '../services/referralService.js';

export const getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    res.json({ success: true, user, message: 'Profile fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, user: null, message: 'Failed to fetch profile.', error: err.message });
  }
};

export const updateProfileValidators = [
  body('fullName').optional().isString().notEmpty(),
  body('phone').optional().isString().isLength({ min: 10, max: 10 }),
  body('email').optional().isEmail(),
];

export const updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, message: 'Invalid profile update data.', error: errors.array() });
  }
  try {
    const user = await userService.updateProfile(req.user._id, req.body);
    res.json({ success: true, data: { user }, message: 'Profile updated successfully!', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to update profile.', error: err.message });
  }
};

export const withdrawValidators = [
  body('amount').isNumeric().withMessage('Amount is required and must be a number'),
  body('remarks').optional().isString(),
  body('bankAccount').optional().isObject(),
  body('bankAccount.accountHolder').optional().isString(),
  body('bankAccount.accountNumber').optional().isString(),
  body('bankAccount.ifsc').optional().isString(),
  body('bankAccount.bankName').optional().isString(),
  body('bankAccount.branch').optional().isString(),
  body('upiId').optional().isString(),
];

export const requestWithdrawal = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, message: 'Invalid withdrawal request.', error: errors.array() });
  }
  try {
    const withdrawal = await withdrawalService.submitWithdrawal({
      userId: req.user._id,
      amount: req.body.amount,
      remarks: req.body.remarks,
      bankAccount: req.body.bankAccount,
      upiId: req.body.upiId
    });
    res.json({ success: true, data: { withdrawal }, message: 'Withdrawal request submitted successfully!', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to submit withdrawal request.', error: err.message });
  }
};

export const getUserWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await withdrawalService.getUserWithdrawals(req.user._id, page, limit);
    res.json({
      success: true,
      data: result,
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
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await userService.getUserProfile(req.user._id);
    res.json({ success: true, user, message: 'Profile fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, user: null, message: 'Failed to fetch profile.', error: err.message });
  }
};

export const getDirectReferrals = async (req, res) => {
  try {
    const directReferrals = await referralService.getDirectReferrals(req.user._id);
    res.json(directReferrals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getIndirectReferrals = async (req, res) => {
  try {
    const indirectReferrals = await referralService.getIndirectReferrals(req.user._id);
    res.json(indirectReferrals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDirectLeft = async (req, res) => {
  try {
    const users = await referralService.getDirectLeft(req.user._id);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getDirectRight = async (req, res) => {
  try {
    const users = await referralService.getDirectRight(req.user._id);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 