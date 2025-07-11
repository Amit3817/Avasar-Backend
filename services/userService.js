import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import investmentService from './investmentService.js';

const userService = {
  async getProfile(userId) {
    const user = await User.findById(userId)
      .select('profile auth referral income investment system createdAt')
      .populate('referral.referredBy', 'profile.fullName auth.email')
      .lean();
    if (!user) throw new Error('User not found');
    
    // Ensure isAdmin is properly accessible
    const userWithVirtuals = {
      ...user,
      isAdmin: user.auth?.isAdmin || false
    };
    
    return userWithVirtuals;
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
    user.income = user.income || {};
    user.income.walletBalance -= amount;
    await user.save();
    
    const withdrawal = await Withdrawal.create({ user: userId, amount, remarks });
    return withdrawal;
  }
};

async function getUserProfile(userId) {
  const user = await User.findById(userId)
          .select('profile.fullName auth.email auth.isAdmin profile.phone profile.profilePicture referral.referredBy income.walletBalance investment.totalInvestment income.investmentIncome income.referralIncome income.matchingIncome income.rewardIncome income.investmentReferralPrincipalIncome income.investmentReferralReturnIncome referral.directReferralCount createdAt')
          .populate('referral.referredBy', 'profile.fullName auth.email')
    .lean();
  if (!user) throw new Error('User not found');
  
  // Ensure isAdmin is properly accessible
  const userWithVirtuals = {
    ...user,
    isAdmin: user.auth?.isAdmin || false
  };
  
  return userWithVirtuals;
}

export default {
  ...userService,
  getUserProfile,
}; 