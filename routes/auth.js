import express from 'express';
import { register, verifyOtp, login, resendOtp, requestPasswordReset, resetPassword, sendWithdrawalOtp, verifyWithdrawalOtp, verifyPasswordResetOtp, resendPasswordResetOtp } from '../controllers/authController.js';
import { registerValidator, loginValidator, otpValidator, resendOtpValidator } from '../validators/authValidators.js';
import { validationResult } from 'express-validator';
import { otpVerificationLimiter, otpResendLimiter } from '../middleware/otpLimiter.js';
import User from '../models/User.js';

const router = express.Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - phone
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               phone:
 *                 type: string
 *                 description: User's phone number (10 digits)
 *               password:
 *                 type: string
 *                 description: User's password (min 8 chars, must include uppercase, lowercase, number, special char)
 *               referralCode:
 *                 type: string
 *                 description: Optional referral code
 *               position:
 *                 type: string
 *                 enum: [left, right]
 *                 description: Position under referrer (required if referralCode provided)
 *     responses:
 *       200:
 *         description: Registration successful, OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Registration successful! An OTP has been sent to your email."
 *       400:
 *         description: Validation error or duplicate user
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/register', registerValidator, handleValidation, register);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid OTP or expired
 *       429:
 *         description: Too many OTP attempts
 */
router.post('/verify-otp', otpVerificationLimiter, otpValidator, handleValidation, verifyOtp);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credentials or unverified email
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/login', loginValidator, handleValidation, login);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     summary: Resend OTP to user's email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "A new OTP has been sent to your email."
 *       400:
 *         description: User not found or email error
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/resend-otp', otpResendLimiter, resendOtpValidator, handleValidation, resendOtp);

/**
 * @swagger
 * /api/auth/send-withdrawal-otp:
 *   post:
 *     summary: Send OTP for withdrawal verification
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Withdrawal OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Withdrawal OTP sent to your email."
 *       400:
 *         description: User not found or rate limit exceeded
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/send-withdrawal-otp', otpResendLimiter, resendOtpValidator, handleValidation, sendWithdrawalOtp);

/**
 * @swagger
 * /api/auth/verify-withdrawal-otp:
 *   post:
 *     summary: Verify OTP for withdrawal
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *     responses:
 *       200:
 *         description: Withdrawal OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Withdrawal OTP verified successfully."
 *       400:
 *         description: Invalid OTP or expired
 *       429:
 *         description: Too many OTP attempts
 */
router.post('/verify-withdrawal-otp', otpVerificationLimiter, otpValidator, handleValidation, verifyWithdrawalOtp);

/**
 * @swagger
 * /api/auth/check-verification:
 *   post:
 *     summary: Check if user email is verified
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification status checked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                 isVerified:
 *                   type: boolean
 *                 message:
 *                   type: string
 */
router.post('/check-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ 'auth.email': email });
    if (!user) {
      return res.json({ 
        exists: false, 
        isVerified: false, 
        message: 'No account found with this email' 
      });
    }
    
    return res.json({ 
      exists: true, 
      isVerified: user.auth?.isVerified, 
      message: user.auth?.isVerified ? 'Email is verified' : 'Email is not verified'
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset request endpoint
router.post('/request-password-reset', requestPasswordReset);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset successfully."
 *       400:
 *         description: Invalid OTP or password requirements not met
 */
router.post('/reset-password', otpValidator, handleValidation, resetPassword);

/**
 * @swagger
 * /api/auth/verify-password-reset-otp:
 *   post:
 *     summary: Verify password reset OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 description: 6-digit OTP code
 *     responses:
 *       200:
 *         description: Password reset OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Password reset OTP verified successfully."
 *       400:
 *         description: Invalid OTP or expired
 *       429:
 *         description: Too many OTP attempts
 */
router.post('/verify-password-reset-otp', otpVerificationLimiter, otpValidator, handleValidation, verifyPasswordResetOtp);

/**
 * @swagger
 * /api/auth/resend-password-reset-otp:
 *   post:
 *     summary: Resend password reset OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: New password reset OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "New password reset OTP sent to your email."
 *       400:
 *         description: User not found or rate limit exceeded
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/resend-password-reset-otp', otpResendLimiter, resendOtpValidator, handleValidation, resendPasswordResetOtp);

export default router; 