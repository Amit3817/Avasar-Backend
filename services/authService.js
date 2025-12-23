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
  if (password.length < 8)
    throw new Error('Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.');

  /* -------------------- CHECK EXISTING USER -------------------- */
  const existingUser = await User.findOne({
    $or: [
      { 'auth.email': email },
      { 'profile.phone': phone }
    ]
  });

  // CASE 1: User exists & already verified
  if (existingUser && existingUser.auth.isVerified) {
    throw new Error('User already registered and verified. Please login.');
  }

  // CASE 2: User exists but NOT verified → resend OTP
  if (existingUser && !existingUser.auth.isVerified) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    existingUser.auth.otp = otp;
    existingUser.auth.otpExpires = otpExpires;
    existingUser.auth.otpType = 'registration';

    await existingUser.save();

    await sendOtp(phone, otp);

    return {
      message: 'OTP resent. Please verify your account.',
      userId: existingUser._id
    };
  }

  /* -------------------- REFERRAL LOGIC -------------------- */
  let refUser = null;
  if (referralCode) {
    if (!validateReferralCode(referralCode)) {
      throw new Error(
        'Invalid referral code format. Referral code must be exactly 8 characters with uppercase letters and numbers only.'
      );
    }

    refUser = await User.findOne({ 'referral.referralCode': referralCode });
    if (!refUser) throw new Error('Referral code not found. Please check and try again.');

    if (!position || !['left', 'right'].includes(position)) {
      throw new Error('Please select a position (left or right) when using a referral code.');
    }
  }

  /* -------------------- OTP RATE LIMIT -------------------- */
  const otpKey = `${phone}|${email}`;
  if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW)
    throw new Error('OTP recently sent. Please wait before requesting again.');
  otpRateLimit[otpKey] = Date.now();

  /* -------------------- CREATE USER -------------------- */
  const hashedPassword = await bcrypt.hash(password, 10);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
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
      otpType: 'registration',
      isVerified: false,
      isAdmin: !!isAdmin
    },
    referral: {
      referralCode: newReferralCode,
      referredBy: refUser ? refUser._id : null
    }
  });

  /* -------------------- UPDATE REFERRER TREE -------------------- */
  if (refUser) {
    if (position === 'left') {
      refUser.referral.leftChildren = refUser.referral.leftChildren || [];
      refUser.referral.leftChildren.push(user._id);
    } else {
      refUser.referral.rightChildren = refUser.referral.rightChildren || [];
      refUser.referral.rightChildren.push(user._id);
    }
    await refUser.save();
  }

  /* -------------------- SEND OTP -------------------- */
  sendOtp(phone, otp).catch(err => {
    console.error('Failed to send OTP:', err);
  });

  return {
    message: 'Registration successful. OTP sent for verification.',
    userId: user._id
  };
}



  async verifyOtp({ email, otp }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No account found with this email.');
    const MAX_OTP_ATTEMPTS = 5;
    const OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    if (user.auth.otpLockedUntil && user.auth.otpLockedUntil > new Date()) {
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
    
    // Verify OTP type is for registration
    if (user.auth.otpType !== 'registration') {
      throw new Error('Invalid OTP type. This OTP is not for registration verification.');
    }
    
    user.auth.isVerified = true;
    user.auth.otp = null;
    user.auth.otpExpires = null;
    user.auth.otpType = undefined;
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
    let user = await User.findOne({ 'auth.email': email });
    if (!user) 
      {
        user=await User.findOne({ 'avasarId': email });
        if (user) {
          email = user.auth.email;
         }
         else{

           throw new Error('No account found with this email address.');
         } // Use the email associated with the Avasar ID
      }
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
    user.auth.otpType = 'registration';
    await user.save();
    await sendOtp(user.auth?.email, otp);
    return true;
  },

  async resendPasswordResetOtp({ email }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    // Check if user is locked from too many attempts
    if (user.auth.otpLockedUntil && user.auth.otpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }

    // Rate limiting for password reset OTP resend
    const otpKey = `password-reset-resend_${email}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW) {
      throw new Error('Password reset OTP recently sent. Please wait before requesting again.');
    }
    otpRateLimit[otpKey] = Date.now();

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    user.auth.otp = otp;
    user.auth.otpExpires = expires;
    user.auth.otpType = 'password-reset';
    user.auth.otpAttempts = 0; // Reset attempts when sending new OTP
    user.auth.otpLockedUntil = null; // Reset lock when sending new OTP
    await user.save();

    await sendOtp(email, otp);
    return { success: true, message: 'New password reset OTP sent to your email.' };
  },

  async requestPasswordReset({ email }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    // Check if user is locked from too many attempts
    if (user.auth.otpLockedUntil && user.auth.otpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }

    // Rate limiting for password reset OTP
    const otpKey = `password-reset_${email}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW) {
      throw new Error('Password reset OTP recently sent. Please wait before requesting again.');
    }
    otpRateLimit[otpKey] = Date.now();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

    user.auth.otp = otp;
    user.auth.otpExpires = expires;
    user.auth.otpType = 'password-reset';
    user.auth.otpAttempts = 0; // Reset attempts when sending new OTP
    user.auth.otpLockedUntil = null; // Reset lock when sending new OTP
    await user.save();

    await sendOtp(email, otp);
    return { success: true, message: 'Password reset OTP sent to your email.' };
  },

  async verifyPasswordResetOtp({ email, otp }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    const MAX_OTP_ATTEMPTS = 5;
    const OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    // Check if user is locked from too many attempts
    if (user.auth.otpLockedUntil && user.auth.otpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }

    // Verify OTP type is for password reset
    if (user.auth.otpType !== 'password-reset') {
      throw new Error('Invalid OTP type. This OTP is not for password reset.');
    }

    // Verify OTP
    if (user.auth.otp !== otp || user.auth.otpExpires < new Date()) {
      user.auth.otpAttempts = (user.auth.otpAttempts || 0) + 1;
      
      if (user.auth.otpAttempts >= MAX_OTP_ATTEMPTS) {
        user.auth.otpLockedUntil = new Date(Date.now() + OTP_LOCK_TIME);
      }
      
      await user.save();
      throw new Error('Invalid or expired password reset OTP. Please check your email and try again.');
    }

    // Clear OTP data on successful verification
    user.auth.otp = null;
    user.auth.otpExpires = null;
    user.auth.otpType = undefined;
    user.auth.otpAttempts = 0;
    user.auth.otpLockedUntil = null;
    await user.save();

    return { success: true, message: 'Password reset OTP verified successfully.' };
  },

  async resetPassword({ email, otp, newPassword }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    // Verify OTP type is for password reset
    if (user.auth.otpType !== 'password-reset') {
      throw new Error('Invalid OTP type. This OTP is not for password reset.');
    }

    // Verify OTP
    if (user.auth.otp !== otp || user.auth.otpExpires < new Date()) {
      throw new Error('Invalid or expired OTP. Please request a new password reset.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.auth.password = hashedPassword;
    
    // Clear OTP data
    user.auth.otp = null;
    user.auth.otpExpires = null;
    user.auth.otpType = undefined;
    user.auth.otpAttempts = 0;
    user.auth.otpLockedUntil = null;
    
    await user.save();
    return { success: true, message: 'Password reset successfully.' };
  },

  async sendWithdrawalOtp({ email }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    // Check if user is locked from too many attempts
    if (user.auth.withdrawalOtpLockedUntil && user.auth.withdrawalOtpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }

    // Rate limiting for withdrawal OTP
    const otpKey = `withdrawal_${email}`;
    if (otpRateLimit[otpKey] && Date.now() - otpRateLimit[otpKey] < OTP_WINDOW) {
      throw new Error('Withdrawal OTP recently sent. Please wait before requesting again.');
    }
    otpRateLimit[otpKey] = Date.now();

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    user.auth.withdrawalOtp = otp;
    user.auth.withdrawalOtpExpires = expires;
    user.auth.withdrawalOtpAttempts = 0; // Reset attempts when sending new OTP
    user.auth.withdrawalOtpLockedUntil = null; // Reset lock when sending new OTP
    await user.save();

    await sendOtp(email, otp);
    return { success: true, message: 'Withdrawal OTP sent to your email.' };
  },

  async verifyWithdrawalOtp({ email, otp }) {
    const user = await User.findOne({ 'auth.email': email });
    if (!user) throw new Error('No user found with this email.');

    const MAX_WITHDRAWAL_OTP_ATTEMPTS = 5;
    const WITHDRAWAL_OTP_LOCK_TIME = 15 * 60 * 1000; // 15 minutes

    // Check if user is locked from too many attempts
    if (user.auth.withdrawalOtpLockedUntil && user.auth.withdrawalOtpLockedUntil > new Date()) {
      throw new Error('Too many incorrect attempts. Please try again after 15 minutes.');
    }

    // Verify OTP
    if (user.auth.withdrawalOtp !== otp || user.auth.withdrawalOtpExpires < new Date()) {
      user.auth.withdrawalOtpAttempts = (user.auth.withdrawalOtpAttempts || 0) + 1;
      
      if (user.auth.withdrawalOtpAttempts >= MAX_WITHDRAWAL_OTP_ATTEMPTS) {
        user.auth.withdrawalOtpLockedUntil = new Date(Date.now() + WITHDRAWAL_OTP_LOCK_TIME);
      }
      
      await user.save();
      throw new Error('Invalid or expired withdrawal OTP. Please check your email and try again.');
    }

    // Clear OTP data on successful verification
    user.auth.withdrawalOtp = null;
    user.auth.withdrawalOtpExpires = null;
    user.auth.withdrawalOtpAttempts = 0;
    user.auth.withdrawalOtpLockedUntil = null;
    await user.save();

    return { success: true, message: 'Withdrawal OTP verified successfully.' };
  },
};

export default authService; 