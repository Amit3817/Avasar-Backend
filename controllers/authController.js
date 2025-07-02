import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { generateUniqueReferralCode, addReferralIncome, addMatchingIncome, addGenerationIncome, addTradingIncome, addRewardIncome } from '../utils/referral.js';

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
    const { fullName, email, phone, password, referralCode, isAdmin, position } = req.body;
    if (!fullName || !email || !phone || !password)
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!validatePhone(phone)) return res.status(400).json({ error: 'Please enter a valid 10-digit phone number.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    let refUser = null;
    if (referralCode) {
      refUser = await User.findOne({ referralCode });
      if (!refUser) return res.status(400).json({ error: 'Referral code not found. Please check and try again.' });
      if (!position || !['left', 'right'].includes(position)) {
        return res.status(400).json({ error: 'Please select a position (left or right) when using a referral code.' });
      }
    }
    // OTP rate limit (by phone and email)
    const otpKey = `${phone || ''}|${email || ''}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
      return res.status(429).json({ error: 'OTP recently sent. Please wait before requesting again.' });
    otpRateLimit[otpKey] = Date.now();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const newReferralCode = await generateUniqueReferralCode();
    const user = await User.create({
      fullName, email, phone,
      password: hashedPassword, otp, otpExpires,
      referredBy: refUser ? refUser._id : null, isAdmin: !!isAdmin, referralCode: newReferralCode,
      position: refUser ? position : null
    });
    try {
      await sendOtp(email, otp);
    } catch (mailErr) {
      console.error('Failed to send OTP email:', mailErr);
      return res.status(500).json({ error: 'Could not send OTP email. Please try again later or contact support.' });
    }
    // Update referrer's left/right arrays if applicable
    if (refUser) {
      if (position === 'left') {
        refUser.left.push(user._id);
        await refUser.save();
      } else if (position === 'right') {
        refUser.right.push(user._id);
        await refUser.save();
      }
      // Use refUser for income functions to avoid duplicate queries
      await addReferralIncome(user._id, refUser);
      await addMatchingIncome(user._id, refUser);
      await addGenerationIncome(user._id);
    }
    await addTradingIncome(user._id);
    await addRewardIncome(user._id);
    // Send OTP to user's email
    res.json({ message: 'Registration successful! An OTP has been sent to your email.' });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.email) {
        return res.status(400).json({ error: 'This email is already registered. Please log in or use a different email address.' });
      }
      if (err.keyPattern && err.keyPattern.phone) {
        return res.status(400).json({ error: 'This phone number is already registered. Please log in or use a different phone number.' });
      }
      return res.status(400).json({ error: 'Duplicate entry. Please use different details.' });
    }
    res.status(400).json({ error: err.message });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Both email and OTP are required.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    const MAX_OTP_ATTEMPTS = 5;
    const OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please try again after 15 minutes.' });
    }

    if (user.otp !== otp || user.otpExpires < new Date()) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
        user.otpLockedUntil = new Date(Date.now() + OTP_LOCK_TIME);
      }
      await user.save();
      return res.status(400).json({ error: 'Invalid or expired OTP. Please check your email and try again.' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    await user.save();
    // Generate JWT token after successful verification
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Your email has been verified successfully!',
      token,
      user: {
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please enter both email and password.' });
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) return res.status(400).json({ error: 'Invalid credentials or your email is not verified.' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Incorrect password. Please try again.' });
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { email: user.email, phone: user.phone, fullName: user.fullName, referralCode: user.referralCode, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Please provide your email address.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    // Rate limit logic (reuse from register)
    const otpKey = `${user.phone || ''}|${user.email || ''}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
      return res.status(429).json({ error: 'OTP was recently sent. Please wait before requesting again.' });
    otpRateLimit[otpKey] = Date.now();

    // Generate and save new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtp(user.email, otp);
    res.json({ message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    res.status(400).json({ error: 'Could not resend OTP. Please try again later.' });
  }
}; 