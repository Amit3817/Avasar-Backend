import express from 'express';
import { body, validationResult } from 'express-validator';
import { sendSuccess, sendError, sendValidationError } from '../utils/responseHelpers.js';

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
    .isLength({ min: 10, max: 1000 })
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
router.post('/', contactValidator, handleValidation, async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    // Here you would typically:
    // 1. Save to database
    // 2. Send email notification
    // 3. Send confirmation email to user
    // 4. Integrate with CRM system
    
    // For now, we'll just log and return success
    // TODO: Implement actual contact form processing
    
    sendSuccess(res, { message: "Message sent successfully! We'll get back to you within 24 hours." });
    
  } catch (error) {
    sendError(res, error.message, 500);
  }
});

export default router; 