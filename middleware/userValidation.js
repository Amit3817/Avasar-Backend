import User from '../models/User.js';
import { sendNotFound, sendForbidden, sendError } from '../utils/responseHelpers.js';

// Middleware to validate if a user exists
export const validateUserExists = async (req, res, next) => {
  try {
    const userId = req.params.id || req.params.userId;
    if (!userId) {
      return sendNotFound(res, 'User ID is required');
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    req.targetUser = user;
    next();
  } catch (error) {
    return sendError(res, 'Error validating user', 500, error.message);
  }
};

// Middleware to validate if user is active
export const validateUserActive = (req, res, next) => {
  if (req.targetUser && req.targetUser.status === 'suspended') {
    return sendForbidden(res, 'User account is suspended');
  }
  next();
}; 