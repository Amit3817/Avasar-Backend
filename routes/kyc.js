// routes/kycRoutes.js
import express from 'express';
import kycController from '../controllers/kycController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js'; // Your existing upload

const router = express.Router();

// User routes
router.post('/submit', requireAuth, upload.single('documentImage'), kycController.submitKYC);
router.get('/my-kyc', requireAuth, kycController.getMyKYC);

// Admin routes
router.get('/all', requireAuth, requireAdmin, kycController.getAllKYCs);
router.get('/:id', requireAuth, requireAdmin, kycController.getKYCById);
router.put('/:id/approve', requireAuth, requireAdmin, kycController.approveKYC);
router.put('/:id/reject', requireAuth, requireAdmin, kycController.rejectKYC);
router.get('/admin/stats', requireAuth, requireAdmin, kycController.getKYCStats);

export default router;