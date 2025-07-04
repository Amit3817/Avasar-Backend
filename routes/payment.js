import express from 'express';
import { uploadSlip, getSlip } from '../controllers/paymentController.js';
import upload from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadSlipValidator } from '../validators/paymentValidators.js';
import { validationResult } from 'express-validator';
import { uploadLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
}

// Upload payment slip
router.post('/upload', requireAuth, uploadLimiter, upload.single('file'), uploadSlipValidator, handleValidation, uploadSlip);
// Get payment slip for the authenticated user
router.get('/user', requireAuth, getSlip);

export default router; 