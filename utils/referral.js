import User from '../models/User.js';
import crypto from 'crypto';
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

const REFERRAL_CODE_LENGTH = 8;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, 1, O, I, l

function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export async function generateUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateCode();
    exists = await User.exists({ referralCode: code });
  }
  return code;
}

export async function addReferralIncome(newUserId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const PaymentSlip = (await import('../models/PaymentSlip.js')).default;
    const regSlip = await PaymentSlip.findOne({ user: newUserId, status: 'approved', amount: REGISTRATION_AMOUNT }).session(session);
    if (!regSlip) { await session.abortTransaction(); session.endSession(); return; }
    const regAmount = Number(regSlip.amount);
    let currentUser = await User.findById(newUserId).session(session);
    for (let level = 1; level <= 10; level++) {
      if (!currentUser || !currentUser.referredBy) break;
      const parent = await User.findById(currentUser.referredBy).session(session);
      if (!parent) break;
      let requiredDirects = DIRECT_REQS[level] || 0;
      const directCount = await User.countDocuments({ referredBy: parent._id }).session(session);
      if (directCount < requiredDirects) {
        currentUser = parent;
        continue;
      }
      let percent = REFERRAL_PERCENTS[level] || 0;
      const income = Math.floor(regAmount * percent);
      await User.findByIdAndUpdate(parent._id, {
        $inc: {
          referralIncome: income,
          walletBalance: income,
          directReferralCount: level === 1 ? 1 : 0
        }
      }, { session });
      currentUser = parent;
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    logger.error('addReferralIncome transaction error:', err);
    throw err;
  } finally {
    session.endSession();
  }
}

async function checkAndAwardRewards(user) {
  for (const milestone of REWARD_MILESTONES) {
    if (user.totalPairs >= milestone.pairs && !(user.awardedRewards || []).includes(milestone.name)) {
      // Award reward (add to awardedRewards, increment rewardIncome if cash)
      user.awardedRewards = user.awardedRewards || [];
      user.awardedRewards.push(milestone.name);
      if (typeof milestone.reward === 'number') {
        user.rewardIncome = (user.rewardIncome || 0) + milestone.reward;
        user.walletBalance = (user.walletBalance || 0) + milestone.reward;
      }
      await user.save();
    }
  }
}

export async function addMatchingIncome(newUserId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const PaymentSlip = (await import('../models/PaymentSlip.js')).default;
    const regSlip = await PaymentSlip.findOne({ user: newUserId, status: 'approved', amount: REGISTRATION_AMOUNT }).session(session);
    if (!regSlip) { await session.abortTransaction(); session.endSession(); return; }
    const regAmount = Number(regSlip.amount);
    const pairBonus = Math.floor(regAmount * 0.10);
    const maxPairsPerDay = MAX_PAIRS_PER_DAY;
    let currentUser = await User.findById(newUserId).session(session);
    for (let level = 1; level <= 10; level++) {
      if (!currentUser || !currentUser.referredBy) break;
      const parent = await User.findById(currentUser.referredBy).session(session);
      if (!parent) break;
      let requiredDirects = DIRECT_REQS[level] || 0;
      const directCount = await User.countDocuments({ referredBy: parent._id }).session(session);
      if (directCount < requiredDirects) {
        currentUser = parent;
        continue;
      }
      const today = new Date().toISOString().slice(0, 10);
      parent.matchingPairsToday = parent.matchingPairsToday || {};
      parent.matchingPairsToday[today] = parent.matchingPairsToday[today] || 0;
      if (parent.matchingPairsToday[today] >= maxPairsPerDay) {
        currentUser = parent;
        continue;
      }
      const result = await User.findByIdAndUpdate(parent._id, {
        $inc: {
          matchingIncome: pairBonus,
          totalPairs: 1,
          walletBalance: pairBonus,
          [`matchingPairsToday.${today}`]: 1
        }
      }, { new: true, session });
      if (!result) {
        logger.error(`Failed to update matching income for user ${parent._id}`);
        continue;
      }
      const updatedParent = await User.findById(parent._id).session(session);
      await checkAndAwardRewards(updatedParent);
      currentUser = parent;
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    logger.error('addMatchingIncome transaction error:', err);
    throw err;
  } finally {
    session.endSession();
  }
}

export async function addRewardIncome(userId) {
  // Add reward income for registration (this should be based on business logic)
  // For now, using a fixed amount but this should be calculated based on the registration
  const rewardAmount = 200; // This should come from business logic
  await User.findByIdAndUpdate(userId, { 
    $inc: { 
      rewardIncome: rewardAmount,
      walletBalance: rewardAmount 
    } 
  });
}

// Investment bonus logic
export async function addInvestmentBonuses(investorId, investmentAmount) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const oneTimePercents = INVESTMENT_ONE_TIME_PERCENTS;
    const monthlyPercents = INVESTMENT_MONTHLY_PERCENTS;
    const directReqs = DIRECT_REQS;
    const monthlyReturn = investmentAmount * MONTHLY_ROI_PERCENT;
    let currentUser = await User.findById(investorId).session(session);
    if (!currentUser) {
      logger.error(`Investor not found: ${investorId}`);
      await session.abortTransaction();
      session.endSession();
      return;
    }
    for (let level = 1; level <= 10; level++) {
      if (!currentUser || !currentUser.referredBy) break;
      const parent = await User.findById(currentUser.referredBy).session(session);
      if (!parent) break;
      const directCount = await User.countDocuments({ referredBy: parent._id }).session(session);
      if (directCount < directReqs[level]) {
        currentUser = parent;
        continue;
      }
      
      // One-time investment referral bonus
      const oneTimeBonus = Math.floor(investmentAmount * oneTimePercents[level]);
      if (oneTimeBonus > 0) {
        try {
          await User.findByIdAndUpdate(parent._id, {
            $inc: {
              investmentReferralIncome: oneTimeBonus,
              investmentReferralPrincipalIncome: oneTimeBonus,
              referralInvestmentPrincipal: investmentAmount,
              walletBalance: oneTimeBonus
            }
          }, { session });
        } catch (error) {
          logger.error(`Failed to update one-time bonus for user ${parent._id}:`, error);
        }
      }
      
      // Monthly investment return referral bonus
      const monthlyBonus = Math.floor(monthlyReturn * monthlyPercents[level]);
      if (monthlyBonus > 0) {
        try {
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
          await User.findByIdAndUpdate(parent._id, { 
            $set: { pendingInvestmentBonuses: pending }
          }, { session });
        } catch (error) {
          logger.error(`Failed to update monthly bonuses for user ${parent._id}:`, error);
        }
      }
      currentUser = parent;
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Error in addInvestmentBonuses for investor ${investorId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

// Process monthly investment return payouts for upline users
export async function processInvestmentReturnPayouts() {
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
          const bonusMonth = bonusDate.getMonth() + bonus.month;
          const bonusYear = bonusDate.getFullYear() + Math.floor((bonusDate.getMonth() + bonus.month - 1) / 12);
          
          if (bonusMonth === currentMonth && bonusYear === currentYear) {
            // Award the monthly investment return bonus
            user.investmentReferralReturnIncome = (user.investmentReferralReturnIncome || 0) + bonus.amount;
            user.walletBalance = (user.walletBalance || 0) + bonus.amount;
            bonus.awarded = true;
            updated = true;
            processedCount++;
          }
        }
      }
      
      if (updated) {
        await user.save({ session });
      }
    }
    
    await session.commitTransaction();
    logger.info(`Processed ${processedCount} investment return payouts`);
    return processedCount;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Error processing investment return payouts:', error);
    throw error;
  } finally {
    session.endSession();
  }
} 