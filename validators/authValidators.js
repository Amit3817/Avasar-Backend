import { body } from 'express-validator';

// Enhanced password validation
const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
    .trim()
    .escape()
];

// Enhanced email validation
const emailValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail()
    .trim()
    .escape()
];

// Enhanced phone validation
const phoneValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please enter a valid 10-digit Indian mobile number')
    .trim()
    .escape()
];

// Enhanced name validation
const nameValidation = [
  body('fullName')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces')
    .trim()
    .escape()
];

export const registerValidator = [
  ...nameValidation,
  ...emailValidation,
  ...phoneValidation,
  ...passwordValidation,
  body('referralCode')
    .optional()
    .isLength({ min: 8, max: 8 })
    .withMessage('Referral code must be exactly 8 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Referral code can only contain uppercase letters and numbers')
    .trim()
    .escape(),
  body('position')
    .optional()
    .isIn(['left', 'right'])
    .withMessage('Position must be either "left" or "right"')
    .trim()
    .escape(),
  body('isAdmin')
    .optional()
    .isBoolean()
    .withMessage('isAdmin must be a boolean value')
];

export const loginValidator = [
  ...emailValidation,
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .trim()
    .escape()
];

export const otpValidator = [
  ...emailValidation,
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('OTP can only contain numbers')
    .trim()
    .escape()
];

export const resendOtpValidator = [
  ...emailValidation
]; 