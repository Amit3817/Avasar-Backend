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
import logger from '../config/logger.js';
import mongoose from 'mongoose';

const referralService = {
  // Get direct referrals count for a user
  async getDirectReferrals(userId) {
    return await User.countDocuments({ referredBy: userId });
  },

  // Get indirect referrals for a user (recursive)
  async getIndirectReferrals(userId) {
    async function getIndirect(uId) {
      const directRefs = await User.find({ referredBy: uId }).select('_id');
      let total = directRefs.length;
      for (const ref of directRefs) {
        total += await getIndirect(ref._id);
      }
      return total;
    }
    return await getIndirect(userId);
  },

  // Get indirect referrals for a user (non-recursive, with max level)
  async getIndirectReferrals(userId, maxLevel = 10) {
    let total = 0;
    let currentLevel = [userId];
    
    for (let level = 1; level <= maxLevel; level++) {
      const nextLevel = await User.find({ referredBy: { $in: currentLevel } }).select('_id');
      total += nextLevel.length;
      currentLevel = nextLevel.map(u => u._id);
      if (currentLevel.length === 0) break;
    }
    
    return total;
  },

  // Check and award rewards for user
  async checkAndAwardRewards(user, session = null) {
    for (const milestone of REWARD_MILESTONES) {
      if (user.totalPairs >= milestone.pairs && !(user.awardedRewards || []).includes(milestone.name)) {
        // Award reward (add to awardedRewards, increment rewardIncome if cash)
        user.awardedRewards = user.awardedRewards || [];
        user.awardedRewards.push(milestone.name);
        if (typeof milestone.reward === 'number') {
          user.rewardIncome = (user.rewardIncome || 0) + milestone.reward;
          user.walletBalance = (user.walletBalance || 0) + milestone.reward;
          logger.info(`Awarded ${milestone.name} reward of ₹${milestone.reward} to user ${user._id} for ${milestone.pairs} pairs`);
        } else if (milestone.reward) {
          logger.info(`Awarded ${milestone.name} reward: ${milestone.reward} to user ${user._id} for ${milestone.pairs} pairs`);
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
      // ✅ OPTIMIZED: Single query for payment slip
      const regSlip = await PaymentSlip.findOne({ 
        user: newUserId, 
        status: 'approved', 
        amount: REGISTRATION_AMOUNT 
      }).session(useSession);
      
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
      
      // ✅ OPTIMIZED: Get upline chain in one query
      const uplineChain = await this.getUplineChain(newUserId, useSession);
      
      // ✅ OPTIMIZED: Separate bulk operations to avoid conflicts
      const referralOps = [];
      const matchingOps = [];
      const rewardChecks = [];
      
      for (let level = 1; level <= uplineChain.length; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const requiredDirects = DIRECT_REQS[level] || 0;
        const directCount = await User.countDocuments({ referredBy: parent._id }).session(useSession);
        
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
                  referralIncome: referralIncome,
                  walletBalance: referralIncome,
                  directReferralCount: level === 1 ? 1 : 0
                }
              }
            }
          });
        }
        
        // Matching income (with daily limit check)
        const currentPairsToday = parent.matchingPairsToday?.[today] || 0;
        if (currentPairsToday < MAX_PAIRS_PER_DAY) {
          matchingOps.push({
            updateOne: {
              filter: { _id: parent._id },
              update: {
                $inc: {
                  matchingIncome: pairBonus,
                  totalPairs: 1,
                  walletBalance: pairBonus,
                  [`matchingPairsToday.${today}`]: 1
                }
              }
            }
          });
          
          // Track for reward checking
          rewardChecks.push(parent._id);
        }
      }
      
      // ✅ OPTIMIZED: Execute bulk operations separately
      if (referralOps.length > 0) {
        await User.bulkWrite(referralOps, { session: useSession });
      }
      
      if (matchingOps.length > 0) {
        await User.bulkWrite(matchingOps, { session: useSession });
      }
      
      // Check rewards for users who got matching income
      for (const userId of rewardChecks) {
        try {
          const updatedUser = await User.findById(userId).session(useSession);
          if (updatedUser) {
            await this.checkAndAwardRewards(updatedUser, useSession);
          }
        } catch (rewardError) {
          logger.error(`Failed to check rewards for user ${userId}:`, rewardError);
          // Continue with other users
        }
      }
      
      if (shouldCommit) {
        await useSession.commitTransaction();
      }
      logger.info(`Registration income processed for user ${newUserId}: ${referralOps.length} referral + ${matchingOps.length} matching updates`);
      
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
      logger.error('processRegistrationIncome transaction error:', err);
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
    
    for (let level = 1; level <= 10; level++) {
      const currentUser = await User.findById(currentUserId).select('referredBy').session(session);
      if (!currentUser || !currentUser.referredBy) break;
      
      const parent = await User.findById(currentUser.referredBy).session(session);
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
    logger.info(`Reward income processing triggered for user ${userId} - handled by milestone checks`);
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
        logger.error(`Investor not found: ${investorId}`);
        await session.abortTransaction();
        session.endSession();
        return { success: false, message: 'Investor not found' };
      }
      
      // ✅ OPTIMIZED: Get upline chain once
      const uplineChain = await this.getUplineChain(investorId, session);
      
      // ✅ OPTIMIZED: Separate bulk operations to avoid conflicts
      const oneTimeBonusOps = [];
      const bonusUpdates = [];
      
      for (let level = 1; level <= uplineChain.length; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const directCount = await User.countDocuments({ referredBy: parent._id }).session(session);
        if (directCount < directReqs[level]) continue;
        
        // One-time investment referral bonus
        const oneTimeBonus = Math.floor(investmentAmount * oneTimePercents[level]);
        if (oneTimeBonus > 0) {
          oneTimeBonusOps.push({
            updateOne: {
              filter: { _id: parent._id },
              update: {
                $inc: {
                  investmentReferralIncome: oneTimeBonus,
                  investmentReferralPrincipalIncome: oneTimeBonus,
                  referralInvestmentPrincipal: investmentAmount,
                  walletBalance: oneTimeBonus
                }
              }
            }
          });
        }
        
        // Monthly investment return referral bonus
        const monthlyBonus = Math.floor(monthlyReturn * monthlyPercents[level]);
        if (monthlyBonus > 0) {
          const pending = parent.pendingInvestmentBonuses || [];
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
          $set: { pendingInvestmentBonuses: update.pendingBonuses }
        }, { session });
      }
      
      await session.commitTransaction();
      logger.info(`Investment bonuses processed for investor ${investorId}: ${oneTimeBonusOps.length} updates, ${bonusUpdates.length} bonus schedules`);
      
      return {
        success: true,
        message: 'Investment bonuses processed successfully',
        oneTimeUpdates: oneTimeBonusOps.length,
        monthlySchedules: bonusUpdates.length
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error in processInvestmentBonuses for investor ${investorId}:`, error);
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
      const users = await User.find({ 'pendingInvestmentBonuses.0': { $exists: true } }).session(session);
      let processedCount = 0;
      
      for (const user of users) {
        let updated = false;
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-based
        const currentYear = now.getFullYear();
        
        for (const bonus of user.pendingInvestmentBonuses) {
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
              user.investmentReferralReturnIncome = (user.investmentReferralReturnIncome || 0) + bonus.amount;
              user.walletBalance = (user.walletBalance || 0) + bonus.amount;
              bonus.awarded = true;
              updated = true;
              processedCount++;
              logger.info(`Awarded investment return bonus of ₹${bonus.amount} to user ${user._id} for month ${bonus.month}`);
            }
          }
        }
        
        if (updated) {
          try {
            await user.save({ session });
          } catch (saveError) {
            logger.error(`Failed to save user ${user._id} after bonus update:`, saveError);
            // Continue with other users
          }
        }
      }
      
      await session.commitTransaction();
      logger.info(`Processed ${processedCount} investment return payouts`);
      return {
        success: true,
        message: 'Monthly investment returns processed successfully',
        processedCount: processedCount
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error('Error processing investment return payouts:', error);
      throw error;
    } finally {
      session.endSession();
    }
  },

  // Process registration payment referral income
  async processRegistrationReferralIncome(userId, currentSlipId = null) {
    try {
      logger.info(`Processing registration referral income for user ${userId}`);
      
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
        logger.info(`First registration payment for user ${userId}, triggering referral income`);
        // ✅ OPTIMIZED: Use combined function
        const result = await this.processRegistrationIncome(userId);
        logger.info(`Registration referral income processed successfully for user ${userId}`);
        return result;
      } else {
        logger.info(`Registration payment already processed for user ${userId}`);
        return { success: false, message: 'Registration already processed' };
      }
    } catch (error) {
      logger.error(`Error processing registration referral income for user ${userId}:`, error);
      throw error;
    }
  },

  // Process investment referral income
  async processInvestmentReferralIncome(userId, investmentAmount) {
    try {
      logger.info(`Processing investment referral income for user ${userId} with amount ${investmentAmount}`);
      const result = await this.processInvestmentBonuses(userId, investmentAmount);
      logger.info(`Investment referral income processed successfully for user ${userId}`);
      return result;
    } catch (error) {
      logger.error(`Error processing investment referral income for user ${userId}:`, error);
      throw error;
    }
  },

  // Get user's referral income summary
  async getUserReferralSummary(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) throw new Error('User not found');

      return {
        referralIncome: user.referralIncome || 0,
        matchingIncome: user.matchingIncome || 0,
        rewardIncome: user.rewardIncome || 0,
        investmentReferralIncome: user.investmentReferralIncome || 0,
        investmentReferralPrincipalIncome: user.investmentReferralPrincipalIncome || 0,
        investmentReferralReturnIncome: user.investmentReferralReturnIncome || 0,
        referralInvestmentPrincipal: user.referralInvestmentPrincipal || 0,
        totalPairs: user.totalPairs || 0,
        directReferralCount: user.directReferralCount || 0,
        awardedRewards: user.awardedRewards || []
      };
    } catch (error) {
      logger.error(`Error getting referral summary for user ${userId}:`, error);
      throw error;
    }
  },
};

export default referralService; 