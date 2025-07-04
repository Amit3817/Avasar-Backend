import PaymentSlip from '../models/PaymentSlip.js';
import User from '../models/User.js';
import Withdrawal from '../models/Withdrawal.js';
import { uploadPaymentSlip } from '../services/cloudinaryService.js';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../config/logger.js';
import paymentService from '../services/paymentService.js';
import withdrawalService from '../services/withdrawalService.js';
import { createPaginationResponse } from '../middleware/pagination.js';
dotenv.config();

export const uploadSlip = async (req, res) => {
  let userId = req.user._id;
  if (req.body.userId && req.user.isAdmin) {
    userId = req.body.userId;
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const slip = await paymentService.uploadSlip({
      userId,
      file: req.file,
      amount: req.body.amount,
      method: req.body.method,
      transactionId: req.body.transactionId,
      isAdmin: req.user.isAdmin || false,
    });
    res.json({ message: 'Payment slip uploaded successfully. Awaiting admin approval.', slip });
  } catch (err) {
    logger.error('UploadSlip error:', err);
    res.status(400).json({ error: err.message || 'Payment slip upload failed' });
  }
};

export const getSlip = async (req, res) => {
  try {
    const slips = await paymentService.getSlip(req.user._id);
    res.json({ message: 'Payment slips fetched successfully.', slips });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

export const submitWithdrawal = async (req, res) => {
  try {
    const withdrawal = await withdrawalService.submitWithdrawal(req.body);
    res.json({ message: 'Withdrawal request submitted successfully. Awaiting admin approval.', withdrawal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getWithdrawals = async (req, res) => {
  try {
    const withdrawals = await withdrawalService.getWithdrawalsByUser(req.params.userId);
    res.json({ message: 'Withdrawal requests fetched successfully.', withdrawals });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

export const approveWithdrawal = async (req, res) => {
  try {
    const withdrawal = await withdrawalService.approveWithdrawal(req.params.withdrawalId, req.user.id);
    res.json({ message: 'Withdrawal request approved successfully.', withdrawal });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

export const rejectWithdrawal = async (req, res) => {
  try {
    const withdrawal = await withdrawalService.rejectWithdrawal(req.params.withdrawalId, req.body.remarks);
    res.json({ message: 'Withdrawal request rejected successfully.', withdrawal });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

export const getAllWithdrawals = async (req, res) => {
  try {
    const { withdrawals, total, page, limit } = await withdrawalService.getAllWithdrawals(req.pagination);
    const response = createPaginationResponse(withdrawals, total, page, limit);
    res.json({ 
      success: true, 
      message: 'All withdrawal requests fetched successfully!', 
      ...response 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch withdrawal requests.', 
      error: err.message 
    });
  }
};

export const adminUploadSlip = async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required.' });
  const userId = req.body.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const slip = await paymentService.adminUploadSlip({
      userId,
      file: req.file,
      amount: req.body.amount,
      method: req.body.method,
      transactionId: req.body.transactionId,
      adminId: req.user._id,
    });
    res.json({ message: 'Payment slip uploaded and approved by admin.', slip });
  } catch (err) {
    logger.error('AdminUploadSlip error:', err);
    res.status(400).json({ error: err.message || 'Payment slip upload failed' });
  }
}; 