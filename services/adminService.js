import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import { addReferralIncome, addMatchingIncome, addRewardIncome } from '../utils/referral.js';

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
    
    // Filter by status
    if (status) {
      query.paymentStatus = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Get total count
    const total = await User.countDocuments(query);
    
    // Get paginated results
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
    const total = await PaymentSlip.countDocuments(query);
    
    // Get paginated results
    const slips = await PaymentSlip.find(query)
      .populate('user', 'fullName email phone')
      .populate('verifiedBy', 'fullName email')
      .sort(sort)
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
    // Trigger referral logic only if this is the user's first approved slip of amount 3600
    if (status === 'approved' && Number(slip.amount) === 3600) {
      const prevApproved = await PaymentSlip.findOne({ user: slip.user, status: 'approved', amount: 3600, _id: { $ne: slip._id } });
      if (!prevApproved) {
        await addReferralIncome(slip.user);
        await addMatchingIncome(slip.user);
        await addRewardIncome(slip.user);
      }
    }
    return slip;
  },

  async getUserRewards(userId) {
    const user = await User.findById(userId).lean();
    if (!user) throw new Error('User not found');
    return {
      totalPairs: user.totalPairs || 0,
      awardedRewards: user.awardedRewards || [],
      rewardIncome: user.rewardIncome || 0
    };
  },
};

export default adminService; 