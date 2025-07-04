import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  requestWithdrawal,
  getUserWithdrawals,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal
} from '../controllers/withdrawalController.js';
import { withdrawalValidator } from '../validators/userValidators.js';
import { validationResult } from 'express-validator';

const router = express.Router();

// USER ROUTES
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

router.post('/', requireAuth, withdrawalValidator, handleValidation, requestWithdrawal); // POST /withdrawal
router.get('/', requireAuth, getUserWithdrawals); // GET /withdrawal

// ADMIN ROUTES
router.get('/admin', requireAuth, requireAdmin, getAllWithdrawals); // GET /withdrawal/admin
router.put('/:withdrawalId/approve', requireAuth, requireAdmin, approveWithdrawal); // PUT /withdrawal/:withdrawalId/approve
router.put('/:withdrawalId/reject', requireAuth, requireAdmin, rejectWithdrawal); // PUT /withdrawal/:withdrawalId/reject

export default router; 