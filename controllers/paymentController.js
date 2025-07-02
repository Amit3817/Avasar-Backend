import PaymentSlip from '../models/PaymentSlip.js';
import User from '../models/User.js';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadSlip = async (req, res) => {
  const userId = req.user._id;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'avasar/slips', resource_type: 'auto' },
        (error, result) => {
          if (error) {
            console.error('Cloudinary error:', error);
            return reject(error);
          }
          resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Save to DB
    const slip = await PaymentSlip.create({
      user: userId,
      file: result.secure_url,
      transactionId: req.body.transactionId,
      amount: req.body.amount,
      method: req.body.method,
    });
    await User.findByIdAndUpdate(userId, { paymentStatus: 'uploaded', paymentSlip: result.secure_url });

    res.json({ message: 'Payment slip uploaded successfully. Awaiting admin approval.', slip });
  } catch (err) {
    console.error('UploadSlip error:', err);
    res.status(500).json({ error: 'Cloudinary upload failed', details: err.message || err });
  }
};

export const getSlip = async (req, res) => {
  const userId = req.user._id;
  const slips = await PaymentSlip.find({ user: userId });
  if (!slips || slips.length === 0) return res.status(404).json({ error: 'No payment slips found.' });
  res.json({ message: 'Payment slips fetched successfully.', slips });
};

export const verifySlip = async (req, res) => {
  const { slipId } = req.params;
  const slip = await PaymentSlip.findById(slipId);
  if (!slip) return res.status(404).json({ error: 'Payment slip not found.' });
  slip.status = 'verified';
  await slip.save();
  await User.findByIdAndUpdate(slip.user, { paymentStatus: 'verified' });
  res.json({ message: 'Payment slip verified, user balance updated.' });
};

export const submitWithdrawal = async (req, res) => {
  const { userId, amount, remarks } = req.body;
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const withdrawal = await Withdrawal.create({ user: userId, amount, remarks });
  res.json({ message: 'Withdrawal request submitted successfully. Awaiting admin approval.' });
};

export const getWithdrawals = async (req, res) => {
  const { userId } = req.params;
  const withdrawals = await Withdrawal.find({ user: userId });
  if (!withdrawals) return res.status(404).json({ error: 'No withdrawal requests found.' });
  res.json({ message: 'Withdrawal requests fetched successfully.', withdrawals });
};

export const approveWithdrawal = async (req, res) => {
  const { withdrawalId } = req.params;
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) return res.status(404).json({ error: 'Withdrawal request not found.' });
  withdrawal.status = 'approved';
  withdrawal.verifiedBy = req.user.id;
  withdrawal.verifiedAt = new Date();
  await withdrawal.save();
  res.json({ message: 'Withdrawal request approved successfully.' });
};

export const rejectWithdrawal = async (req, res) => {
  const { withdrawalId, remarks } = req.body;
  const withdrawal = await Withdrawal.findById(withdrawalId);
  if (!withdrawal) return res.status(404).json({ error: 'Withdrawal request not found.' });
  withdrawal.status = 'rejected';
  withdrawal.rejectedAt = new Date();
  withdrawal.remarks = remarks;
  await withdrawal.save();
  res.json({ message: 'Withdrawal request rejected successfully.' });
}; 