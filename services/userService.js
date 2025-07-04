import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import investmentService from './investmentService.js';

const userService = {
  async getProfile(userId) {
    const user = await User.findById(userId)
      .populate('referredBy', 'fullName email')
      .lean();
    if (!user) throw new Error('User not found');
    return user;
  },

  async updateProfile(userId, update) {
    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) throw new Error('User not found');
    return user;
  },

  async requestWithdrawal(userId, amount, remarks) {
    // Check withdrawal eligibility with investment lock-in restrictions
    const withdrawalCheck = await investmentService.canWithdrawAmount(userId, amount);
    if (!withdrawalCheck.canWithdraw) {
      throw new Error(withdrawalCheck.reason);
    }

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    
    // Atomically deduct balance
    user.walletBalance -= amount;
    await user.save();
    
    const withdrawal = await Withdrawal.create({ user: userId, amount, remarks });
    return withdrawal;
  }
};

async function getUserProfile(userId) {
  const user = await User.findById(userId)
    .select('fullName email phone profilePicture referredBy walletBalance totalInvestment investmentIncome referralIncome matchingIncome rewardIncome investmentReferralPrincipalIncome investmentReferralReturnIncome directReferralCount createdAt')
    .populate('referredBy', 'fullName email')
    .lean();
  if (!user) throw new Error('User not found');
  return user;
}

export default {
  ...userService,
  getUserProfile,
}; 