import mongoose from 'mongoose';
import User from '../models/User.js';

// Generate unique referral code
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function generateUniqueReferralCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateCode(); // 8-char A-Z0-9
    const exists = await User.exists({ 'referral.referralCode': code });
    if (!exists) return code;
  }
  throw new Error('Failed to generate referral code');
}

