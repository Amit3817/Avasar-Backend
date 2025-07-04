import express from 'express';
import { getUserInvestments, createInvestment, processMonthlyPayouts, approveInvestment } from '../controllers/investmentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createInvestmentValidator } from '../validators/investmentValidators.js';
import { validationResult } from 'express-validator';

const router = express.Router();

// User: Get their investments
router.get('/user', requireAuth, getUserInvestments);

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