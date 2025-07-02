import express from 'express';
import { uploadSlip, getSlip, verifySlip } from '../controllers/paymentController.js';
import upload from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Upload payment slip
router.post('/upload', requireAuth, upload.single('file'), uploadSlip);
// Get payment slip for the authenticated user
router.get('/user', requireAuth, getSlip);
// Verify a payment slip (admin)
router.post('/verify/:slipId', verifySlip);

export default router; 