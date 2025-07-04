import helmet from 'helmet';
import slowDown from 'express-slow-down';
import logger from '../config/logger.js';

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Slow down middleware for additional protection (updated syntax)
export const slowDownConfig = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  }
});

// Request size limits
export const requestSizeLimit = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxSize) {
    logger.warn(`Large request detected from IP: ${req.ip}, size: ${contentLength} bytes`);
    return res.status(413).json({ 
      error: 'Request entity too large',
      message: 'Request size exceeds the 10MB limit'
    });
  }
  next();
};

// Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// IP whitelist middleware (optional)
export const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // No restrictions if no IPs specified
    }
    
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!allowedIPs.includes(clientIP)) {
      logger.warn(`Blocked request from unauthorized IP: ${clientIP}`);
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// Request logging for security monitoring
export const securityLogging = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // Log suspicious activities
    if (res.statusCode >= 400) {
      logger.warn('Suspicious request detected:', logData);
    } else {
      logger.info('Request processed:', logData);
    }
  });
  
  next();
};

export default {
  helmetConfig,
  slowDownConfig,
  requestSizeLimit,
  securityHeaders,
  ipWhitelist,
  securityLogging
}; 