import PaymentSlip from '../models/PaymentSlip.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import { uploadPaymentSlip } from './cloudinaryService.js';
import logger from '../config/logger.js';

const paymentService = {
  async uploadSlip({ userId, file, amount, method, transactionId, isAdmin }) {
    // ENFORCE: If user does not have an approved slip of amount 3600, only allow uploading a slip with amount 3600
    const prevApproved = await PaymentSlip.findOne({ user: userId, status: 'approved', amount: 3600 });
    if (!prevApproved && Number(amount) !== 3600) {
      throw new Error('Your first payment slip must be for ₹3600.');
    }
    // Upload to Cloudinary
    const result = await uploadPaymentSlip(file.buffer, file.originalname);
    // Save to DB
    const slip = await PaymentSlip.create({
      user: userId,
      file: result.secure_url,
      transactionId,
      amount,
      method,
      status: isAdmin ? 'approved' : 'pending',
    });
    
    return slip;
  },

  async getSlip(userId) {
    const slips = await PaymentSlip.find({ user: userId });
    if (!slips || slips.length === 0) throw new Error('No payment slips found.');
    return slips;
  },

  async adminUploadSlip({ userId, file, amount, method, transactionId, adminId }) {
    const prevApproved = await PaymentSlip.findOne({ user: userId, status: 'approved', amount: 3600 });
    if (!prevApproved && Number(amount) !== 3600) {
      throw new Error('The first payment slip for this user must be for ₹3600.');
    }
    if (prevApproved && Number(amount) < 10000) {
      throw new Error('Minimum investment amount is ₹10,000.');
    }
    const result = await uploadPaymentSlip(file.buffer, file.originalname);
    const slip = await PaymentSlip.create({
      user: userId,
      file: result.secure_url,
      transactionId,
      amount,
      method,
      status: 'approved',
      verifiedBy: adminId,
      verifiedAt: new Date()
    });
    
    return slip;
  },

  async approveWithdrawal(withdrawalId, adminId) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found.');
    withdrawal.status = 'approved';
    withdrawal.verifiedBy = adminId;
    withdrawal.verifiedAt = new Date();
    await withdrawal.save();
    return withdrawal;
  },

  async rejectWithdrawal(withdrawalId, remarks) {
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) throw new Error('Withdrawal request not found.');
    withdrawal.status = 'rejected';
    withdrawal.rejectedAt = new Date();
    withdrawal.remarks = remarks;
    await withdrawal.save();
    return withdrawal;
  },

  async getAllWithdrawals() {
    const withdrawals = await Withdrawal.find({})
      .populate('user', 'fullName email phone')
      .populate('verifiedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
    return withdrawals;
  },
};

export default paymentService; 