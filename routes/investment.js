import express from 'express';
import { getUserInvestments, createInvestment, processMonthlyPayouts, approveInvestment } from '../controllers/investmentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createInvestmentValidator } from '../validators/investmentValidators.js';
import { validationResult } from 'express-validator';
import investmentService from '../services/investmentService.js';

const router = express.Router();

// User: Get their investments
router.get('/user', requireAuth, getUserInvestments);

// User: Get investment summary (alias for /user/investment-summary)
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const summary = await investmentService.getInvestmentSummary(req.user._id);
    res.json({ 
      success: true, 
      data: { summary }, 
      message: 'Investment summary fetched successfully!', 
      error: null 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      data: null, 
      message: 'Failed to fetch investment summary.', 
      error: err.message 
    });
  }
});

// User: Create new investment
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

router.post('/user', requireAuth, createInvestmentValidator, handleValidation, createInvestment);

// Admin: Process monthly payouts
router.post('/payout', requireAuth, processMonthlyPayouts); // Add requireAdmin if you have admin middleware

// Admin: Approve investment slip
router.post('/approve', requireAuth, requireAdmin, approveInvestment);

export default router; 