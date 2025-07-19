import mongoose from 'mongoose';

// Profile subdocument
const profileSchema = new mongoose.Schema({
  fullName: String,
  phone: { type: String, unique: true },
  profilePicture: { type: String, default: '' },
  position: { type: String, enum: ['left', 'right', null], default: null },
  rank: { type: String, default: 'Associate' }
}, { _id: false });

// Authentication subdocument
const authSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpires: Date,
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: { type: Date, default: null },
  isAdmin: { type: Boolean, default: false }
}, { _id: false });

// Referral subdocument
const referralSchema = new mongoose.Schema({
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  leftChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  rightChildren: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  directReferrals: { type: Number, default: 0 },
  teamSize: { type: Number, default: 0 }
}, { _id: false });

// Income subdocument
const incomeSchema = new mongoose.Schema({
  referralIncome: { type: Number, default: 0 },
  matchingIncome: { type: Number, default: 0 },
  rewardIncome: { type: Number, default: 0 },
  investmentIncome: { type: Number, default: 0 },
  investmentReferralIncome: { type: Number, default: 0 },
  investmentReferralPrincipalIncome: { type: Number, default: 0 },
  investmentReferralReturnIncome: { type: Number, default: 0 },
  referralInvestmentPrincipal: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 }
}, { _id: false });

// Investment subdocument
const investmentSchema = new mongoose.Schema({
  totalInvestment: { type: Number, default: 0 },
  investmentStartDate: { type: Date, default: null },
  investmentEndDate: { type: Date, default: null },
  investmentLockInPeriod: { type: Number, default: 24 },
  investmentIsLocked: { type: Boolean, default: false },
  lockedInvestmentAmount: { type: Number, default: 0 },
  availableAmount: { type: Number, default: 0 },
  availableForWithdrawal: { type: Number, default: 0 },
  pendingInvestmentBonuses: { type: Array, default: [] }
}, { _id: false });

// System subdocument
const systemSchema = new mongoose.Schema({
  pairs: { type: Number, default: 0 },
  totalPairs: { type: Number, default: 0 },
  awardedRewards: [{ type: String }],
  matchingPaid: { type: Boolean, default: false },
  matchingPairsToday: { type: Object, default: {} }
}, { _id: false });

const userSchema = new mongoose.Schema({
  // Core fields
  profile: { type: profileSchema, default: () => ({}) },
  auth: { type: authSchema, default: () => ({}) },
  referral: { type: referralSchema, default: () => ({}) },
  income: { type: incomeSchema, default: () => ({}) },
  investment: { type: investmentSchema, default: () => ({}) },
  system: { type: systemSchema, default: () => ({}) },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now }
});

// Indexes
userSchema.index({ 'referral.referredBy': 1 });
userSchema.index({ 'referral.leftChildren': 1 });
userSchema.index({ 'referral.rightChildren': 1 });
userSchema.index({ 'referral.referralCode': 1 });
userSchema.index({ 'auth.email': 1 });
userSchema.index({ 'profile.phone': 1 });

// Virtual getters for backward compatibility
userSchema.virtual('fullName').get(function() { return this.profile?.fullName; });
userSchema.virtual('email').get(function() { return this.auth?.email; });
userSchema.virtual('phone').get(function() { return this.profile?.phone; });
userSchema.virtual('password').get(function() { return this.auth?.password; });
userSchema.virtual('isVerified').get(function() { return this.auth?.isVerified; });
userSchema.virtual('isAdmin').get(function() { return this.auth?.isAdmin; });
userSchema.virtual('referralCode').get(function() { return this.referral?.referralCode; });
userSchema.virtual('referredBy').get(function() { return this.referral?.referredBy; });
userSchema.virtual('position').get(function() { return this.profile?.position; });
userSchema.virtual('profilePicture').get(function() { return this.profile?.profilePicture; });
userSchema.virtual('rank').get(function() { return this.profile?.rank; });
userSchema.virtual('walletBalance').get(function() { return this.income?.walletBalance; });
userSchema.virtual('totalInvestment').get(function() { return this.investment?.totalInvestment; });
userSchema.virtual('teamSize').get(function() { return this.referral?.teamSize; });
userSchema.virtual('directReferrals').get(function() { return this.referral?.directReferrals; });
userSchema.virtual('referralIncome').get(function() { return this.income?.referralIncome; });
userSchema.virtual('matchingIncome').get(function() { return this.income?.matchingIncome; });
userSchema.virtual('rewardIncome').get(function() { return this.income?.rewardIncome; });
userSchema.virtual('investmentIncome').get(function() { return this.income?.investmentIncome; });
userSchema.virtual('investmentReferralPrincipalIncome').get(function() { return this.income?.investmentReferralPrincipalIncome; });
userSchema.virtual('investmentReferralReturnIncome').get(function() { return this.income?.investmentReferralReturnIncome; });
userSchema.virtual('availableForWithdrawal').get(function() { return this.investment?.availableForWithdrawal; });
userSchema.virtual('availableAmount').get(function() { return this.investment?.availableAmount; });

// Virtual setters for backward compatibility
userSchema.virtual('fullName').set(function(value) { if (!this.profile) this.profile = {}; this.profile.fullName = value; });
userSchema.virtual('email').set(function(value) { if (!this.auth) this.auth = {}; this.auth.email = value; });
userSchema.virtual('phone').set(function(value) { if (!this.profile) this.profile = {}; this.profile.phone = value; });
userSchema.virtual('password').set(function(value) { if (!this.auth) this.auth = {}; this.auth.password = value; });
userSchema.virtual('isVerified').set(function(value) { if (!this.auth) this.auth = {}; this.auth.isVerified = value; });
userSchema.virtual('isAdmin').set(function(value) { if (!this.auth) this.auth = {}; this.auth.isAdmin = value; });
userSchema.virtual('referralCode').set(function(value) { if (!this.referral) this.referral = {}; this.referral.referralCode = value; });
userSchema.virtual('referredBy').set(function(value) { if (!this.referral) this.referral = {}; this.referral.referredBy = value; });
userSchema.virtual('position').set(function(value) { if (!this.profile) this.profile = {}; this.profile.position = value; });
userSchema.virtual('profilePicture').set(function(value) { if (!this.profile) this.profile = {}; this.profile.profilePicture = value; });
userSchema.virtual('rank').set(function(value) { if (!this.profile) this.profile = {}; this.profile.rank = value; });
userSchema.virtual('walletBalance').set(function(value) { if (!this.income) this.income = {}; this.income.walletBalance = value; });
userSchema.virtual('totalInvestment').set(function(value) { if (!this.investment) this.investment = {}; this.investment.totalInvestment = value; });
userSchema.virtual('teamSize').set(function(value) { if (!this.referral) this.referral = {}; this.referral.teamSize = value; });
userSchema.virtual('directReferrals').set(function(value) { if (!this.referral) this.referral = {}; this.referral.directReferrals = value; });
userSchema.virtual('referralIncome').set(function(value) { if (!this.income) this.income = {}; this.income.referralIncome = value; });
userSchema.virtual('matchingIncome').set(function(value) { if (!this.income) this.income = {}; this.income.matchingIncome = value; });
userSchema.virtual('rewardIncome').set(function(value) { if (!this.income) this.income = {}; this.income.rewardIncome = value; });
userSchema.virtual('investmentIncome').set(function(value) { if (!this.income) this.income = {}; this.income.investmentIncome = value; });
userSchema.virtual('investmentReferralPrincipalIncome').set(function(value) { if (!this.income) this.income = {}; this.income.investmentReferralPrincipalIncome = value; });
userSchema.virtual('investmentReferralReturnIncome').set(function(value) { if (!this.income) this.income = {}; this.income.investmentReferralReturnIncome = value; });
userSchema.virtual('availableForWithdrawal').set(function(value) { if (!this.investment) this.investment = {}; this.investment.availableForWithdrawal = value; });
userSchema.virtual('availableAmount').set(function(value) { if (!this.investment) this.investment = {}; this.investment.availableAmount = value; });

// Enable virtuals in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);
export default User;