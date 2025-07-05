import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import Withdrawal from '../models/Withdrawal.js';
import referralService from './referralService.js';
import investmentService from './investmentService.js';

const adminService = {
  async getAllUsers(pagination = {}) {
    const { page = 1, limit = 10, skip = 0, sort = { createdAt: -1 }, search = '', status = '', startDate = '', endDate = '' } = pagination;
    
    // Build query
    let query = {};
    
    // Search by name or email
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get total count
    const total = await User.countDocuments(query);
    
    // Get paginated results with all income fields
    const users = await User.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-password -otp -otpExpires')
      .lean();
    
    return { users, total, page, limit };
  },

  async updateUserIncome(id, { referralIncome, matchingIncome, generationIncome, tradingIncome, rewardIncome }) {
    const update = {};
    if (referralIncome !== undefined) update.referralIncome = referralIncome;
    if (matchingIncome !== undefined) update.matchingIncome = matchingIncome;
    if (generationIncome !== undefined) update.generationIncome = generationIncome;
    if (tradingIncome !== undefined) update.tradingIncome = tradingIncome;
    if (rewardIncome !== undefined) update.rewardIncome = rewardIncome;
    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) throw new Error('User not found.');
    return user;
  },

  async getAllPaymentSlips(pagination = {}) {
    const { page = 1, limit = 10, skip = 0, sort, search = '', status = '', startDate = '', endDate = '' } = pagination;
    
    // Always sort by uploadedAt (newest first) for payment slips
    const sortBy = { uploadedAt: -1 };
    
    // Build query
    let query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.uploadedAt = {};
      if (startDate) query.uploadedAt.$gte = new Date(startDate);
      if (endDate) query.uploadedAt.$lte = new Date(endDate);
    }
    
    // Get total count
    const total = await PaymentSlip.countDocuments(query);
    
    // Get paginated results
    const slips = await PaymentSlip.find(query)
      .populate('user', 'fullName email phone')
      .populate('verifiedBy', 'fullName email')
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .lean();
    
    return { slips, total, page, limit };
  },

  async updatePaymentSlipStatus(id, { status, reason, remarks }, adminId) {
    let update = { status };
    if (status === 'approved') {
      update = {
        ...update,
        reason,
        verifiedBy: adminId,
        verifiedAt: new Date(),
        remarks: remarks || undefined,
        rejectedAt: undefined
      };
    } else if (status === 'rejected') {
      update = {
        ...update,
        remarks,
        rejectedAt: new Date(),
        verifiedBy: undefined,
        verifiedAt: undefined
      };
    } else {
      update = { ...update, reason, remarks };
    }
    
    const slip = await PaymentSlip.findByIdAndUpdate(id, update, { new: true });
    if (!slip) throw new Error('Payment slip not found.');
    await slip.save();
    
    // Trigger income updates when payment slip is approved
    if (status === 'approved') {
      try {
        // If this is a registration payment (₹3600), trigger referral logic
        if (Number(slip.amount) === 3600) {
          const result = await referralService.processRegistrationReferralIncome(slip.user, slip._id);
          if (result.success) {
          } else {
          }
        }
        
        // If this is an investment payment (₹10,000 or more), trigger investment logic
        if (Number(slip.amount) >= 10000) {
          await investmentService.approveInvestment(slip._id);
        }
      } catch (error) {
        // Don't throw error to avoid failing the approval
      }
    }
    
    return slip;
  },

  async getUserRewards(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');
    return {
      totalPairs: user.system?.totalPairs || 0,
      awardedRewards: user.system?.awardedRewards || [],
      rewardIncome: user.income?.rewardIncome || 0
    };
  },

  async getDashboardStats() {
    // Get total users (excluding admins)
    const totalUsers = await User.countDocuments({ isAdmin: { $ne: true } });
    
    // Get total investment from approved payment slips (₹10,000+)
    const totalInvestment = await PaymentSlip.aggregate([
      { $match: { status: 'approved', amount: { $gte: 10000 } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Get total withdrawals
    const totalWithdrawals = await Withdrawal.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Get payment slip counts
    const totalPaymentSlips = await PaymentSlip.countDocuments({});
    const pendingPaymentSlips = await PaymentSlip.countDocuments({ status: 'pending' });
    
    return {
      totalUsers: totalUsers,
      totalInvestment: totalInvestment.length > 0 ? totalInvestment[0].total : 0,
      totalWithdrawals: totalWithdrawals.length > 0 ? totalWithdrawals[0].total : 0,
      totalPaymentSlips: totalPaymentSlips,
      pendingPaymentSlips: pendingPaymentSlips
    };
  },
};

export default adminService; 