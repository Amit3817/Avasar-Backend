import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';

export async function getAllUsers(req, res) {
  try {
    const users = await User.find();
    if (!users) return res.status(404).json({ error: 'No users found.' });
    res.json({ message: 'All users fetched successfully.', users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserIncome(req, res) {
  try {
    const { id } = req.params;
    const { referralIncome, matchingIncome, generationIncome, tradingIncome, rewardIncome } = req.body;
    const update = {};
    if (referralIncome !== undefined) update.referralIncome = referralIncome;
    if (matchingIncome !== undefined) update.matchingIncome = matchingIncome;
    if (generationIncome !== undefined) update.generationIncome = generationIncome;
    if (tradingIncome !== undefined) update.tradingIncome = tradingIncome;
    if (rewardIncome !== undefined) update.rewardIncome = rewardIncome;
    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'User details fetched successfully.', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAllPaymentSlips(req, res) {
  try {
    const slips = await PaymentSlip.find().populate('user');
    if (!slips) return res.status(404).json({ error: 'No payment slips found.' });
    res.json({ message: 'Payment slips fetched successfully.', slips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updatePaymentSlipStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const slip = await PaymentSlip.findByIdAndUpdate(id, { status, reason }, { new: true });
    if (!slip) return res.status(404).json({ error: 'Payment slip not found.' });
    slip.verifiedBy = req.user.id;
    slip.verifiedAt = new Date();
    slip.status = 'approved';
    await slip.save();
    res.json({ message: 'Payment slip approved successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function rejectPaymentSlip(req, res) {
  try {
    const { id } = req.params;
    const { remarks } = req.body;
    const slip = await PaymentSlip.findByIdAndUpdate(id, { rejectedAt: new Date(), status: 'rejected', remarks }, { new: true });
    if (!slip) return res.status(404).json({ error: 'Payment slip not found.' });
    await slip.save();
    res.json({ message: 'Payment slip rejected successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
} 