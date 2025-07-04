import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  password: String,
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpires: Date,
  referralCode: { type: String, unique: true, index: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // reference to User
  position: { type: String, enum: ['left', 'right', null], default: null }, // left or right position if using referral
  isAdmin: { type: Boolean, default: false },
  referralIncome: { type: Number, default: 0 },
  matchingIncome: { type: Number, default: 0 },
  rewardIncome: { type: Number, default: 0 },
  matchingPaid: { type: Boolean, default: false },
  leftChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rightChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pairs: { type: Number, default: 0 },
  totalPairs: { type: Number, default: 0 }, // Total pairs for reward milestones
  awardedRewards: [{ type: String }], // Track awarded reward milestones
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: { type: Date, default: null },
  profilePicture: { type: String, default: '' }, // URL or file path for profile picture
  createdAt: { type: Date, default: Date.now },
  directReferralCount: { type: Number, default: 0 },
  investmentReferralIncome: { type: Number, default: 0 },
  investmentReferralPrincipalIncome: { type: Number, default: 0 },
  investmentReferralReturnIncome: { type: Number, default: 0 },
  pendingInvestmentBonuses: { type: Array, default: [] },
  matchingPairsToday: { type: Object, default: {} },
  totalInvestment: { type: Number, default: 0 },
  investmentStartDate: { type: Date, default: null },
  investmentEndDate: { type: Date, default: null },
  investmentLockInPeriod: { type: Number, default: 24 }, // 24 months lock-in
  investmentIsLocked: { type: Boolean, default: false }, // Whether investment is locked
  lockedInvestmentAmount: { type: Number, default: 0 }, // Amount locked in investment
  availableForWithdrawal: { type: Number, default: 0 }, // Amount available for withdrawal
  investmentIncome: { type: Number, default: 0 },
  referralInvestmentPrincipal: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
});

userSchema.index({ referredBy: 1 });
userSchema.index({ leftChildren: 1 });
userSchema.index({ rightChildren: 1 });
export default mongoose.model('User', userSchema); 