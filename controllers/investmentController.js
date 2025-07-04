import investmentService from '../services/investmentService.js';
import { addInvestmentBonuses } from '../utils/referral.js';
import PaymentSlip from '../models/PaymentSlip.js';
import User from '../models/User.js';
import Investment from '../models/Investment.js';

export const getUserInvestments = async (req, res) => {
  try {
    const result = await investmentService.getUserInvestmentsWithTotalIncome(req.user._id);
    res.json({ success: true, data: result, message: 'Investments fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch investments.', error: err.message });
  }
};

export const createInvestment = async (req, res) => {
  try {
    const { amount } = req.body;
    const investment = await investmentService.createInvestment(req.user._id, amount);
    res.json({ success: true, data: { investment }, message: 'Investment created successfully.', error: null });
  } catch (err) {
    res.status(400).json({ success: false, data: null, message: 'Failed to create investment.', error: err.message });
  }
};

export const processMonthlyPayouts = async (req, res) => {
  try {
    const processed = await investmentService.processMonthlyPayouts();
    res.json({ success: true, data: { processed }, message: `Monthly payouts processed for ${processed} investments.`, error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to process monthly payouts.', error: err.message });
  }
};

export const approveInvestment = async (req, res) => {
  try {
    const { slipId } = req.body;
    const slip = await investmentService.approveInvestment(slipId);
    res.json({ success: true, message: 'Investment approved and bonuses triggered.', slip });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve investment.', error: err.message });
  }
}; 