import { body, validationResult } from 'express-validator';
import userService from '../services/userService.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import withdrawalService from '../services/withdrawalService.js';

export const getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    res.json({ success: true, data: { user }, message: 'Profile fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch profile.', error: err.message });
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
];

export const requestWithdrawal = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, data: null, message: 'Invalid withdrawal request.', error: errors.array() });
  }
  try {
    const withdrawal = await withdrawalService.requestWithdrawal(req.user._id, req.body.amount, req.body.remarks);
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
    res.json({ success: true, data: { user }, message: 'Profile fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch profile.', error: err.message });
  }
}; 