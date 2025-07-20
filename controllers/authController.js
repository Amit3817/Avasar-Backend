import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { generateUniqueReferralCode } from '../utils/referral.js';
import authService from '../services/authService.js';
import { trackOtpAttempt, resetOtpAttempts } from '../middleware/otpLimiter.js';
import { sendSuccess, sendError } from '../utils/responseHelpers.js';

// Improved OTP rate limit (by phone and email)
const otpRateLimit = {};
const OTP_WINDOW = 30 * 1000; // 30 seconds

function validateEmail(email) {
  return /.+@.+\..+/.test(email);
}
function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}

export const register = async (req, res) => {
  try {
    const user = await authService.register(req.body);
    sendSuccess(res, user, 'Registration successful! An OTP has been sent to your email.');
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern && (err.keyPattern['auth.email'] || err.keyPattern.email)) {
        sendError(res, 'This email is already registered. Please log in or use a different email address.', 400);
      }
      if (err.keyPattern && (err.keyPattern['profile.phone'] || err.keyPattern.phone)) {
        sendError(res, 'This phone number is already registered. Please log in or use a different phone number.', 400);
      }
      sendError(res, 'Duplicate entry. Please use different details.', 400);
    }
    sendError(res, err.message, 400);
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const result = await authService.verifyOtp(req.body);
    // Reset OTP attempts on successful verification
    resetOtpAttempts(req.body.email);
    sendSuccess(res, result, 'Your email has been verified successfully!');
  } catch (err) {
    // Track failed OTP attempt
    trackOtpAttempt(req.body.email);
    sendError(res, err.message, 400);
  }
};

export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const resendOtp = async (req, res) => {
  try {
    await authService.resendOtp(req.body);
    sendSuccess(res, null, 'A new OTP has been sent to your email.');
  } catch (err) {
    sendError(res, 'Could not resend OTP. Please try again later.', 400);
  }
};

export const sendWithdrawalOtp = async (req, res) => {
  try {
    await authService.sendWithdrawalOtp(req.body);
    sendSuccess(res, null, 'Withdrawal OTP sent to your email.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const verifyWithdrawalOtp = async (req, res) => {
  try {
    await authService.verifyWithdrawalOtp(req.body);
    sendSuccess(res, null, 'Withdrawal OTP verified successfully.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    await authService.requestPasswordReset(req.body);
    sendSuccess(res, null, 'Password reset OTP sent to your email.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const verifyPasswordResetOtp = async (req, res) => {
  try {
    await authService.verifyPasswordResetOtp(req.body);
    sendSuccess(res, null, 'Password reset OTP verified successfully.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const resendPasswordResetOtp = async (req, res) => {
  try {
    await authService.resendPasswordResetOtp(req.body);
    sendSuccess(res, null, 'New password reset OTP sent to your email.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
};

export const resetPassword = async (req, res) => {
  try {
    await authService.resetPassword(req.body);
    sendSuccess(res, null, 'Password reset successfully.');
  } catch (err) {
    sendError(res, err.message, 400);
  }
}; 