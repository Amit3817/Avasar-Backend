import Investment from '../models/Investment.js';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import { addInvestmentBonuses } from '../utils/referral.js';

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

      for (const investment of investments) {
        const now = new Date();
        const investmentEndDate = new Date(investment.endDate);
        const isLocked = now < investmentEndDate;

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

      // Update user's investment status
      user.investmentIsLocked = isAnyInvestmentLocked;
      user.lockedInvestmentAmount = totalLockedAmount;
      user.availableForWithdrawal = totalAvailableAmount;

      // Calculate available wallet balance for withdrawal
      const totalWalletBalance = user.walletBalance || 0;
      const availableForWithdrawal = Math.max(0, totalWalletBalance - totalLockedAmount);
      user.availableForWithdrawal = availableForWithdrawal;

      await user.save();

      return {
        isLocked: isAnyInvestmentLocked,
        lockedAmount: totalLockedAmount,
        availableAmount: totalAvailableAmount,
        totalWalletBalance,
        availableForWithdrawal,
        investments: investments.map(inv => ({
          id: inv._id,
          amount: inv.amount,
          startDate: inv.startDate,
          endDate: inv.endDate,
          isLocked: inv.isLocked,
          withdrawalRestriction: inv.withdrawalRestriction,
          monthsRemaining: inv.isLocked ? this.calculateMonthsRemaining(inv.endDate) : 0
        }))
      };
    } catch (error) {
      throw new Error(`Failed to calculate investment status: ${error.message}`);
    }
  }

  // Calculate months remaining until investment is unlocked
  calculateMonthsRemaining(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end - now;
    const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average days per month
    return Math.max(0, diffMonths);
  }

  // Check if user can withdraw a specific amount
  async canWithdrawAmount(userId, amount) {
    try {
      const status = await this.calculateInvestmentStatus(userId);
      
      if (amount > status.availableForWithdrawal) {
        return {
          canWithdraw: false,
          reason: `Insufficient available balance. You can only withdraw ₹${status.availableForWithdrawal.toFixed(2)}`,
          availableAmount: status.availableForWithdrawal
        };
      }

      if (amount < 100) {
        return {
          canWithdraw: false,
          reason: 'Minimum withdrawal amount is ₹100',
          availableAmount: status.availableForWithdrawal
        };
      }

      return {
        canWithdraw: true,
        availableAmount: status.availableForWithdrawal,
        reason: null
      };
    } catch (error) {
      throw new Error(`Failed to check withdrawal eligibility: ${error.message}`);
    }
  }

  // Get investment summary for user
  async getInvestmentSummary(userId) {
    try {
      const status = await this.calculateInvestmentStatus(userId);
      const user = await User.findById(userId);

      return {
        totalInvestment: user.totalInvestment || 0,
        lockedAmount: status.lockedAmount,
        availableAmount: status.availableAmount,
        totalWalletBalance: status.totalWalletBalance,
        availableForWithdrawal: status.availableForWithdrawal,
        isLocked: status.isLocked,
        investments: status.investments,
        investmentIncome: user.investmentIncome || 0,
        referralIncome: (user.referralIncome || 0) + (user.matchingIncome || 0) + (user.rewardIncome || 0)
      };
    } catch (error) {
      throw new Error(`Failed to get investment summary: ${error.message}`);
    }
  }

  // Create new investment with lock-in period
  async createInvestment(userId, amount) {
    try {
      const startDate = new Date();
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

      // Update user's total investment
      await User.findByIdAndUpdate(userId, {
        $inc: { totalInvestment: amount },
        investmentStartDate: startDate,
        investmentEndDate: endDate,
        investmentIsLocked: true,
        $inc: { lockedInvestmentAmount: amount }
      });

      return investment;
    } catch (error) {
      throw new Error(`Failed to create investment: ${error.message}`);
    }
  }

  async getUserInvestments(userId) {
    const investments = await Investment.find({ user: userId }).lean();
    return investments;
  }

  async processMonthlyPayouts() {
    // Process monthly ROI for all active investments
    const investments = await Investment.find({ active: true });
    let processed = 0;
    for (const inv of investments) {
      inv.monthsPaid += 1;
      
      // Calculate and credit monthly ROI (4% of investment amount)
      const monthlyROI = Math.floor(inv.amount * 0.04);
      
      // Update user's investment income and wallet balance
      await User.findByIdAndUpdate(inv.user, {
        $inc: {
          investmentIncome: monthlyROI,
          walletBalance: monthlyROI
        }
      });
      
      // Deactivate investment after 24 months
      if (inv.monthsPaid >= 24) {
        inv.active = false;
      }
      
      await inv.save();
      processed++;
    }
    return processed;
  }

  async getUserInvestmentsWithTotalIncome(userId) {
    const investments = await Investment.find({ user: userId }).lean();
    const totalIncome = investments.reduce((sum, inv) => sum + Math.floor(inv.amount * 0.04 * inv.monthsPaid), 0);
    return { investments, totalIncome };
  }

  async approveInvestment(slipId) {
    const slip = await PaymentSlip.findById(slipId);
    if (!slip) throw new Error('Payment slip not found.');
    if (slip.status === 'approved') throw new Error('Slip already approved.');
    if (Number(slip.amount) < 10000) throw new Error('Minimum investment is ₹10,000.');
    slip.status = 'approved';
    await slip.save();
    const user = await User.findById(slip.user);
    const now = new Date();
    if (!user.totalInvestment || user.totalInvestment < Number(slip.amount)) {
      user.totalInvestment = Number(slip.amount);
      user.investmentStartDate = now;
      user.investmentEndDate = new Date(now.getFullYear(), now.getMonth() + 24, now.getDate());
      user.investmentIncome = 0;
      await user.save();
      await Investment.create({ user: user._id, amount: Number(slip.amount), startDate: now, monthsPaid: 0, active: true });
      await addInvestmentBonuses(user._id, Number(slip.amount));
    }
    return slip;
  }
}

const investmentService = new InvestmentService();
investmentService.getUserInvestmentsWithTotalIncome = investmentService.getUserInvestmentsWithTotalIncome;
investmentService.approveInvestment = investmentService.approveInvestment;

export default investmentService; 