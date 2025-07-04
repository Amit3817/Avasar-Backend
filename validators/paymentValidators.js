import { body } from 'express-validator';

export const uploadSlipValidator = [
  body('amount').isNumeric().withMessage('Amount is required and must be a number'),
  body('method').isString().notEmpty().withMessage('Payment method is required'),
  body('transactionId').isString().notEmpty().withMessage('Transaction ID is required'),
]; 