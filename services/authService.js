import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { generateUniqueReferralCode } from '../utils/referral.js';

const otpRateLimit = {};
const OTP_WINDOW = 30 * 1000; // 30 seconds

function validateEmail(email) {
  return /.+@.+\..+/.test(email);
}
function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}

const authService = {
  async register({ fullName, email, phone, password, referralCode, isAdmin, position }) {
    if (!fullName || !email || !phone || !password)
      throw new Error('Please fill in all required fields.');
    if (!validateEmail(email)) throw new Error('Please enter a valid email address.');
    if (!validatePhone(phone)) throw new Error('Please enter a valid 10-digit phone number.');
    if (password.length < 6) throw new Error('Password must be at least 6 characters long.');
    let refUser = null;
    if (referralCode) {
      refUser = await User.findOne({ referralCode });
      if (!refUser) throw new Error('Referral code not found. Please check and try again.');
      if (!position || !['left', 'right'].includes(position)) {
        throw new Error('Please select a position (left or right) when using a referral code.');
      }
    }
    // OTP rate limit (by phone and email)
    const otpKey = `${phone || ''}|${email || ''}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
      throw new Error('OTP recently sent. Please wait before requesting again.');
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
    // Update referrer's leftChildren/rightChildren array
    if (refUser) {
      if (position === 'left') {
        refUser.leftChildren = refUser.leftChildren || [];
        refUser.leftChildren.push(user._id);
      } else if (position === 'right') {
        refUser.rightChildren = refUser.rightChildren || [];
        refUser.rightChildren.push(user._id);
      }
      await refUser.save();
    }
    try {
      await sendOtp(email, otp);
    } catch (mailErr) {
      throw new Error('Could not send OTP email. Please try again later or contact support.');
    }
    return user;
  },

  async verifyOtp({ email, otp }) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('No account found with this email.');
    const MAX_OTP_ATTEMPTS = 5;
    const OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }
    if (user.otp !== otp || user.otpExpires < new Date()) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
        user.otpLockedUntil = new Date(Date.now() + OTP_LOCK_TIME);
      }
      await user.save();
      throw new Error('Invalid or expired OTP. Please check your email and try again.');
    }
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.otpLockedUntil = null;
    await user.save();
    
    // Enhanced JWT with issuer and audience
    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: '7d',
        issuer: 'avasar-platform',
        audience: 'avasar-users',
        algorithm: 'HS256'
      }
    );
    
    return {
      token,
      user: {
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin
      }
    };
  },

  async login({ email, password }) {
    const user = await User.findOne({ email });
    if (!user || !user.isVerified) throw new Error('Invalid credentials or your email is not verified.');
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new Error('Incorrect password. Please try again.');
    
    // Enhanced JWT with issuer and audience
    const token = jwt.sign(
      { id: user._id, isAdmin: user.isAdmin }, 
      process.env.JWT_SECRET, 
      { 
        expiresIn: '7d',
        issuer: 'avasar-platform',
        audience: 'avasar-users',
        algorithm: 'HS256'
      }
    );
    
    return {
      token,
      user: {
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin
      }
    };
  },

  async resendOtp({ email }) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('No account found with this email.');
    const otpKey = `${user.phone || ''}|${user.email || ''}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
      throw new Error('OTP was recently sent. Please wait before requesting again.');
    otpRateLimit[otpKey] = Date.now();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtp(user.email, otp);
    return true;
  },
};

export default authService; 