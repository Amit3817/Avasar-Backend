import mongoose from 'mongoose';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import investmentService from './investmentService.js';
import referralService from './referralService.js';

const userService = {
  async getProfile(userId) {
    // Use more specific field selection to reduce data transfer
    const user = await User.findById(userId)
      .select({
        'profile': 1,
        'auth.email': 1,
        'auth.isAdmin': 1,
        'auth.isVerified': 1,
        'referral.referredBy': 1,
        'referral.referralCode': 1,
        'referral.leftChildren': 1,
        'referral.rightChildren': 1,
        'income.walletBalance': 1,
        'income.referralIncome': 1,
        'income.matchingIncome': 1,
        'income.rewardIncome': 1,
        'income.investmentIncome': 1,
        'investment.totalInvestment': 1,
        'investment.availableForWithdrawal': 1,
        'investment.lockedInvestmentAmount': 1,
        'system.pairs': 1,
        'system.totalPairs': 1,
        'system.awardedRewards': 1,
        'createdAt': 1
      })
      .populate('referral.referredBy', 'profile.fullName auth.email')
      .lean();
      
    if (!user) throw new Error('User not found');
    
    // Calculate counts directly
    try {
      // Direct referrals count
      const directCount = await User.countDocuments({ 'referral.referredBy': userId });
      
      // Get the user with leftChildren and rightChildren arrays
      const currentUser = await User.findById(userId)
        .select('referral.leftChildren referral.rightChildren')
        .lean();
      
      // Count left and right team from the arrays
      const leftCount = Array.isArray(currentUser.referral?.leftChildren) ? 
        currentUser.referral.leftChildren.length : 0;
      
      const rightCount = Array.isArray(currentUser.referral?.rightChildren) ? 
        currentUser.referral.rightChildren.length : 0;
      
      console.log(`Team counts from arrays: left=${leftCount}, right=${rightCount}`);
      
      console.log(`User ${userId} team counts by position: left=${leftCount}, right=${rightCount}`);
      
      // Calculate indirect referrals
      const indirectResult = await referralService.getIndirectReferrals(userId, 10);
      let indirectCount = 0;
      if (typeof indirectResult === 'number') {
        indirectCount = indirectResult;
      } else if (Array.isArray(indirectResult)) {
        indirectCount = indirectResult.length;
      }
      
      // Add counts with all possible field names the frontend might be looking for
      user.directReferrals = directCount;
      user.directReferralCount = directCount;
      user.teamSize = directCount + indirectCount; // Total team size is direct + indirect
      user.indirectReferrals = indirectCount;
      
      // Try all possible field names for left/right team
      user.leftTeam = leftCount;
      user.rightTeam = rightCount;
      user.leftCount = leftCount;
      user.rightCount = rightCount;
      user.leftReferrals = leftCount;
      user.rightReferrals = rightCount;
      
      // Nested fields
      if (!user.referral) user.referral = {};
      user.referral.directReferrals = directCount;
      user.referral.directReferralCount = directCount;
      user.referral.teamSize = directCount + indirectCount; // Total team size is direct + indirect
      user.referral.indirectReferrals = indirectCount;
      
      // Log all counts for debugging
      console.log('User counts:', {
        directReferrals: directCount,
        indirectReferrals: indirectCount,
        leftTeam: leftCount,
        rightTeam: rightCount
      });
    } catch (error) {
      console.error('Error calculating referral counts:', error);
    }
    
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
  // Use a more specific projection to only fetch needed fields
  const user = await User.findById(userId)
    .select({
      'profile.fullName': 1,
      'auth.email': 1,
      'auth.isAdmin': 1,
      'profile.phone': 1,
      'profile.profilePicture': 1,
      'profile.rank': 1,
      'referral.referredBy': 1,
      'referral.referralCode': 1,
      'referral.leftChildren': 1,
      'referral.rightChildren': 1,
      'income.walletBalance': 1,
      'income.referralIncome': 1,
      'income.matchingIncome': 1,
      'income.rewardIncome': 1,
      'income.investmentIncome': 1,
      'income.investmentReferralPrincipalIncome': 1,
      'income.investmentReferralReturnIncome': 1,
      'investment.totalInvestment': 1,
      'investment.availableForWithdrawal': 1,
      'createdAt': 1
    })
    .populate('referral.referredBy', 'profile.fullName auth.email')
    .lean();
    
  if (!user) throw new Error('User not found');
  
  // Calculate counts directly
  try {
    // Direct referrals count
    const directCount = await User.countDocuments({ 'referral.referredBy': userId });
    
    // Get the user with leftChildren and rightChildren arrays
    const currentUser = await User.findById(userId)
      .select('referral.leftChildren referral.rightChildren')
      .lean();
    
    // Count left and right team from the arrays
    const leftCount = Array.isArray(currentUser.referral?.leftChildren) ? 
      currentUser.referral.leftChildren.length : 0;
    
    const rightCount = Array.isArray(currentUser.referral?.rightChildren) ? 
      currentUser.referral.rightChildren.length : 0;
    
    console.log(`Team counts from arrays: left=${leftCount}, right=${rightCount}`);
    
    console.log(`User ${userId} team counts by position: left=${leftCount}, right=${rightCount}`);
    
    // Calculate indirect referrals
    const indirectResult = await referralService.getIndirectReferrals(userId, 10);
    let indirectCount = 0;
    if (typeof indirectResult === 'number') {
      indirectCount = indirectResult;
    } else if (Array.isArray(indirectResult)) {
      indirectCount = indirectResult.length;
    }
    
    // Add counts with all possible field names the frontend might be looking for
    user.directReferrals = directCount;
    user.directReferralCount = directCount;
    user.teamSize = directCount + indirectCount; // Total team size is direct + indirect
    user.indirectReferrals = indirectCount;
    
    // Try all possible field names for left/right team
    user.leftTeam = leftCount;
    user.rightTeam = rightCount;
    user.leftCount = leftCount;
    user.rightCount = rightCount;
    user.leftReferrals = leftCount;
    user.rightReferrals = rightCount;
    
    // Nested fields
    if (!user.referral) user.referral = {};
    user.referral.directReferrals = directCount;
    user.referral.directReferralCount = directCount;
    user.referral.teamSize = directCount + indirectCount; // Total team size is direct + indirect
    user.referral.indirectReferrals = indirectCount;
    
    // Log all counts for debugging
    console.log('User counts:', {
      directReferrals: directCount,
      indirectReferrals: indirectCount,
      leftTeam: leftCount,
      rightTeam: rightCount
    });
  } catch (error) {
    console.error('Error calculating referral counts:', error);
  }
  
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