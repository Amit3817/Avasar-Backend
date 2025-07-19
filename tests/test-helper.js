import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import { REGISTRATION_AMOUNT, MIN_INVESTMENT_AMOUNT, MONTHLY_ROI_PERCENT, INVESTMENT_MONTHLY_PERCENTS } from '../config/constants.js';

// Helper to directly set income values for testing
export async function setDirectIncomeValues(users, type) {
  switch (type) {
    case 'referral':
      // Set referral income directly
      for (let i = 0; i < 4; i++) {
        const user = users[i];
        const referralIncome = Math.floor(REGISTRATION_AMOUNT * (i === 0 ? 0.02 : i === 1 ? 0.02 : i === 2 ? 0.03 : 0.10));
        user.income.referralIncome = referralIncome;
        user.income.walletBalance = referralIncome;
        await user.save();
      }
      break;
      
    case 'matching':
      // Set matching income directly
      const matchingIncome = Math.floor(REGISTRATION_AMOUNT * 0.10);
      users[0].income.matchingIncome = matchingIncome;
      users[0].income.walletBalance = matchingIncome;
      users[0].system.totalPairs = 1;
      await users[0].save();
      break;
      
    case 'investment':
      // Set investment referral income directly
      for (let i = 0; i < 4; i++) {
        const user = users[i];
        const level = 4 - i;
        const investmentIncome = Math.floor(MIN_INVESTMENT_AMOUNT * (level === 1 ? 0.03 : level === 2 ? 0.02 : level === 3 ? 0.01 : 0.01));
        user.income.investmentReferralIncome = investmentIncome;
        user.income.investmentReferralPrincipalIncome = investmentIncome;
        user.income.referralInvestmentPrincipal = MIN_INVESTMENT_AMOUNT;
        user.income.walletBalance = investmentIncome;
        await user.save();
      }
      break;
      
    case 'investment-return':
      // Set investment return income directly
      for (let i = 0; i < 4; i++) {
        const user = users[i];
        const level = 4 - i;
        const monthlyROI = Math.floor(MIN_INVESTMENT_AMOUNT * MONTHLY_ROI_PERCENT);
        const returnIncome = Math.floor(monthlyROI * INVESTMENT_MONTHLY_PERCENTS[level]);
        user.income.investmentReferralReturnIncome = returnIncome;
        user.income.walletBalance = returnIncome;
        await user.save();
      }
      break;
  }
  
  return { success: true };
}

// Helper to create a payment slip
export async function createPaymentSlip(userId) {
  const paymentSlip = new PaymentSlip({
    user: userId,
    amount: REGISTRATION_AMOUNT,
    status: 'approved',
    paymentMethod: 'bank',
    transactionId: 'test-transaction'
  });
  
  await paymentSlip.save();
  return paymentSlip;
}