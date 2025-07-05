// Basic OTP Rate Limiter - Simple in-memory implementation
const otpAttempts = new Map();
const resendAttempts = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of otpAttempts.entries()) {
    if (now - data.lastAttempt > 5 * 60 * 1000) { // 5 minutes
      otpAttempts.delete(key);
    }
  }
  for (const [key, data] of resendAttempts.entries()) {
    if (now - data.lastAttempt > 5 * 60 * 1000) { // 5 minutes
      resendAttempts.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Basic OTP verification rate limiter
export const otpVerificationLimiter = (req, res, next) => {
  const email = req.body.email;
  const now = Date.now();
  const key = `verify_${email}`;
  
  const attempts = otpAttempts.get(key) || { count: 0, lastAttempt: 0 };
  
  // Reset if more than 5 minutes have passed
  if (now - attempts.lastAttempt > 5 * 60 * 1000) {
    attempts.count = 0;
  }
  
  // Allow max 5 attempts per 5 minutes
  if (attempts.count >= 5) {
    return res.status(429).json({
      error: 'Too many OTP verification attempts. Please try again in 5 minutes.',
      remainingTime: Math.ceil((attempts.lastAttempt + 5 * 60 * 1000 - now) / 1000)
    });
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  otpAttempts.set(key, attempts);
  
  next();
};

// Basic OTP resend rate limiter
export const otpResendLimiter = (req, res, next) => {
  const email = req.body.email;
  const now = Date.now();
  const key = `resend_${email}`;
  
  const attempts = resendAttempts.get(key) || { count: 0, lastAttempt: 0 };
  
  // Reset if more than 5 minutes have passed
  if (now - attempts.lastAttempt > 5 * 60 * 1000) {
    attempts.count = 0;
  }
  
  // Allow max 3 resend attempts per 5 minutes
  if (attempts.count >= 3) {
    return res.status(429).json({
      error: 'Too many OTP resend attempts. Please try again in 5 minutes.',
      remainingTime: Math.ceil((attempts.lastAttempt + 5 * 60 * 1000 - now) / 1000)
    });
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  resendAttempts.set(key, attempts);
  
  next();
};

// Track OTP attempt (for compatibility)
export const trackOtpAttempt = (email) => {
  const key = `verify_${email}`;
  const attempts = otpAttempts.get(key) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  otpAttempts.set(key, attempts);
};

// Reset OTP attempts (for compatibility)
export const resetOtpAttempts = (email) => {
  const key = `verify_${email}`;
  otpAttempts.delete(key);
}; 