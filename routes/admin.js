import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getAllUsers, updateUserIncome, getAllPaymentSlips, updatePaymentSlipStatus } from '../controllers/adminController.js';

const router = express.Router();

// ADMIN: Get all users
router.get('/users', requireAuth, requireAdmin, getAllUsers);

// ADMIN: Update user income
router.put('/user/:id/income', requireAuth, requireAdmin, updateUserIncome);

// ADMIN: Get all payment slips
router.get('/payment-slips', requireAuth, requireAdmin, getAllPaymentSlips);

// ADMIN: Update payment slip status
router.put('/payment-slip/:id/status', requireAuth, requireAdmin, updatePaymentSlipStatus);

export default router; 