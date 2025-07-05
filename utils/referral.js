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
  let code;
  let isUnique = false;
  while (!isUnique) {
    code = generateCode();
    const existingUser = await User.findOne({ 'referral.referralCode': code });
    if (!existingUser) {
      isUnique = true;
    }
  }
  return code;
} 