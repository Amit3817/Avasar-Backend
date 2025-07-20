import { body } from 'express-validator';

export const profileUpdateValidator = [
  body('fullName').optional().isString().notEmpty().withMessage('Full name must be a non-empty string'),
  body('phone').optional().isString().isLength({ min: 10, max: 10 }).withMessage('Valid 10-digit phone is required'),
  body('profilePicture').optional().isString(),
];

export const withdrawalValidator = [
  body('amount').isNumeric().withMessage('Amount is required and must be a number'),
  body('withdrawalOtp').isLength({ min: 6, max: 6 }).withMessage('Withdrawal OTP must be exactly 6 digits').matches(/^\d{6}$/).withMessage('Withdrawal OTP can only contain numbers'),
  body('bankAccount').optional().custom((value, { req }) => {
    if (req.body.paymentMethod === 'bank') {
      if (!value || !value.accountHolder || !value.accountNumber || !value.ifsc || !value.bankName) {
        throw new Error('All bank account fields are required');
      }
    }
    return true;
  }),
  body('upiId').optional().custom((value, { req }) => {
    if (req.body.paymentMethod === 'upi') {
      if (!value || value.trim() === '') {
        throw new Error('UPI ID is required');
      }
    }
    return true;
  }),
]; 