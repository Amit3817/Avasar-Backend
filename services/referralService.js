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
import logger from '../config/logger.js';
import {createUserHistory} from "./historyService.js";
import dotenv from 'dotenv';
dotenv.config()

const ADMIN_ID = process.env.ADMIN_USER_ID||"687d3cc06f562dea317361ec"; // Replace with actual admin user ID

const referralService = {
  // Get direct referrals for a user
  async getDirectReferrals(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      // Use proper path for referredBy field
      return await User.find({ 'referral.referredBy': new mongoose.Types.ObjectId(userId) })
        .select('profile.fullName auth.email profile.phone createdAt profile.position');
    } catch (error) {
      logger.error('Error in getDirectReferrals:', error);
      return [];
    }
  },

  // Get indirect referrals for a user (non-recursive, with max level)
  async getIndirectReferrals(userId, maxLevel = 10) {
    try {
      // Validate userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return 0; // Return 0 for invalid IDs
      }
      
      // First get direct referrals to exclude them from indirect results
      const directReferrals = await User.find({ 'referral.referredBy': new mongoose.Types.ObjectId(userId) })
        .select('_id')
        .lean();
      
      const directReferralIds = directReferrals.map(user => user._id);
      
      let total = 0;
      let allIndirectUsers = [];
      let currentLevel = directReferralIds; // Start with direct referrals as first level
      
      // Skip level 1 (direct referrals) and start from level 2
      for (let level = 2; level <= maxLevel; level++) {
        if (currentLevel.length === 0) break;
        
        // Use aggregation for better performance
        const nextLevelResult = await User.aggregate([
          { $match: { 'referral.referredBy': { $in: currentLevel } } },
          { $project: { _id: 1 } }
        ]);
        
        // Store all indirect users for admin panel
        allIndirectUsers = [...allIndirectUsers, ...nextLevelResult.map(u => u._id)];
        
        total += nextLevelResult.length;
        currentLevel = nextLevelResult.map(u => u._id);
      }
      
      // For admin panel, return the array of user IDs
      // For regular count, return the number
      return allIndirectUsers.length > 0 ? allIndirectUsers : total;
    } catch (error) {
      logger.error('Error in getIndirectReferrals:', error);
      return [];
    }
  },
  
  // Get indirect referrals with details
  async getIndirectReferralsWithDetails(userId, maxLevel = 3) {
    try {
      let allUsers = [];
      let currentLevel = [new mongoose.Types.ObjectId(userId)];
      
      for (let level = 1; level <= maxLevel; level++) {
        if (currentLevel.length === 0) break;
        
        // Get next level users with projection for needed fields only
        const nextLevelUsers = await User.find(
          { 'referral.referredBy': { $in: currentLevel } },
          'profile.fullName auth.email profile.phone createdAt profile.position'
        ).lean();
        
        // Add level information to each user
        const usersWithLevel = nextLevelUsers.map(user => ({
          ...user,
          level
        }));
        
        allUsers = [...allUsers, ...usersWithLevel];
        currentLevel = nextLevelUsers.map(u => u._id);
      }
      
      return allUsers;
    } catch (error) {
      logger.error('Error in getIndirectReferralsWithDetails:', error);
      return [];
    }
  },

  // Get direct left referrals (leftChildren) - optimized with aggregation
  async getDirectLeft(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      // First check if the user exists and has the correct schema structure
      const user = await User.findById(userId).select('referral.leftChildren');
      if (!user || !user.referral || !Array.isArray(user.referral.leftChildren)) {
        return [];
      }
      
      // If no left children, return empty array immediately
      if (user.referral.leftChildren.length === 0) {
        return [];
      }
      
      // Use direct find instead of aggregation for simpler query
      return await User.find({ 
        _id: { $in: user.referral.leftChildren } 
      }).select('profile.fullName auth.email profile.phone createdAt profile.position').lean();
    } catch (error) {
      logger.error('Error in getDirectLeft:', error);
      return [];
    }
  },

  // Get direct right referrals (rightChildren) - optimized with simpler approach
  async getDirectRight(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return [];
      }
      
      // First check if the user exists and has the correct schema structure
      const user = await User.findById(userId).select('referral.rightChildren');
      if (!user || !user.referral || !Array.isArray(user.referral.rightChildren)) {
        return [];
      }
      
      // If no right children, return empty array immediately
      if (user.referral.rightChildren.length === 0) {
        return [];
      }
      
      // Use direct find instead of aggregation for simpler query
      return await User.find({ 
        _id: { $in: user.referral.rightChildren } 
      }).select('profile.fullName auth.email profile.phone createdAt profile.position').lean();
    } catch (error) {
      logger.error('Error in getDirectRight:', error);
      return [];
    }
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
          await createUserHistory({
          userId: user._id,
          type: 'reward',
          amount: milestone.reward,
          remarks: `Milestone "${milestone.name}" achieved for ${milestone.pairs} pairs`
        }, session);
        } else if (milestone.reward) {
        }
        await user.save(session ? { session } : {});
      }
    }
  },

  // Process both referral and matching income in one function
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
      // Get upline chain and new user in parallel
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
      const uplineIds = uplineChain.map(user => user._id);
      const directCounts = await User.aggregate([
        { $match: { 'referral.referredBy': { $in: uplineIds } } },
        { $group: { _id: '$referral.referredBy', count: { $sum: 1 } } }
      ]).session(useSession);
      const directCountMap = new Map(directCounts.map(item => [item._id.toString(), item.count]));
      const referralOps = [];
      const matchingOps = [];
      const rewardChecks = new Set();
      // Process referral income for all levels
      for (let level = 1; level <= uplineChain.length; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const requiredDirects = DIRECT_REQS[level] || 0;
        const directCount = directCountMap.get(parent._id.toString()) || 0;
        
        
        // Referral income
        const referralPercent = REFERRAL_PERCENTS[level] || 0;
        const referralIncome = Math.floor(regAmount * referralPercent);
        
        if (directCount < requiredDirects) {
  const amt = referralIncome;
  if (amt > 0) {
    referralOps.push({ updateOne: { filter: { _id: ADMIN_ID }, update: { $inc: { 'income.referralIncome': amt, 'income.walletBalance': amt } } } });
    await createUserHistory({ userId: ADMIN_ID, type: "extra-referral", amount: amt, remarks: `Redirected L${level} income from ${newUserId}` }, useSession);
    logger.info(`Referral ₹${amt} redirected to Admin from L${level}, user ${parent._id}`);
  }
  continue;
}

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
          await createUserHistory({
            userId: parent._id,
            type: "referral",
            amount: referralIncome,
            remarks: `Level ${level} referral income from user ${newUserId}`,
          }, useSession);

          logger.info(`Referral income awarded: User ${parent._id} received ₹${referralIncome} at level ${level}`);
        }
      }
      
      // Process matching income for all upline users
      if (uplineChain.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        let directParentFormedPair = false;
        for (let uplineLevel = 0; uplineLevel < uplineChain.length; uplineLevel++) {
          let uplineParent = uplineChain[uplineLevel];
          if (!uplineParent) continue;
          // Always fetch the latest user document from the database
          uplineParent = await User.findById(uplineParent._id).lean();
          if (!uplineParent) continue;
          
          const uplineRequiredDirects = DIRECT_REQS[uplineLevel + 1] || 0;
          const uplineDirectCount = directCountMap.get(uplineParent._id.toString()) || 0;
          
          if (uplineDirectCount < uplineRequiredDirects) {
  matchingOps.push({
    updateOne: {
      filter: { _id: ADMIN_ID },
      update: {
        $inc: {
          'income.matchingIncome': pairBonus,
          'income.walletBalance': pairBonus,
          'system.totalPairs': 1,
          [`system.matchingPairsToday.${today}`]: 1
        }
      }
    }
  });
  await createUserHistory({
    userId: ADMIN_ID,
    type: "extra-matching",
    amount: pairBonus,
    remarks: `Redirected matching income from ineligible user ${uplineParent._id} for ${newUserId}`
  }, useSession);
  logger.info(`Matching income ₹${pairBonus} redirected to Admin from user ${uplineParent._id}`);
  continue;
}

          
          let pairsToAward = 0;
          if (uplineLevel === 0) {
            // For direct parent, check left/right children for new pair
            const leftCount = uplineParent.referral?.leftChildren?.length || 0;
            const rightCount = uplineParent.referral?.rightChildren?.length || 0;
            const prevPairs = uplineParent.system?.pairs || 0;
            const newPairs = Math.min(leftCount, rightCount);
            pairsToAward = newPairs > prevPairs ? 1 : 0;
            directParentFormedPair = pairsToAward === 1;
            logger.info(`Matching bonus calc (direct parent): user=${uplineParent._id}, leftCount=${leftCount}, rightCount=${rightCount}, prevPairs=${prevPairs}, newPairs=${newPairs}, pairsToAward=${pairsToAward}, currentPairsToday=${uplineParent.system?.matchingPairsToday?.[today] || 0}`);
            // Always set system.pairs for direct parent
            if (pairsToAward > 0) {
              const currentPairsToday = uplineParent.system?.matchingPairsToday?.[today] || 0;
              const pairsToAwardToday = Math.min(pairsToAward, MAX_PAIRS_PER_DAY - currentPairsToday);
              if (pairsToAwardToday <= 0) {
  // Redirect to admin
  matchingOps.push({
    updateOne: {
      filter: { _id: ADMIN_ID },
      update: {
        $inc: {
          'income.matchingIncome': pairBonus,
          'income.walletBalance': pairBonus,
          'system.totalPairs': 1,
          [`system.matchingPairsToday.${today}`]: 1
        }
      }
    }
  });
  await createUserHistory({
    userId: ADMIN_ID,
    type: "extra-matching",
    amount: pairBonus,
    remarks: `Redirected matching bonus (pair cap reached) from ${uplineParent._id} for new user ${newUserId}`,
  }, useSession);
  logger.info(`Matching income ₹${pairBonus} redirected to Admin (cap reached for user ${uplineParent._id})`);
  continue;
}

              if (pairsToAwardToday > 0) {
                matchingOps.push({
                  updateOne: {
                    filter: { _id: uplineParent._id },
                    update: {
                      $inc: {
                        'income.matchingIncome': pairBonus * pairsToAwardToday,
                        'system.totalPairs': pairsToAwardToday,
                        'income.walletBalance': pairBonus * pairsToAwardToday,
                        [`system.matchingPairsToday.${today}`]: pairsToAwardToday
                      },
                      $set: {
                        'system.pairs': newPairs
                      }
                    }
                  }
                });
                await createUserHistory({
                  userId: uplineParent._id,
                  type: "matching",
                  amount: pairBonus * pairsToAwardToday,
                  remarks: `Matching income for ${pairsToAwardToday} pair(s) from new user ${newUserId}`,
                }, useSession);

                logger.info(`Matching income awarded: User ${uplineParent._id} received ₹${pairBonus * pairsToAwardToday} for ${pairsToAwardToday} new pairs (now totalPairs=${(uplineParent.system?.totalPairs || 0) + pairsToAwardToday})`);
                rewardChecks.add(uplineParent._id.toString());
              }
            }
          } else {
            // For higher-level uplines, only award if direct parent formed a new pair
            if (!directParentFormedPair) break;
            pairsToAward = 1;
            logger.info(`Matching bonus calc (upline): user=${uplineParent._id}, pairsToAward=${pairsToAward}, currentPairsToday=${uplineParent.system?.matchingPairsToday?.[today] || 0}`);
            const currentPairsToday = uplineParent.system?.matchingPairsToday?.[today] || 0;
            const pairsToAwardToday = Math.min(pairsToAward, MAX_PAIRS_PER_DAY - currentPairsToday);
            if (pairsToAwardToday <= 0) {
  // Redirect to admin
  matchingOps.push({
    updateOne: {
      filter: { _id: ADMIN_ID },
      update: {
        $inc: {
          'income.matchingIncome': pairBonus,
          'income.walletBalance': pairBonus,
          'system.totalPairs': 1,
          [`system.matchingPairsToday.${today}`]: 1
        }
      }
    }
  });
  await createUserHistory({
    userId: ADMIN_ID,
    type: "extra-matching",
    amount: pairBonus,
    remarks: `Redirected matching bonus (pair cap reached) from ${uplineParent._id} for new user ${newUserId}`,
  }, useSession);
  logger.info(`Matching income ₹${pairBonus} redirected to Admin (cap reached for user ${uplineParent._id})`);
  continue;
}
            if (pairsToAwardToday > 0) {
              matchingOps.push({
                updateOne: {
                  filter: { _id: uplineParent._id },
                  update: {
                    $inc: {
                      'income.matchingIncome': pairBonus * pairsToAwardToday,
                      'system.totalPairs': pairsToAwardToday,
                      'income.walletBalance': pairBonus * pairsToAwardToday,
                      [`system.matchingPairsToday.${today}`]: pairsToAwardToday
                    }
                  }
                }
              });
              await createUserHistory({
                userId: uplineParent._id,
                type: "matching",
                amount: pairBonus * pairsToAwardToday,
                remarks: `Matching income for ${pairsToAwardToday} pair(s) from new user ${newUserId}`,
              }, useSession);

              logger.info(`Matching income awarded: User ${uplineParent._id} received ₹${pairBonus * pairsToAwardToday} for ${pairsToAwardToday} new pairs (now totalPairs=${(uplineParent.system?.totalPairs || 0) + pairsToAwardToday})`);
              rewardChecks.add(uplineParent._id.toString());
            }
          }
        }
      }
      
      // Execute bulk operations separately
      if (referralOps.length > 0) {
        await User.bulkWrite(referralOps, { session: useSession });
      }
      
      if (matchingOps.length > 0) {
        await User.bulkWrite(matchingOps, { session: useSession });
      }
      
      // Check rewards for users who got matching income
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

  // Helper function to get upline chain - optimized to reduce DB calls
  async getUplineChain(userId, session) {
    // Use aggregation to get the entire upline chain in one query
    // This is much more efficient than multiple separate queries
    const pipeline = [
      { $match: { _id: new mongoose.Types.ObjectId(userId) } },
      { $graphLookup: {
          from: 'users',
          startWith: '$referral.referredBy',
          connectFromField: 'referral.referredBy',
          connectToField: '_id',
          as: 'uplineChain',
          maxDepth: 9, // 10 levels max including the starting point
          depthField: 'level'
      }},
      { $project: {
          uplineChain: {
            _id: 1,
            'referral.leftChildren': 1,
            'referral.rightChildren': 1,
            'system.matchingPairsToday': 1,
            level: 1
          }
      }}
    ];
    
    const result = session
      ? await User.aggregate(pipeline).session(session)
      : await User.aggregate(pipeline);
    
    if (result.length === 0) return [];
    
    // Sort by level to maintain the correct order (closest upline first)
    return result[0].uplineChain.sort((a, b) => a.level - b.level);
  },

  // Process reward income for user (only when milestones are reached)
  async processRewardIncome(userId) {
    try {
      // This function is now only called when milestones are reached
      // The actual reward processing is handled in checkAndAwardRewards()
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };
      
      await this.checkAndAwardRewards(user);
      return { success: true, message: 'Rewards processed successfully' };
    } catch (error) {
      logger.error('Error in processRewardIncome:', error);
      return { success: false, message: error.message || 'Failed to process rewards' };
    }
  },

  // Process investment bonuses for upline users
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
      
      const uplineChain = await this.getUplineChain(investorId, session);
      
      const uplineIds = uplineChain.map(user => user._id);
      const directCounts = await User.aggregate([
        { $match: { 'referral.referredBy': { $in: uplineIds } } },
        { $group: { _id: '$referral.referredBy', count: { $sum: 1 } } }
      ]).session(session);
      
      const directCountMap = new Map(directCounts.map(item => [item._id.toString(), item.count]));
      const oneTimeBonusOps = [];
      const bonusUpdates = [];
      
      for (let level = 1; level <= uplineChain.length && level <= 10; level++) {
        const parent = uplineChain[level - 1];
        if (!parent) break;
        
        const directCount = directCountMap.get(parent._id.toString()) || 0;
        const requiredDirects = directReqs[level];
        
        
if (directCount < requiredDirects) {
  const oneTimeBonus = Math.floor(investmentAmount * oneTimePercents[level]);
  const monthlyBonus = Math.floor(monthlyReturn * monthlyPercents[level]);

  if (oneTimeBonus > 0) {
    oneTimeBonusOps.push({
      updateOne: {
        filter: { _id: ADMIN_ID },
        update: {
          $inc: {
            'income.investmentReferralIncome': oneTimeBonus,
            'income.investmentReferralPrincipalIncome': oneTimeBonus,
            'income.referralInvestmentPrincipal': investmentAmount,
            'income.walletBalance': oneTimeBonus,
            'investment.teamInvestment': investmentAmount
          }
        }
      }
    });

    await createUserHistory({
      userId: ADMIN_ID,
      type: "extra-investment-referral",
      amount: oneTimeBonus,
      remarks: `Redirected L${level} investment bonus from ${parent._id} for investor ${investorId}`
    }, session);
  }

  if (monthlyBonus > 0) {
    const now = new Date();
    const investmentId = new mongoose.Types.ObjectId();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const newBonuses = [];

    for (let m = 0; m < INVESTMENT_BONUS_MONTHS; m++) {
      newBonuses.push({
        investor: investorId,
        investmentId,
        amount: monthlyBonus,
        month: m + 1,
        awarded: false,
        createdAt: startDate,
        type: 'investmentReturn'
      });
    }

    bonusUpdates.push({
      userId: ADMIN_ID,
      newBonuses
    });

    await createUserHistory({
      userId: ADMIN_ID,
      type: 'extra-monthly-investment-bonus',
      amount: monthlyBonus * INVESTMENT_BONUS_MONTHS,
      remarks: `Redirected ₹${monthlyBonus}×6 from L${level} user ${parent._id} for investor ${investorId}`
    }, session);
  }

  continue;
}

        
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
                  'income.walletBalance': oneTimeBonus,
                  'investment.teamInvestment': investmentAmount
                }
              }
            }
          });
           await createUserHistory({
   userId: parent._id,
   type: "investment-referral",
   amount: oneTimeBonus,
   remarks: `One-time investment bonus from level ${level} for investor ${investorId}`
 }, session);
          logger.info(`Investment referral bonus awarded: User ${parent._id} received ₹${oneTimeBonus} at level ${level}`);
        }
        
        // Monthly investment return referral bonus - for first 6 months only
        const monthlyBonus = Math.floor(monthlyReturn * monthlyPercents[level]);
        if (monthlyBonus > 0) {
          
          // Schedule bonuses for exactly 6 months
          // These will be processed one at a time as each month elapses
          const now = new Date();
          const investmentId = new mongoose.Types.ObjectId(); // Generate a unique ID for this investment
          
          // Calculate the exact start date for the investment
          // This ensures bonuses are processed at the correct time each month
          const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
          
          const newBonuses = [];
          for (let m = 0; m < INVESTMENT_BONUS_MONTHS; m++) {
            newBonuses.push({
              investor: investorId,
              investmentId: investmentId, // Add investment ID to group related bonuses
              amount: monthlyBonus,
              month: m + 1, // 1-based month number (1 to 6)
              awarded: false,
              createdAt: startDate, // Investment start date - important for tracking elapsed months
              type: 'investmentReturn'
            });
          }
          bonusUpdates.push({
            userId: parent._id,
            newBonuses
          });
           await createUserHistory({
   userId: parent._id,
   type: 'monthly-investment-bonus',
   amount: monthlyBonus * INVESTMENT_BONUS_MONTHS,
   remarks: `Scheduled ₹${monthlyBonus} for 6 months (level ${level}) from investor ${investorId}`
}, session);
          logger.info(`Monthly investment return bonus scheduled: User ${parent._id} will receive ₹${monthlyBonus} for 6 months at level ${level}`);
        }
      }
      
      // Execute bulk operations
      if (oneTimeBonusOps.length > 0) {
        await User.bulkWrite(oneTimeBonusOps, { session });
      }
      
      // Append new pending bonuses instead of replacing the array
      for (const update of bonusUpdates) {
        if (update.newBonuses && update.newBonuses.length > 0) {
          await User.findByIdAndUpdate(update.userId, {
            $push: { 'investment.pendingInvestmentBonuses': { $each: update.newBonuses } }
          }, { session });
        }
      }
      
      await session.commitTransaction();
      
      return {
        success: true,
        message: 'Investment bonuses processed successfully',
        oneTimeUpdates: oneTimeBonusOps.length,
        monthlySchedules: bonusUpdates.length
      };
    } catch (error) {
      logger.error('Error processing investment bonuses:', error);
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Corrected implementation of processMonthlyInvestmentReturns
   * 
   * This function processes monthly investment return bonuses for upline users.
   * It ensures that bonuses are processed in the correct order (month by month)
   * and only for the first 6 months.
   * 
   * To use this function, replace the existing processMonthlyInvestmentReturns
   * in referralService.js with this implementation.
   */
  async processMonthlyInvestmentReturns() {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      
      // Find all users with pending investment bonuses
      const users = await User.find({ 'investment.pendingInvestmentBonuses.0': { $exists: true } }).session(session);
      
      // Get current date info for month calculation
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-based
      const currentYear = now.getFullYear();
      
      // For testing/debugging: Process all due bonuses regardless of month
      const processAllDueBonuses = process.env.NODE_ENV !== 'production';
      let processedCount = 0;
      
      // Process each user
      for (const user of users) {
        // Skip users with no pending bonuses
        const pendingBonuses = user.investment?.pendingInvestmentBonuses || [];
        if (!pendingBonuses.length) continue;
        
        let updated = false;
        
        // Group bonuses by investment
        const investmentGroups = {};
        
        // First pass: organize bonuses by investment
        for (let i = 0; i < pendingBonuses.length; i++) {
          const bonus = pendingBonuses[i];
          
          // Skip invalid or already awarded bonuses
          if (!bonus || !bonus.type || bonus.awarded || bonus.type !== 'investmentReturn' || !bonus.investor) {
            continue;
          }
          
          // Create a unique key for each investment
          const investorId = bonus.investor.toString();
          let investmentKey;
          
          if (bonus.investmentId) {
            investmentKey = bonus.investmentId.toString();
          } else if (bonus.createdAt) {
            // Legacy support for bonuses without investmentId
            const createdAt = new Date(bonus.createdAt).toISOString().split('T')[0];
            investmentKey = `${investorId}-${createdAt}`;
          } else {
            continue; // Skip if we can't determine the investment key
          }
          
          // Initialize group if needed
          if (!investmentGroups[investmentKey]) {
            investmentGroups[investmentKey] = [];
          }
          
          // Add to group
          investmentGroups[investmentKey].push({ index: i, bonus });
        }
        
        // Second pass: process bonuses for each investment group
        for (const investmentKey in investmentGroups) {
          const bonusesForInvestment = investmentGroups[investmentKey];
          if (!bonusesForInvestment.length) continue;
          
          // Sort bonuses by month (ascending)
          bonusesForInvestment.sort((a, b) => {
            if (a.bonus.month !== b.bonus.month) {
              return a.bonus.month - b.bonus.month;
            }
            return a.index - b.index; // Stable sort
          });
          
          // Get the investment start date from the first bonus
          const firstBonus = bonusesForInvestment[0].bonus;
          if (!firstBonus.createdAt) continue;
          
          // Calculate months elapsed since investment start
          const investmentStartDate = new Date(firstBonus.createdAt);
          const monthsElapsed = (currentYear - investmentStartDate.getFullYear()) * 12 + 
                             (currentMonth - investmentStartDate.getMonth());
          
          // Find the next bonus to process
          let nextBonus = null;
          
          // First try exact month match
          nextBonus = bonusesForInvestment.find(item => 
            !item.bonus.awarded && 
            item.bonus.month <= INVESTMENT_BONUS_MONTHS && 
            item.bonus.month === monthsElapsed + 1);
          
          // If in development mode and no exact match, find the earliest non-awarded bonus
          if (processAllDueBonuses && !nextBonus) {
            nextBonus = bonusesForInvestment.find(item => 
              !item.bonus.awarded && item.bonus.month <= INVESTMENT_BONUS_MONTHS);
          }
          
          // Process the bonus if found
          if (nextBonus) {
            const { index, bonus } = nextBonus;
            
            // Double-check the 6-month limit
            if (bonus.month <= INVESTMENT_BONUS_MONTHS) {
              
              // Award the monthly investment return bonus
              user.income = user.income || {};
              user.income.investmentReferralReturnIncome = (user.income.investmentReferralReturnIncome || 0) + bonus.amount;
              user.income.walletBalance = (user.income.walletBalance || 0) + bonus.amount;
              bonus.awarded = true;
              bonus.awardedDate = new Date();
              updated = true;
              processedCount++;
              await createUserHistory({
  userId: user._id,
  type: 'investmentReferralReturn',
  amount: bonus.amount,
  status: 'completed',
  remarks: `Monthly investment bonus (Month ${bonus.month}) from investor ${bonus.investor}`
}, session);
            }
          }
        }
        
        // Save user if any bonuses were awarded
        if (updated) {
          await user.save({ session });
          // Efficiently remove all awarded bonuses from the array
          await User.updateOne(
            { _id: user._id },
            { $pull: { 'investment.pendingInvestmentBonuses': { awarded: true } } },
            { session }
          );
        }
      }
      
      // Commit transaction and return results
      await session.commitTransaction();
      
      return {
        success: true,
        message: 'Monthly investment returns processed successfully',
        processedCount
      };
    } catch (error) {
      logger.error('Error in processMonthlyInvestmentReturns:', error);
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
        amount: REGISTRATION_AMOUNT 
      };
      
      // Exclude current payment slip if provided
      if (currentSlipId) {
        query._id = { $ne: currentSlipId };
      }
      
      const prevApproved = await PaymentSlip.findOne(query);
      
      if (!prevApproved) {
        // Use combined function
        const result = await this.processRegistrationIncome(userId);
        return result;
      } else {
        return { success: false, message: 'Registration already processed' };
      }
    } catch (error) {
      logger.error('Error in processRegistrationReferralIncome:', error);
      return { success: false, message: error.message || 'Failed to process registration referral income' };
    }
  },

  // Process investment referral income
  async processInvestmentReferralIncome(userId, investmentAmount) {
    try {
      const result = await this.processInvestmentBonuses(userId, investmentAmount);
      return result;
    } catch (error) {
      logger.error('Error in processInvestmentReferralIncome:', error);
      return { success: false, message: error.message || 'Failed to process investment referral income' };
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
      logger.error('Error in getUserReferralSummary:', error);
      throw new Error(`Failed to get referral summary: ${error.message}`);
    }
  },
  


  // Calculate and update user's team statistics
  async updateUserTeamStats(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return { directReferrals: 0, teamSize: 0, leftCount: 0, rightCount: 0 };
      }
      // Get the user to check left and right children
      const user = await User.findById(userId).select('referral');
      if (!user) {
        return { directReferrals: 0, teamSize: 0, leftCount: 0, rightCount: 0 };
      }
      // Calculate left and right counts
      const leftCount = Array.isArray(user.referral?.leftChildren) ? user.referral.leftChildren.length : 0;
      const rightCount = Array.isArray(user.referral?.rightChildren) ? user.referral.rightChildren.length : 0;
      const directCount = leftCount + rightCount;
      // Calculate indirect referrals (returns number or array)
      const indirectResult = await this.getIndirectReferrals(userId, 10);
      let indirectCount = 0;
      if (Array.isArray(indirectResult)) {
        indirectCount = indirectResult.length;
      } else if (typeof indirectResult === 'number') {
        indirectCount = indirectResult;
      }
      const totalTeamSize = directCount + indirectCount;
      // Update user with calculated stats
      await User.findByIdAndUpdate(userId, {
        $set: {
          'referral.directReferrals': directCount,
          'referral.teamSize': totalTeamSize
        }
      });
      return {
        directReferrals: directCount,
        teamSize: totalTeamSize,
        leftCount,
        rightCount
      };
    } catch (error) {
      logger.error('Error in updateUserTeamStats:', error);
      return { directReferrals: 0, teamSize: 0, leftCount: 0, rightCount: 0 };
    }
  },
};

export default referralService; 