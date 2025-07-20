import { body, validationResult } from 'express-validator';
import userService from '../services/userService.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import withdrawalService from '../services/withdrawalService.js';
import referralService from '../services/referralService.js';
import { sendSuccess, sendError } from '../utils/responseHelpers.js';

export const getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user._id);
    sendSuccess(res, { user }, 'Profile fetched successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
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
    return sendError(res, 'Invalid profile update data.', 400, errors.array());
  }
  try {
    const user = await userService.updateProfile(req.user._id, req.body);
    sendSuccess(res, { user }, 'Profile updated successfully!');
  } catch (err) {
    sendError(res, err.message, 500);
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
    return sendError(res, 'Invalid withdrawal request.', 400, errors.array());
  }
  try {
    const withdrawal = await withdrawalService.submitWithdrawal({
      userId: req.user._id,
      amount: req.body.amount,
      remarks: req.body.remarks,
      bankAccount: req.body.bankAccount,
      upiId: req.body.upiId
    });
    sendSuccess(res, { withdrawal }, 'Withdrawal request submitted successfully!');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getUserWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await withdrawalService.getUserWithdrawals(req.user._id, page, limit);
    sendSuccess(res, result, 'Withdrawal history fetched successfully!');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const user = await userService.getUserProfile(req.user._id);
    sendSuccess(res, { user }, 'Profile fetched successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getDirectReferrals = async (req, res) => {
  try {
    const directReferrals = await referralService.getDirectReferrals(req.user._id);
    
    // Update the user's direct referral count in the database
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        'referral.directReferrals': directReferrals.length,
        directReferrals: directReferrals.length,
        directReferralCount: directReferrals.length
      }
    });
    
    // Return the original format for compatibility with frontend
    sendSuccess(res, directReferrals, 'Direct referrals fetched successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getIndirectReferrals = async (req, res) => {
  try {
    const indirectResult = await referralService.getIndirectReferrals(req.user._id);
    
    // Handle different return types but maintain original response format
    if (typeof indirectResult === 'number') {
      sendSuccess(res, [], 'No indirect referrals found.');
    } else if (Array.isArray(indirectResult)) {
      const users = await User.find({ _id: { $in: indirectResult } })
        .select('profile.fullName auth.email profile.phone createdAt profile.position');
      sendSuccess(res, users, 'Indirect referrals fetched successfully.');
    } else {
      sendSuccess(res, [], 'No indirect referrals found.');
    }
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getDirectLeft = async (req, res) => {
  try {
    const users = await referralService.getDirectLeft(req.user._id);
    // Return the original format for compatibility with frontend
    sendSuccess(res, users, 'Direct left referrals fetched successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

export const getDirectRight = async (req, res) => {
  try {
    const users = await referralService.getDirectRight(req.user._id);
    // Return the original format for compatibility with frontend
    sendSuccess(res, users, 'Direct right referrals fetched successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
  }
};

// New endpoint to update all counts for a user
export const updateReferralCounts = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get direct referrals
    const directReferrals = await referralService.getDirectReferrals(userId);
    const directCount = directReferrals.length;
    
    // Get the user with leftChildren and rightChildren arrays
    const currentUser = await User.findById(userId)
      .select('referral.leftChildren referral.rightChildren')
      .lean();
    
    // Count left and right team from the arrays
    const leftTeamCount = Array.isArray(currentUser.referral?.leftChildren) ? 
      currentUser.referral.leftChildren.length : 0;
    
    const rightTeamCount = Array.isArray(currentUser.referral?.rightChildren) ? 
      currentUser.referral.rightChildren.length : 0;
    
    console.log(`Team counts from arrays: left=${leftTeamCount}, right=${rightTeamCount}`);
    
    // Get indirect referrals
    const indirectResult = await referralService.getIndirectReferrals(userId);
    let indirectCount = 0;
    if (typeof indirectResult === 'number') {
      indirectCount = indirectResult;
    } else if (Array.isArray(indirectResult)) {
      indirectCount = indirectResult.length;
    }
    
    // Update user with all counts
    await User.findByIdAndUpdate(userId, {
      $set: {
        'referral.directReferrals': directCount,
        'referral.directReferralCount': directCount,
        'referral.teamSize': directCount + indirectCount,
        'referral.indirectReferrals': indirectCount,
        directReferrals: directCount,
        directReferralCount: directCount,
        teamSize: directCount + indirectCount,
        indirectReferrals: indirectCount,
        leftTeam: leftTeamCount,
        rightTeam: rightTeamCount,
        leftCount: leftTeamCount,
        rightCount: rightTeamCount,
        leftReferrals: leftTeamCount,
        rightReferrals: rightTeamCount
      }
    });
    
    sendSuccess(res, {
      counts: {
        directReferrals: directCount,
        indirectReferrals: indirectCount,
        leftTeam: leftTeamCount,
        rightTeam: rightTeamCount,
        leftCount: leftTeamCount,
        rightCount: rightTeamCount,
        leftReferrals: leftTeamCount,
        rightReferrals: rightTeamCount
      }
    }, 'Referral counts updated successfully.');
  } catch (err) {
    sendError(res, err.message, 500);
  }
}; 