import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { generateUniqueReferralCode } from '../utils/referral.js';
import authService from '../services/authService.js';
import { trackOtpAttempt, resetOtpAttempts } from '../middleware/otpLimiter.js';

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
    res.json({ message: 'Registration successful! An OTP has been sent to your email.' });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern && (err.keyPattern['auth.email'] || err.keyPattern.email)) {
        return res.status(400).json({ error: 'This email is already registered. Please log in or use a different email address.' });
      }
      if (err.keyPattern && (err.keyPattern['profile.phone'] || err.keyPattern.phone)) {
        return res.status(400).json({ error: 'This phone number is already registered. Please log in or use a different phone number.' });
      }
      return res.status(400).json({ error: 'Duplicate entry. Please use different details.' });
    }
    res.status(400).json({ error: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const result = await authService.verifyOtp(req.body);
    // Reset OTP attempts on successful verification
    resetOtpAttempts(req.body.email);
    res.json({ message: 'Your email has been verified successfully!', ...result });
  } catch (err) {
    // Track failed OTP attempt
    trackOtpAttempt(req.body.email);
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    await authService.resendOtp(req.body);
    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    res.status(400).json({ error: 'Could not resend OTP. Please try again later.' });
  }
};

export const requestPasswordReset = async (req, res) => {
  try {
    const result = await authService.requestPasswordReset(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 