import { body } from 'express-validator';

export const createInvestmentValidator = [
  body('amount').isNumeric().withMessage('Amount is required and must be a number').custom((value) => {
    if (value < 10000) throw new Error('Minimum investment is ₹10,000');
    return true;
  }),
]; 