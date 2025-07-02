import User from '../models/User.js';
import crypto from 'crypto';

const REFERRAL_CODE_LENGTH = 8;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, 1, O, I, l

// Assumed income values (to be revised later)
const REFERRAL_INCOME = 100;
const MATCHING_INCOME = 50;
const GENERATION_INCOME = 20;
const TRADING_INCOME = 10;
const REWARD_INCOME = 200;

function generateCode() {
  let code = '';
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += CHARSET[bytes[i] % CHARSET.length];
  }
  return code;
}

export async function generateUniqueReferralCode() {
  let code;
  let exists = true;
  while (exists) {
    code = generateCode();
    exists = await User.exists({ referralCode: code });
  }
  return code;
}

export async function addReferralIncome(newUserId, refUser = null) {
  // Give referral income to the referrer (if any)
  let referrer = refUser;
  if (!referrer) {
    const newUser = await User.findById(newUserId);
    if (newUser && newUser.referredBy) {
      referrer = await User.findOne({ referralCode: newUser.referredBy });
    }
  }
  if (referrer) {
    await User.findByIdAndUpdate(referrer._id, { $inc: { referralIncome: REFERRAL_INCOME } });
  }
}

export async function addMatchingIncome(newUserId, refUser = null) {
  // Pay matching income for every new left/right direct referral pair formed
  let referrer = refUser;
  if (!referrer) {
    const newUser = await User.findById(newUserId);
    if (newUser && newUser.referredBy) {
      referrer = await User.findOne({ referralCode: newUser.referredBy });
    }
  }
  if (referrer) {
    const leftCount = referrer.left.length;
    const rightCount = referrer.right.length;
    const pairs = Math.min(leftCount, rightCount);
    const newPairs = pairs - (referrer.pairs || 0);
    if (newPairs > 0) {
      await User.findByIdAndUpdate(referrer._id, {
        $inc: { matchingIncome: MATCHING_INCOME * newPairs },
        pairs: pairs
      });
    }
  }
}

export async function addGenerationIncome(newUserId) {
  // Distribute generation income up to 3 levels in the referral chain
  let currentUser = await User.findById(newUserId);
  let levels = 3;
  for (let i = 0; i < levels; i++) {
    if (!currentUser || !currentUser.referredBy) break;
    const parent = await User.findOne({ referralCode: currentUser.referredBy });
    if (!parent) break;
    await User.findByIdAndUpdate(parent._id, { $inc: { generationIncome: GENERATION_INCOME } });
    currentUser = parent;
  }
}

export async function addTradingIncome(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { tradingIncome: TRADING_INCOME } });
}

export async function addRewardIncome(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { rewardIncome: REWARD_INCOME } });
} 