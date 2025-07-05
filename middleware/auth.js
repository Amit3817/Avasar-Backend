import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set();

// Enhanced JWT verification
export const verifyToken = (token) => {
  try {
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      throw new Error('Token has been revoked');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'avasar-platform',
      audience: 'avasar-users',
      algorithms: ['HS256']
    });

    return decoded;
  } catch (error) {
    throw error;
  }
};

// Enhanced authentication middleware
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        message: 'Please provide a valid authentication token'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Check token length
    if (token.length < 50) {
      return res.status(401).json({ 
        error: 'Invalid token format',
        message: 'Token appears to be malformed'
      });
    }

    const decoded = verifyToken(token);
    
    // Check if user still exists and is verified
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    if (!user.auth?.isVerified) {
      return res.status(401).json({ 
        error: 'Account not verified',
        message: 'Please verify your email address before accessing this resource'
      });
    }

    // Add user info to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        message: 'The provided token is invalid or malformed'
      });
    }
    
    return res.status(401).json({ 
      error: 'Authentication failed',
      message: 'Unable to authenticate your request'
    });
  }
};

// Admin authorization middleware
export const requireAdmin = (req, res, next) => {
  if (!req.user.auth?.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin access required',
      message: 'You do not have permission to access this resource'
    });
  }
  next();
};

// Token revocation (logout)
export const revokeToken = (token) => {
  tokenBlacklist.add(token);
};

// Clean up expired tokens from blacklist (run periodically)
export const cleanupBlacklist = () => {
  // In a real implementation, you'd check token expiration
  // For now, we'll keep it simple
  const initialSize = tokenBlacklist.size;
  // You could implement cleanup logic here
};

export default {
  requireAuth,
  requireAdmin,
  verifyToken,
  revokeToken,
  cleanupBlacklist
}; 