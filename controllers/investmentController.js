import investmentService from '../services/investmentService.js';
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

export const getInvestmentDetails = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const investment = await Investment.findOne({ _id: investmentId, user: req.user._id });
    
    if (!investment) {
      return res.status(404).json({ success: false, data: null, message: 'Investment not found.', error: 'Investment not found or does not belong to this user.' });
    }
    
    const now = new Date();
    const endDate = new Date(investment.endDate);
    const isLocked = now < endDate;
    const daysRemaining = isLocked ? 
      Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))) : 0;
    
    const details = {
      ...investment.toObject(),
      isLocked,
      daysRemaining,
      monthlyReturn: Math.floor(investment.amount * 0.04),
      totalReturn: Math.floor(investment.amount * 0.04 * investment.monthsPaid),
      remainingMonths: Math.max(0, 24 - investment.monthsPaid)
    };
    
    res.json({ success: true, data: { investment: details }, message: 'Investment details fetched successfully.', error: null });
  } catch (err) {
    res.status(500).json({ success: false, data: null, message: 'Failed to fetch investment details.', error: err.message });
  }
};

export const createInvestment = async (req, res) => {
  try {
    const { amount, verificationDate } = req.body;
    const investment = await investmentService.createInvestment(req.user._id, amount, verificationDate);
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