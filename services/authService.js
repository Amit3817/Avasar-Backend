import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendOtp } from '../utils/sendOtp.js';
import { generateUniqueReferralCode } from '../utils/referral.js';
import nodemailer from 'nodemailer';

const otpRateLimit = {};
const OTP_WINDOW = 30 * 1000; // 30 seconds

function validateEmail(email) {
  return /.+@.+\..+/.test(email);
}
function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}
function validateReferralCode(referralCode) {
  return /^[A-Z0-9]{8}$/.test(referralCode);
}

// Remove sendResetOtpEmail function and use sendOtp for password reset OTP

const authService = {
  async register({ fullName, email, phone, password, referralCode, isAdmin, position }) {
    if (!fullName || !email || !phone || !password)
      throw new Error('Please fill in all required fields.');
    if (!validateEmail(email)) throw new Error('Please enter a valid email address.');
    if (!validatePhone(phone)) throw new Error('Please enter a valid 10-digit phone number.');
    if (password.length < 8) throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.');
    
    let refUser = null;
    if (referralCode) {
      // Validate referral code format
      if (!validateReferralCode(referralCode)) {
        throw new Error('Invalid referral code format. Referral code must be exactly 8 characters with uppercase letters and numbers only.');
      }
      
      // Check if referral code exists
      refUser = await User.findOne({ 'referral.referralCode': referralCode });
      if (!refUser) throw new Error('Referral code not found. Please check and try again.');
      
      // Check if user is trying to use their own referral code (for future registrations)
      // This would be relevant if we allow users to see their own referral code during registration
      
      // Validate position is required when referral code is provided
      if (!position || !['left', 'right'].includes(position)) {
        throw new Error('Please select a position (left or right) when using a referral code.');
      }
      
      // Check if the referrer has available positions
      const leftCount = refUser.referral?.leftChildren?.length || 0;
      const rightCount = refUser.referral?.rightChildren?.length || 0;
      
      if (position === 'left' && leftCount >= 1) {
        throw new Error('Left position is already occupied. Please choose right position or use a different referral code.');
      }
      
      if (position === 'right' && rightCount >= 1) {
        throw new Error('Right position is already occupied. Please choose left position or use a different referral code.');
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
    
    // Generate unique avasarId
    const userCount = await User.countDocuments();
    const avasarId = `AV${String(userCount + 1).padStart(6, '0')}`;

    const user = await User.create({
      avasarId,
      profile: { 
        fullName,
        phone,
        position: refUser ? position : null
      },
      auth: { 
        email, 
        password: hashedPassword, 
        otp, 
        otpExpires,
        isAdmin: !!isAdmin
      },
      referral: {
        referralCode: newReferralCode,
        referredBy: refUser ? refUser._id : null
      }
    });
    // Update referrer's leftChildren/rightChildren array
    if (refUser) {
      if (position === 'left') {
        refUser.referral.leftChildren = refUser.referral?.leftChildren || [];
        refUser.referral.leftChildren.push(user._id);
      } else if (position === 'right') {
        refUser.referral.rightChildren = refUser.referral?.rightChildren || [];
        refUser.referral.rightChildren.push(user._id);
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
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No account found with this email.');
    const MAX_OTP_ATTEMPTS = 5;
    const OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    if (user.otpLockedUntil && user.otpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }
    if (user.auth.otp !== otp || user.auth.otpExpires < new Date()) {
      user.auth.otpAttempts = (user.auth.otpAttempts || 0) + 1;
      if (user.auth.otpAttempts >= MAX_OTP_ATTEMPTS) {
        user.auth.otpLockedUntil = new Date(Date.now() + OTP_LOCK_TIME);
      }
      await user.save();
      throw new Error('Invalid or expired OTP. Please check your email and try again.');
    }
    user.auth.isVerified = true;
    user.auth.otp = null;
    user.auth.otpExpires = null;
    user.auth.otpAttempts = 0;
    user.auth.otpLockedUntil = null;
    await user.save();
    
    // Enhanced JWT with issuer and audience
    const token = jwt.sign(
      { id: user._id, isAdmin: user.auth?.isAdmin }, 
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
        _id: user._id,
        email: user.auth?.email,
        phone: user.profile?.phone,
        fullName: user.profile?.fullName,
        referralCode: user.referral?.referralCode,
        isAdmin: user.auth?.isAdmin,
        walletBalance: user.income?.walletBalance,
        totalEarnings: user.totalEarnings,
        directReferrals: user.referral?.directReferrals,
        rank: user.profile?.rank,
        referralIncome: user.income?.referralIncome,
        matchingIncome: user.income?.matchingIncome,
        rewardIncome: user.income?.rewardIncome,
        investmentIncome: user.income?.investmentIncome,
        totalInvestment: user.investment?.totalInvestment,
        teamSize: user.referral?.teamSize,
        position: user.profile?.position
      }
    };
  },

  async login({ email, password }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No account found with this email address.');
    if (!user.auth.isVerified) throw new Error('Your email is not verified. Please verify your email with the OTP sent during registration.');
    const match = await bcrypt.compare(password, user.auth.password);
    if (!match) throw new Error('Incorrect password. Please try again.');
    
    // Enhanced JWT with issuer and audience
    const token = jwt.sign(
      { id: user._id, isAdmin: user.auth?.isAdmin }, 
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
        _id: user._id,
        email: user.auth?.email,
        phone: user.profile?.phone,
        fullName: user.profile?.fullName,
        referralCode: user.referral?.referralCode,
        isAdmin: user.auth?.isAdmin,
        walletBalance: user.income?.walletBalance,
        totalEarnings: user.totalEarnings,
        directReferrals: user.referral?.directReferrals,
        rank: user.profile?.rank,
        referralIncome: user.income?.referralIncome,
        matchingIncome: user.income?.matchingIncome,
        rewardIncome: user.income?.rewardIncome,
        investmentIncome: user.income?.investmentIncome,
        totalInvestment: user.investment?.totalInvestment,
        teamSize: user.referral?.teamSize,
        position: user.profile?.position
      }
    };
  },

  async resendOtp({ email }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No account found with this email.');
    const otpKey = `${user.profile?.phone || ''}|${user.auth?.email || ''}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
      throw new Error('OTP was recently sent. Please wait before requesting again.');
    otpRateLimit[otpKey] = Date.now();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.auth.otp = otp;
    user.auth.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await sendOtp(user.auth?.email, otp);
    return true;
  },

  async requestPasswordReset({ email }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    user.auth.resetOtp = otp;
    user.auth.resetOtpExpires = expires;
    await user.save();

    await sendOtp(email, otp);
    return { success: true, message: 'OTP sent to your email.' };
  },

  async resetPassword({ email, otp, newPassword }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    if (!user.auth.resetOtp || !user.auth.resetOtpExpires) {
      throw new Error('No password reset requested.');
    }
    if (user.auth.resetOtp !== otp) {
      throw new Error('Invalid OTP.');
    }
    if (user.auth.resetOtpExpires < new Date()) {
      throw new Error('OTP has expired.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.auth.password = hashedPassword;
    user.auth.resetOtp = null;
    user.auth.resetOtpExpires = null;
    await user.save();
    return { success: true, message: 'Password has been reset successfully.' };
  },
};

export default authService; 