import { body, param } from 'express-validator';

export const userIdParamValidator = [
  param('id').isMongoId().withMessage('Valid user ID is required'),
];

export const withdrawalIdParamValidator = [
  param('withdrawalId').isMongoId().withMessage('Valid withdrawal ID is required'),
];

export const updateUserIncomeValidator = [
  body('referralIncome').optional().isNumeric(),
  body('matchingIncome').optional().isNumeric(),
  body('generationIncome').optional().isNumeric(),
  body('tradingIncome').optional().isNumeric(),
  body('rewardIncome').optional().isNumeric(),
]; 