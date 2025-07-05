import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import investmentService from '../services/investmentService.js';

// USER: Request withdrawal
export const requestWithdrawal = async (req, res) => {
  try {
    const { amount, remarks, bankAccount, upiId } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // Require bank or UPI details
    const hasBank = bankAccount && bankAccount.accountNumber && bankAccount.ifsc;
    const hasUpi = upiId && upiId.trim() !== '';
    if (!hasBank && !hasUpi) {
      return res.status(400).json({ success: false, message: 'Please provide your bank account or UPI ID for withdrawal.' });
    }
    
    // Check withdrawal eligibility with investment lock-in restrictions
    const withdrawalCheck = await investmentService.canWithdrawAmount(userId, amount);
    if (!withdrawalCheck.canWithdraw) {
      return res.status(400).json({ success: false, message: withdrawalCheck.reason });
    }
    
    user.walletBalance -= amount;
    await user.save();
    
    const withdrawal = await Withdrawal.create({ 
      user: userId, 
      amount, 
      remarks,
      bankAccount: hasBank ? bankAccount : {},
      upiId: hasUpi ? upiId : ''
    });
    
    res.json({ success: true, data: { withdrawal }, message: 'Withdrawal request submitted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// USER: Get withdrawal history
export const getUserWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { withdrawals }, message: 'Withdrawal history fetched successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN: Get all withdrawal requests
export const getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({})
      .populate('user', 'fullName email phone')
      .populate('verifiedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
    
    // Add payment method info to each withdrawal
    const withdrawalsWithPaymentInfo = withdrawals.map(withdrawal => ({
      ...withdrawal,
      paymentMethod: withdrawal.bankAccount?.accountNumber ? 'Bank Transfer' : 
                    withdrawal.upiId ? 'UPI' : 'Not specified'
    }));
    
    // Use standardized response structure like other admin endpoints
    res.json({ 
      success: true, 
      message: 'All withdrawal requests fetched successfully!',
      data: withdrawalsWithPaymentInfo
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN: Approve withdrawal request
export const approveWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    withdrawal.status = 'approved';
    withdrawal.verifiedBy = req.user._id;
    withdrawal.verifiedAt = new Date();
    await withdrawal.save();
    res.json({ success: true, message: 'Withdrawal request approved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ADMIN: Reject withdrawal request
export const rejectWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { remarks } = req.body;
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal request not found.' });
    withdrawal.status = 'rejected';
    withdrawal.rejectedAt = new Date();
    withdrawal.remarks = remarks;
    await withdrawal.save();
    res.json({ success: true, message: 'Withdrawal request rejected successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}; 