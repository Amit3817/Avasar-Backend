import rateLimit from 'express-rate-limit';

// Store for tracking OTP attempts per email
const otpAttempts = new Map();

// Clean up old attempts every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpAttempts.entries()) {
    if (now - data.lastAttempt > 15 * 60 * 1000) { // 15 minutes
      otpAttempts.delete(email);
    }
  }
}, 15 * 60 * 1000); // Clean up every 15 minutes

// OTP verification limiter - 5 attempts per 15 minutes
export const otpVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    message: 'Too many OTP verification attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email as key for OTP attempts
    return req.body?.email || req.ip;
  }
});

// OTP resend limiter - 3 resends per 15 minutes
export const otpResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 resends per window
  message: {
    success: false,
    message: 'Too many OTP resend attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use email as key for OTP resends
    return req.body?.email || req.ip;
  }
});

// Function to track failed OTP attempts
export const trackOtpAttempt = (email) => {
  const now = Date.now();
  const attempts = otpAttempts.get(email) || { count: 0, lastAttempt: now };
  
  attempts.count++;
  attempts.lastAttempt = now;
  
  otpAttempts.set(email, attempts);
  
  return attempts.count;
};

// Function to reset OTP attempts for successful verification
export const resetOtpAttempts = (email) => {
  otpAttempts.delete(email);
}; 