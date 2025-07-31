import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { sendSuccess, sendError, sendValidationError } from '../utils/responseHelpers.js';
import ContactMessage from '../models/ContactMessage.js';
import { 
  submitContactForm, 
  getUserMessages, 
  getUserMessageDetail, 
  userAddResponse, // <-- NEW
  getAllMessages, 
  getMessageDetail, 
  adminReplyOrUpdate,
  getTicketResponses,
  getMessageStats
} from '../controllers/contactController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Enhanced validation middleware
const contactValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('subject')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Subject must be between 1 and 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  body('category')
    .optional()
    .isIn(['technical', 'billing', 'general', 'feature-request'])
    .withMessage('Invalid category')
];

// Response validation
const responseValidator = [
  body('response')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Response must be between 1 and 2000 characters')
];

// Query validation for list endpoints
const queryValidator = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['all', 'open', 'pending', 'resolved', 'closed']),
  query('priority').optional().isIn(['all', 'low', 'medium', 'high', 'urgent']),
  query('category').optional().isIn(['all', 'technical', 'billing', 'general', 'feature-request']),
  query('sortBy').optional().isIn(['newest', 'oldest', 'priority']),
  query('search').optional().trim().escape()
];

// Handle validation errors
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }
  next();
}

// Public route - anyone can submit contact form
router.post('/', contactValidator, handleValidation, submitContactForm);

// User routes - require authentication
router.get('/my', requireAuth, queryValidator, handleValidation, getUserMessages);
router.get('/my/stats', requireAuth, getMessageStats);
router.get('/my/:id', requireAuth, getUserMessageDetail);
router.post('/my/:id/response', requireAuth, responseValidator, handleValidation, userAddResponse); // <-- NEW
router.get('/my/:id/responses', requireAuth, getTicketResponses); // <-- NEW (modified to work for users too)

// Admin routes - require admin role
router.get('/', requireAuth, requireAdmin, queryValidator, handleValidation, getAllMessages);
router.get('/:id', requireAuth, requireAdmin, getMessageDetail);
router.patch('/:id', requireAuth, requireAdmin, adminReplyOrUpdate);
router.get('/:id/responses', requireAuth, requireAdmin, getTicketResponses);

export default router;