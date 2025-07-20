import mongoose from 'mongoose';
import Investment from '../models/Investment.js';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import referralService from './referralService.js';
import logger from '../config/logger.js';

class InvestmentService {
  // Calculate investment lock-in status and withdrawal restrictions
  async calculateInvestmentStatus(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const investments = await Investment.find({ user: userId, active: true });
      
      let totalLockedAmount = 0;
      let totalAvailableAmount = 0;
      let isAnyInvestmentLocked = false;
      let totalInvestment = 0;

      for (const investment of investments) {
        const now = new Date();
        const investmentEndDate = new Date(investment.endDate);
        const isLocked = now < investmentEndDate;
        totalInvestment += investment.amount;

        if (isLocked) {
          totalLockedAmount += investment.amount;
          isAnyInvestmentLocked = true;
          investment.isLocked = true;
          investment.withdrawalRestriction = investment.amount;
        } else {
          totalAvailableAmount += investment.amount;
          investment.isLocked = false;
          investment.withdrawalRestriction = 0;
        }
        
        await investment.save();
      }

      // Ensure income and walletBalance exist
      if (!user.income) user.income = {};
      if (user.income.walletBalance === undefined) user.income.walletBalance = 0;
      
      // Save the user to ensure the income fields exist
      try {
        await user.save();
      } catch (saveError) {
        logger.error('Error saving user:', saveError);
      }
      
      // Calculate available wallet balance for withdrawal
      const totalWalletBalance = user.income.walletBalance;
      // Available for withdrawal is wallet balance PLUS available investment amount
      const availableForWithdrawal = totalWalletBalance + totalAvailableAmount;
      
      // Update only the necessary fields in the user model
      await User.findByIdAndUpdate(userId, {
        $set: {
          'investment.availableForWithdrawal': availableForWithdrawal,
          'investment.totalInvestment': totalInvestment,
          'investment.lockedInvestmentAmount': totalLockedAmount,
          'investment.availableAmount': totalAvailableAmount,
          'income.walletBalance': totalWalletBalance || 0
        }
      });

      return {
        isLocked: isAnyInvestmentLocked,
        lockedAmount: totalLockedAmount,
        availableAmount: totalAvailableAmount,
        totalWalletBalance,
        availableForWithdrawal,
        totalInvestment,
        investments: investments.map(inv => ({
          id: inv._id,
          amount: inv.amount,
          startDate: inv.startDate,
          endDate: inv.endDate,
          isLocked: inv.isLocked,
          withdrawalRestriction: inv.withdrawalRestriction,
          daysRemaining: inv.isLocked ? this.calculateMonthsRemaining(inv.endDate) : 0
        }))
      };
    } catch (error) {
      logger.error('Failed to calculate investment status:', error);
      throw new Error(`Failed to calculate investment status: ${error.message}`);
    }
  }

  // Calculate days remaining until investment is unlocked
  calculateMonthsRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Days remaining
    return Math.max(0, diffDays);
  }

  // Check if user can withdraw a specific amount
  async canWithdrawAmount(userId, amount) {
    try {
      const status = await this.calculateInvestmentStatus(userId);
      
      // Get total pending withdrawals
      const pendingWithdrawals = await mongoose.model('Withdrawal').find({ 
        user: userId, 
        status: 'pending' 
      });
      
      // Get approved withdrawals that might not be reflected in wallet balance yet
      const recentApprovedWithdrawals = await mongoose.model('Withdrawal').find({
        user: userId,
        status: 'approved',
        verifiedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });
      
      const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const recentApprovedAmount = recentApprovedWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      const actuallyAvailable = status.availableForWithdrawal - pendingAmount - recentApprovedAmount;
      
      if (amount > actuallyAvailable) {
        return {
          canWithdraw: false,
          reason: `Insufficient available balance. You can only withdraw ₹${actuallyAvailable.toFixed(2)} (including pending withdrawals)`,
          availableAmount: actuallyAvailable
        };
      }

      if (amount < 100) {
        return {
          canWithdraw: false,
          reason: 'Minimum withdrawal amount is ₹100',
          availableAmount: actuallyAvailable
        };
      }

      return {
        canWithdraw: true,
        availableAmount: actuallyAvailable,
        reason: null
      };
    } catch (error) {
      logger.error('Failed to check withdrawal eligibility:', error);
      throw new Error(`Failed to check withdrawal eligibility: ${error.message}`);
    }
  }

  // Get investment summary for user
  async getInvestmentSummary(userId) {
    try {
      const status = await this.calculateInvestmentStatus(userId);
      const user = await User.findById(userId);
      
      return {
        totalInvestment: status.totalInvestment,
        lockedAmount: status.lockedAmount,
        availableAmount: status.availableAmount,
        totalWalletBalance: status.totalWalletBalance,
        availableForWithdrawal: status.availableForWithdrawal,
        isLocked: status.isLocked,
        investments: status.investments,
        investmentIncome: user.income?.investmentIncome || 0,
        referralIncome: (user.income?.referralIncome || 0) + (user.income?.matchingIncome || 0) + (user.income?.rewardIncome || 0)
      };
    } catch (error) {
      logger.error('Failed to get investment summary:', error);
      throw new Error(`Failed to get investment summary: ${error.message}`);
    }
  }

  // Create new investment with lock-in period
  async createInvestment(userId, amount, verificationDate = null) {
    try {
      const startDate = verificationDate || new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 24); // 24 months lock-in

      const investment = await Investment.create({
        user: userId,
        amount,
        startDate,
        endDate,
        lockInPeriod: 24,
        isLocked: true,
        withdrawalRestriction: amount
      });

      // Recalculate investment status
      await this.calculateInvestmentStatus(userId);

      return investment;
    } catch (error) {
      logger.error('Failed to create investment:', error);
      throw new Error(`Failed to create investment: ${error.message}`);
    }
  }

  async getUserInvestments(userId) {
    const investments = await Investment.find({ user: userId }).lean();
    return investments;
  }

  async processMonthlyPayouts() {
    let session = null;
    if (process.env.NODE_ENV !== 'test') {
      session = await mongoose.startSession();
      session.startTransaction();
    }
    try {
      // Use aggregation to get active investments and calculate ROI in one query
      const pipeline = [
        { $match: { active: true } },
        { $project: {
            user: 1,
            amount: 1,
            monthsPaid: 1,
            active: 1,
            isLocked: 1,
            withdrawalRestriction: 1,
            monthlyROI: { $floor: { $multiply: ['$amount', 0.04] } }
        }},
        { $group: {
            _id: '$user',
            totalMonthlyROI: { $sum: '$monthlyROI' },
            investments: { $push: '$$ROOT' }
        }}
      ];
      
      const userInvestmentsResult = session
        ? await Investment.aggregate(pipeline).session(session)
        : await Investment.aggregate(pipeline);
      
      let processed = 0;
      const bulkUserOps = [];
      const investmentUpdates = [];
      const userIds = [];
      
      // Process each user's investments
      for (const userInv of userInvestmentsResult) {
        const userId = userInv._id;
        userIds.push(userId);
        
        // Add user update operation
        bulkUserOps.push({
          updateOne: {
            filter: { _id: userId },
            update: {
              $inc: {
                'income.investmentIncome': userInv.totalMonthlyROI,
                'income.walletBalance': userInv.totalMonthlyROI
              }
            }
          }
        });
        
        // Process each investment
        for (const inv of userInv.investments) {
          const newMonthsPaid = inv.monthsPaid + 1;
          const shouldDeactivate = newMonthsPaid >= 24;
          
          investmentUpdates.push({
            updateOne: {
              filter: { _id: inv._id },
              update: {
                $set: {
                  monthsPaid: newMonthsPaid,
                  active: !shouldDeactivate,
                  isLocked: !shouldDeactivate && (inv.isLocked || false),
                  withdrawalRestriction: shouldDeactivate ? 0 : (inv.withdrawalRestriction || 0)
                }
              }
            }
          });
          
          processed++;
        }
      }
      
      // Execute bulk operations in parallel for better performance
      const bulkOperations = [];
      
      if (bulkUserOps.length > 0) {
        bulkOperations.push(User.bulkWrite(bulkUserOps, { session }));
      }
      
      if (investmentUpdates.length > 0) {
        bulkOperations.push(Investment.bulkWrite(investmentUpdates, { session }));
      }
      
      await Promise.all(bulkOperations);
      
      // Update investment status for all affected users in batches
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await Promise.all(batch.map(userId => this.calculateInvestmentStatus(userId)));
      }
      
      if (session) {
        await session.commitTransaction();
        session.endSession();
        logger.info('Monthly investment payouts committed and session ended.');
      }
      
      // We'll process investment return payouts for upline users directly in the cron job
      // This ensures it runs even if there are no investments to process
      logger.info('Investment payouts completed, investment return referrals will be processed separately');
      
      return processed;
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
        logger.error('Monthly payout transaction aborted due to error:', error);
      }
      throw new Error(`Failed to process monthly payouts: ${error.message}`);
    }
  }

  async getUserInvestmentsWithTotalIncome(userId) {
    const investments = await Investment.find({ user: userId }).lean();
    const totalIncome = investments.reduce((sum, inv) => sum + Math.floor(inv.amount * 0.04 * inv.monthsPaid), 0);
    
    // Calculate days remaining for each investment
    const investmentsWithDetails = investments.map(inv => {
      const now = new Date();
      const endDate = new Date(inv.endDate);
      const isLocked = now < endDate;
      
      // Use investment's startDate
      const startDate = inv.startDate;
      
      return {
        ...inv,
        isLocked,
        daysRemaining: isLocked ? this.calculateMonthsRemaining(inv.endDate) : 0,
        monthlyReturn: Math.floor(inv.amount * 0.04),
        totalReturn: Math.floor(inv.amount * 0.04 * inv.monthsPaid),
        startDate: startDate
      };
    });
    
    return { 
      investments: investmentsWithDetails, 
      totalIncome,
      totalInvestments: investments.length,
      activeInvestments: investments.filter(inv => inv.active).length,
      lockedInvestments: investments.filter(inv => new Date() < new Date(inv.endDate)).length
    };
  }

  async approveInvestment(slipId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const slip = await PaymentSlip.findById(slipId).session(session);
      if (!slip) throw new Error('Payment slip not found.');
      if (Number(slip.amount) < 10000) throw new Error('Minimum investment is ₹10,000.');
      
      const user = await User.findById(slip.user).session(session);
      if (!user) throw new Error('User not found');
      
      const investmentAmount = Number(slip.amount);
      // Use current date as the start date for lock-in period
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 24); // 24 months from verification date
      
      // Always create a new investment for each payment slip
      // This allows tracking multiple investments with different lock-in periods
      await Investment.create([{ 
        user: user._id, 
        amount: investmentAmount, 
        startDate: startDate,
        endDate: endDate,
        monthsPaid: 0, 
        active: true,
        isLocked: true,
        withdrawalRestriction: investmentAmount,
        lockInPeriod: 24,
        // No payment slip reference needed
      }], { session });
      
      // Update the user's wallet balance
      await User.findByIdAndUpdate(user._id, {
        $inc: { 'income.walletBalance': 0 } // Just to ensure the field exists
      }, { session });
      
      // We'll recalculate the total investment and locked amount after the transaction
      // This is more accurate than incrementing values in the user model
      
      await session.commitTransaction();
      session.endSession();
      
      // Recalculate investment status after transaction is committed
      await this.calculateInvestmentStatus(slip.user);
      
      // Process investment bonuses after transaction commit
      try {
        const bonusResult = await referralService.processInvestmentBonuses(slip.user, investmentAmount);
        if (bonusResult.success) {
          logger.info(`Investment bonuses processed successfully for user ${slip.user}: ${bonusResult.oneTimeUpdates} one-time bonuses, ${bonusResult.monthlySchedules} monthly schedules`);
        } else {
          logger.error(`Failed to process investment bonuses for user ${slip.user}:`, bonusResult.message);
        }
      } catch (bonusError) {
        logger.error(`Error processing investment bonuses for user ${slip.user}:`, bonusError.message);
      }
      
      return slip;
    } catch (error) {
      logger.error('Failed to approve investment:', error);
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

const investmentService = new InvestmentService();
investmentService.getUserInvestmentsWithTotalIncome = investmentService.getUserInvestmentsWithTotalIncome;
investmentService.approveInvestment = investmentService.approveInvestment;

export default investmentService; 