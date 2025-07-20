import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import investmentService from './investmentService.js';

const withdrawalService = {
  async submitWithdrawal({ userId, amount, remarks, bankAccount, upiId }) {
    
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found.');
    
    // Check if the user can withdraw the requested amount
    const withdrawalCheck = await investmentService.canWithdrawAmount(userId, amount);
    
    if (!withdrawalCheck.canWithdraw) {
      throw new Error(withdrawalCheck.reason);
    }
    
    // Create the withdrawal request with explicit status
    const withdrawal = await Withdrawal.create({ 
      user: userId, 
      amount, 
      remarks, 
      bankAccount, 
      upiId,
      status: 'pending',
      createdAt: new Date()
    });
    
    return withdrawal;
  },

  async getWithdrawalsByUser(userId) {
    const withdrawals = await Withdrawal.find({ user: userId });
    if (!withdrawals || withdrawals.length === 0) throw new Error('No withdrawal requests found.');
    return withdrawals;
  },

  async getAllWithdrawals(pagination = {}) {
    const { page = 1, limit = 10, skip = 0, sort = { createdAt: -1 }, search = '', status = '', startDate = '', endDate = '' } = pagination;
    
    // Build query
    let query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get total count
    const total = await Withdrawal.countDocuments(query);
    
    // Get paginated results with proper user population
    const withdrawals = await Withdrawal.find(query)
      .populate({
        path: 'user',
        model: 'User',
        select: 'profile.fullName auth.email profile.phone'
      })
      .populate({
        path: 'verifiedBy',
        model: 'User',
        select: 'profile.fullName auth.email'
      })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
      
    return { withdrawals, total, page, limit };
  },

  async approveWithdrawal(withdrawalId, adminId) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found.');
    if (withdrawal.status === 'approved') return withdrawal; // Prevent double approval
    withdrawal.status = 'approved';
    withdrawal.verifiedBy = adminId;
    withdrawal.verifiedAt = new Date();
    await withdrawal.save();

    // Subtract amount from user's walletBalance
    const user = await User.findById(withdrawal.user);
    if (user) {
      user.income = user.income || {};
      user.income.walletBalance = Math.max(0, (user.income.walletBalance || 0) - (withdrawal.amount || 0));
      await user.save();
    }

    return withdrawal;
  },

  async rejectWithdrawal(withdrawalId, remarks) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found.');
    withdrawal.status = 'rejected';
    withdrawal.rejectedAt = new Date();
    withdrawal.remarks = remarks;
    await withdrawal.save();

    // Refund the amount to the user's wallet balance
    const user = await User.findById(withdrawal.user);
    if (user) {
      user.income = user.income || {};
      user.income.walletBalance = (user.income.walletBalance || 0) + (withdrawal.amount || 0);
      await user.save();
    }

    return withdrawal;
  },
};

export default withdrawalService; 