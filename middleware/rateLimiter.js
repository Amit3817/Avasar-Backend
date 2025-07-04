import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 1000) // 15 minutes in seconds
    });
  }
});

// Auth endpoints rate limit (login, register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: Math.ceil(15 * 60 / 1000)
    });
  }
});

// OTP endpoints rate limit
export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 3, // limit each IP to 3 OTP requests per minute
  message: 'Too many OTP requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`OTP rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many OTP requests, please try again later.',
      retryAfter: Math.ceil(60 / 1000) // 1 minute in seconds
    });
  }
});

// Withdrawal endpoints rate limit
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 withdrawal requests per hour
  message: 'Too many withdrawal requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id || req.ip, // Use user ID if authenticated, otherwise IP
  handler: (req, res) => {
    logger.warn(`Withdrawal rate limit exceeded for user: ${req.user?._id || req.ip}`);
    res.status(429).json({
      error: 'Too many withdrawal requests, please try again later.',
      retryAfter: Math.ceil(60 * 60 / 1000) // 1 hour in seconds
    });
  }
});

// File upload rate limit
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 uploads per hour
  message: 'Too many file uploads, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id || req.ip,
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for user: ${req.user?._id || req.ip}`);
    res.status(429).json({
      error: 'Too many file uploads, please try again later.',
      retryAfter: Math.ceil(60 * 60 / 1000)
    });
  }
});

export default {
  generalLimiter,
  authLimiter,
  otpLimiter,
  withdrawalLimiter,
  uploadLimiter
}; 