import mongoose from 'mongoose';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import {
  REGISTRATION_AMOUNT,
  REFERRAL_PERCENTS,
  REWARD_MILESTONES,
  MAX_PAIRS_PER_DAY,
  INVESTMENT_ONE_TIME_PERCENTS,
  INVESTMENT_MONTHLY_PERCENTS,
  DIRECT_REQS,
  MONTHLY_ROI_PERCENT,
  INVESTMENT_BONUS_MONTHS
} from '../config/constants.js';

const referralService = {
  // Get direct referrals for a user
  async getDirectReferrals(userId) {
    return await User.find({ 'referral.referredBy': userId }).select('profile.fullName auth.email profile.phone createdAt profile.position');
  },

  // Get indirect referrals for a user (recursive)
  async getIndirectReferrals(userId) {
    async function getIndirect(uId) {
      const directRefs = await User.find({ 'referral.referredBy': uId }).select('_id');
      let allIndirect = [...directRefs];
      for (const ref of directRefs) {
        const indirect = await getIndirect(ref._id);
        allIndirect = [...allIndirect, ...indirect];
      }
      return allIndirect;
    }
    const indirectIds = await getIndirect(userId);
    return await User.find({ _id: { $in: indirectIds.map(u => u._id) } }).select('profile.fullName auth.email profile.phone createdAt profile.position');
  },

  // Get indirect referrals for a user (non-recursive, with max level)
  async getIndirectReferrals(userId, maxLevel = 10) {
    let total = 0;
    let currentLevel = [userId];
    
    for (let level = 1; level <= maxLevel; level++) {
      const nextLevel = await User.find({ 'referral.referredBy': { $in: currentLevel } }).select('_id');
      total += nextLevel.length;
      currentLevel = nextLevel.map(u => u._id);
      if (currentLevel.length === 0) break;
    }
    
    return total;
  },

  // Get direct left referrals (leftChildren)
  async getDirectLeft(userId) {
    const user = await User.findById(userId).select('referral.leftChildren');
    if (!user) return [];
    return await User.find({ _id: { $in: user.referral?.leftChildren || [] } }).select('profile.fullName auth.email profile.phone createdAt profile.position');
  },

  // Get direct right referrals (rightChildren)
  async getDirectRight(userId) {
    const user = await User.findById(userId).select('referral.rightChildren');
    if (!user) return [];
    return await User.find({ _id: { $in: user.referral?.rightChildren || [] } }).select('profile.fullName auth.email profile.phone createdAt profile.position');
  },

  // Check and award rewards for user
  async checkAndAwardRewards(user, session = null) {
    for (const milestone of REWARD_MILESTONES) {
      if (user.system?.totalPairs >= milestone.pairs && !(user.system?.awardedRewards || []).includes(milestone.name)) {
        // Award reward (add to awardedRewards, increment rewardIncome if cash)
        user.system = user.system || {};
        user.system.awardedRewards = user.system.awardedRewards || [];
        user.system.awardedRewards.push(milestone.name);
        if (typeof milestone.reward === 'number') {
          user.income = user.income || {};
          user.income.rewardIncome = (user.income.rewardIncome || 0) + milestone.reward;
          user.income.walletBalance = (user.income.walletBalance || 0) + milestone.reward;
        } else if (milestone.reward) {
        }
        await user.save(session ? { session } : {});
      }
    }
  },

  // Optimized: Process both referral and matching income in one function
  async processRegistrationIncome(newUserId, session = null) {
    const useSession = session || await mongoose.startSession();
    const shouldCommit = !session;
    
    if (shouldCommit) {
      useSession.startTransaction();
    }
    
    try {
      const regSlip = await PaymentSlip.findOne({ user: newUserId, status: 'approved', amount: REGISTRATION_AMOUNT }).session(useSession);
      if (!regSlip) {
        if (shouldCommit) {
          await useSession.abortTransaction();
          useSession.endSession();
        }
        return { success: false, message: 'No approved registration payment found' };
      }
      
      const regAmount = Number(regSlip.amount);
      const pairBonus = Math.floor(regAmount * 0.10);
      const today = new Date().toISOString().slice(0, 10);
      
      // ✅ OPTIMIZED: Get upline chain and new user in parallel
      const [uplineChain, newUser] = await Promise.all([
        this.getUplineChain(newUserId, useSession),
        User.findById(newUserId).select('profile.position').session(useSession)
      ]);
      
      if (!newUser) {
        if (shouldCommit) {
          await useSession.abortTransaction();
          useSession.endSession();
        }
        return { success: false, message: 'New user not found' };
      }
      
      // ✅ OPTIMIZED: Get all direct referral counts in one query
      const uplineIds = uplineChain.map(user => user._id);
      const directCounts = await User.aggregate([
        { $match: { 'referral.referredBy': { $in: uplineIds } } },
        { $group: { _id: '$referral.referredBy', count: { $sum: 1 } } }
      ]).session(useSession);
      
      const directCountMap = new Map(directCounts.map(item => [item._id.toString(), item.count]));
      
      // ✅ OPTIMIZED: Separate bulk operations to avoid conflicts
      const referralOps = [];
      const matchingOps = [];
      const rewardChecks = new Set();
      
      // Process referral income for all levels
      for (let level = 1; level <= uplineChain.length; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const requiredDirects = DIRECT_REQS[level] || 0;
        const directCount = directCountMap.get(parent._id.toString()) || 0;
        
        if (directCount < requiredDirects) continue;
        
        // Referral income
        const referralPercent = REFERRAL_PERCENTS[level] || 0;
        const referralIncome = Math.floor(regAmount * referralPercent);
        
        if (referralIncome > 0) {
          referralOps.push({
            updateOne: {
              filter: { _id: parent._id },
              update: {
                $inc: {
                  'income.referralIncome': referralIncome,
                  'income.walletBalance': referralIncome,
                  'referral.directReferralCount': level === 1 ? 1 : 0
                }
              }
            }
          });
        }
      }
      
      // ✅ FIXED: Matching income - only process for direct referrer (level 1)
      if (uplineChain.length > 0) {
        const directReferrer = uplineChain[0];
        const requiredDirects = DIRECT_REQS[1] || 0;
        const directCount = directCountMap.get(directReferrer._id.toString()) || 0;
        
        if (directCount >= requiredDirects) {
          const leftCount = directReferrer.referral?.leftChildren?.length || 0;
          const rightCount = directReferrer.referral?.rightChildren?.length || 0;
          const newUserPosition = newUser.profile?.position;
          
          // ✅ CRITICAL FIX: Calculate pairs correctly
          // The new user has already been added to leftChildren/rightChildren by authService
          // So we need to calculate pairs based on the current counts
          const currentPairs = Math.min(leftCount, rightCount);
          
          // Calculate pairs before this registration (remove the new user)
          let pairsBefore = currentPairs;
          if (newUserPosition === 'left' && leftCount > 0) {
            pairsBefore = Math.min(leftCount - 1, rightCount);
          } else if (newUserPosition === 'right' && rightCount > 0) {
            pairsBefore = Math.min(leftCount, rightCount - 1);
          }
          
          // Check if new pairs were formed
          const newPairsFormed = currentPairs - pairsBefore;
          
          if (newPairsFormed > 0) {
            // Award matching income for each new pair formed
            for (let pair = 0; pair < newPairsFormed; pair++) {
              // Award matching income to the upline chain for each new pair
              for (let uplineLevel = 1; uplineLevel <= uplineChain.length; uplineLevel++) {
                const uplineParent = uplineChain[uplineLevel - 1];
                if (!uplineParent) break;
                
                const uplineRequiredDirects = DIRECT_REQS[uplineLevel] || 0;
                const uplineDirectCount = directCountMap.get(uplineParent._id.toString()) || 0;
                
                if (uplineDirectCount < uplineRequiredDirects) continue;
                
                // Check daily limit for matching income
                const currentPairsToday = uplineParent.system?.matchingPairsToday?.[today] || 0;
                if (currentPairsToday < MAX_PAIRS_PER_DAY) {
                  matchingOps.push({
                    updateOne: {
                      filter: { _id: uplineParent._id },
                      update: {
                        $inc: {
                          'income.matchingIncome': pairBonus,
                          'system.totalPairs': 1,
                          'income.walletBalance': pairBonus,
                          [`system.matchingPairsToday.${today}`]: 1
                        }
                      }
                    }
                  });
                  
                  // Track for reward checking
                  rewardChecks.add(uplineParent._id.toString());
                }
              }
            }
          }
        }
      }
      
      // ✅ OPTIMIZED: Execute bulk operations separately
      if (referralOps.length > 0) {
        await User.bulkWrite(referralOps, { session: useSession });
      }
      
      if (matchingOps.length > 0) {
        await User.bulkWrite(matchingOps, { session: useSession });
      }
      
      // ✅ OPTIMIZED: Check rewards for users who got matching income
      if (rewardChecks.size > 0) {
        const rewardUserIds = Array.from(rewardChecks);
        const updatedUsers = await User.find({ _id: { $in: rewardUserIds } }).session(useSession);
        
        for (const updatedUser of updatedUsers) {
          try {
            await this.checkAndAwardRewards(updatedUser, useSession);
          } catch (rewardError) {
            // Continue with other users
          }
        }
      }
      
      if (shouldCommit) {
        await useSession.commitTransaction();
      }
      
      return { 
        success: true, 
        message: 'Registration income processed successfully',
        referralUpdates: referralOps.length,
        matchingUpdates: matchingOps.length
      };
    } catch (err) {
      if (shouldCommit) {
        await useSession.abortTransaction();
      }
      throw err;
    } finally {
      if (shouldCommit) {
        useSession.endSession();
      }
    }
  },

  // Helper function to get upline chain
  async getUplineChain(userId, session) {
    const uplineChain = [];
    let currentUserId = userId;
    
    // ✅ OPTIMIZED: Use a more efficient approach to get upline chain
    for (let level = 1; level <= 10; level++) {
      const currentUser = await User.findById(currentUserId)
        .select('referral.referredBy')
        .session(session);
      
      if (!currentUser || !currentUser.referral?.referredBy) break;
      
      const parent = await User.findById(currentUser.referral.referredBy)
        .select('referral.leftChildren referral.rightChildren system.matchingPairsToday')
        .session(session);
      
      if (!parent) break;
      
      uplineChain.push(parent);
      currentUserId = parent._id;
    }
    
    return uplineChain;
  },

  // Process reward income for user (only when milestones are reached)
  async processRewardIncome(userId) {
    // This function is now only called when milestones are reached
    // The actual reward processing is handled in checkAndAwardRewards()
  },

  // Optimized: Process investment bonuses for upline users
  async processInvestmentBonuses(investorId, investmentAmount) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const oneTimePercents = INVESTMENT_ONE_TIME_PERCENTS;
      const monthlyPercents = INVESTMENT_MONTHLY_PERCENTS;
      const directReqs = DIRECT_REQS;
      const monthlyReturn = investmentAmount * MONTHLY_ROI_PERCENT;
      
      const currentUser = await User.findById(investorId).session(session);
      if (!currentUser) {
        await session.abortTransaction();
        session.endSession();
        return { success: false, message: 'Investor not found' };
      }
      
      // ✅ OPTIMIZED: Get upline chain once
      const uplineChain = await this.getUplineChain(investorId, session);
      
      // ✅ OPTIMIZED: Get all direct referral counts in one query
      const uplineIds = uplineChain.map(user => user._id);
      const directCounts = await User.aggregate([
        { $match: { 'referral.referredBy': { $in: uplineIds } } },
        { $group: { _id: '$referral.referredBy', count: { $sum: 1 } } }
      ]).session(session);
      
      const directCountMap = new Map(directCounts.map(item => [item._id.toString(), item.count]));
      
      // ✅ OPTIMIZED: Separate bulk operations to avoid conflicts
      const oneTimeBonusOps = [];
      const bonusUpdates = [];
      
      for (let level = 1; level <= uplineChain.length; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const directCount = directCountMap.get(parent._id.toString()) || 0;
        if (directCount < directReqs[level]) continue;
        
        // One-time investment referral bonus
        const oneTimeBonus = Math.floor(investmentAmount * oneTimePercents[level]);
        if (oneTimeBonus > 0) {
          oneTimeBonusOps.push({
            updateOne: {
              filter: { _id: parent._id },
              update: {
                $inc: {
                  'income.investmentReferralIncome': oneTimeBonus,
                  'income.investmentReferralPrincipalIncome': oneTimeBonus,
                  'income.referralInvestmentPrincipal': investmentAmount,
                  'income.walletBalance': oneTimeBonus
                }
              }
            }
          });
        }
        
        // Monthly investment return referral bonus
        const monthlyBonus = Math.floor(monthlyReturn * monthlyPercents[level]);
        if (monthlyBonus > 0) {
          const pending = parent.investment?.pendingInvestmentBonuses || [];
          for (let m = 0; m < INVESTMENT_BONUS_MONTHS; m++) {
            pending.push({
              investor: investorId,
              amount: monthlyBonus,
              month: m + 1,
              awarded: false,
              createdAt: new Date(),
              type: 'investmentReturn'
            });
          }
          
          bonusUpdates.push({
            userId: parent._id,
            pendingBonuses: pending
          });
        }
      }
      
      // ✅ OPTIMIZED: Execute bulk operations
      if (oneTimeBonusOps.length > 0) {
        await User.bulkWrite(oneTimeBonusOps, { session });
      }
      
      // Update pending bonuses
      for (const update of bonusUpdates) {
        await User.findByIdAndUpdate(update.userId, {
          $set: { 'investment.pendingInvestmentBonuses': update.pendingBonuses }
        }, { session });
      }
      
      await session.commitTransaction();
      
      return {
        success: true,
        message: 'Investment bonuses processed successfully',
        oneTimeUpdates: oneTimeBonusOps.length,
        monthlySchedules: bonusUpdates.length
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  // Process monthly investment return payouts for upline users
  async processMonthlyInvestmentReturns() {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const users = await User.find({ 'investment.pendingInvestmentBonuses.0': { $exists: true } }).session(session);
      let processedCount = 0;
      
      for (const user of users) {
        let updated = false;
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-based
        const currentYear = now.getFullYear();
        
        for (const bonus of user.investment?.pendingInvestmentBonuses || []) {
          // Only process if not already awarded and for the current month/year
          if (!bonus.awarded && bonus.type === 'investmentReturn') {
            const bonusDate = new Date(bonus.createdAt);
            
            // Calculate the target month/year for this bonus
            const targetDate = new Date(bonusDate);
            targetDate.setMonth(targetDate.getMonth() + bonus.month);
            
            const targetMonth = targetDate.getMonth() + 1; // 1-based
            const targetYear = targetDate.getFullYear();
            
            if (targetMonth === currentMonth && targetYear === currentYear) {
              // Award the monthly investment return bonus
              user.income = user.income || {};
              user.income.investmentReferralReturnIncome = (user.income.investmentReferralReturnIncome || 0) + bonus.amount;
              user.income.walletBalance = (user.income.walletBalance || 0) + bonus.amount;
              bonus.awarded = true;
              updated = true;
              processedCount++;
            }
          }
        }
        
        if (updated) {
          try {
            await user.save({ session });
          } catch (saveError) {
            // Continue with other users
          }
        }
      }
      
      await session.commitTransaction();
      
      return {
        success: true,
        message: 'Monthly investment returns processed successfully',
        processedCount: processedCount
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  // Process registration payment referral income
  async processRegistrationReferralIncome(userId, currentSlipId = null) {
    try {
      // Check if this is the first approved registration payment (excluding current slip)
      const query = { 
        user: userId, 
        status: 'approved', 
        amount: 3600 
      };
      
      // Exclude current payment slip if provided
      if (currentSlipId) {
        query._id = { $ne: currentSlipId };
      }
      
      const prevApproved = await PaymentSlip.findOne(query);
      
      if (!prevApproved) {
        // ✅ OPTIMIZED: Use combined function
        const result = await this.processRegistrationIncome(userId);
        return result;
      } else {
        return { success: false, message: 'Registration already processed' };
      }
    } catch (error) {
      throw error;
    }
  },

  // Process investment referral income
  async processInvestmentReferralIncome(userId, investmentAmount) {
    try {
      const result = await this.processInvestmentBonuses(userId, investmentAmount);
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Get user's referral income summary
  async getUserReferralSummary(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) throw new Error('User not found');

      return {
        referralIncome: user.income?.referralIncome || 0,
        matchingIncome: user.income?.matchingIncome || 0,
        rewardIncome: user.income?.rewardIncome || 0,
        investmentReferralIncome: user.income?.investmentReferralIncome || 0,
        investmentReferralPrincipalIncome: user.income?.investmentReferralPrincipalIncome || 0,
        investmentReferralReturnIncome: user.income?.investmentReferralReturnIncome || 0,
        referralInvestmentPrincipal: user.referralInvestmentPrincipal || 0,
        totalPairs: user.system?.totalPairs || 0,
        directReferralCount: user.directReferralCount || 0,
        awardedRewards: user.system?.awardedRewards || []
      };
    } catch (error) {
      throw error;
    }
  },

  // Calculate and update user's team statistics
  async updateUserTeamStats(userId) {
    try {
      // Calculate direct referrals
      const directCount = await User.countDocuments({ 'referral.referredBy': userId });
      
      // Calculate total team size (direct + indirect)
      const indirectCount = await this.getIndirectReferrals(userId, 10);
      const totalTeamSize = directCount + indirectCount;
      
      // Update user with calculated stats
      await User.findByIdAndUpdate(userId, {
        directReferrals: directCount,
        teamSize: totalTeamSize
      });
      
      return { directReferrals: directCount, teamSize: totalTeamSize };
    } catch (error) {
      throw error;
    }
  },
};

export default referralService; 