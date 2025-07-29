import express from 'express';
import { body, validationResult } from 'express-validator';
import { sendSuccess, sendError, sendValidationError } from '../utils/responseHelpers.js';
import ContactMessage from '../models/ContactMessage.js';
import { submitContactForm, getUserMessages, getUserMessageDetail, getAllMessages, getMessageDetail, adminReplyOrUpdate } from '../controllers/contactController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Validation middleware for contact form
const contactValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
];

// Handle validation errors
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }
  next();
}

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit a contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 description: User's full name
 *                 minLength: 2
 *                 maxLength: 100
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               message:
 *                 type: string
 *                 description: Contact message
 *                 minLength: 10
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Contact form submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Message sent successfully! We'll get back to you within 24 hours."
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/', contactValidator, handleValidation, submitContactForm);

// User: get own messages
router.get('/my', requireAuth, getUserMessages);
router.get('/my/:id', requireAuth, getUserMessageDetail);

// Admin: get all messages, get detail, update/reply
router.get('/', requireAuth, requireAdmin, getAllMessages);
router.get('/:id', requireAuth, requireAdmin, getMessageDetail);
router.patch('/:id', requireAuth, requireAdmin, adminReplyOrUpdate);

export default router; 