import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  password: String,
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpires: Date,
  paymentStatus: { type: String, default: 'pending' }, // pending, uploaded, verified
  paymentSlip: String, // file path
  referralCode: { type: String, unique: true, index: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // reference to User
  position: { type: String, enum: ['left', 'right', null], default: null }, // left or right position if using referral
  isAdmin: { type: Boolean, default: false },
  referralIncome: { type: Number, default: 0 },
  matchingIncome: { type: Number, default: 0 },
  generationIncome: { type: Number, default: 0 },
  tradingIncome: { type: Number, default: 0 },
  rewardIncome: { type: Number, default: 0 },
  matchingPaid: { type: Boolean, default: false },
  left: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  right: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pairs: { type: Number, default: 0 },
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: { type: Date, default: null },
  profilePicture: { type: String, default: '' }, // URL or file path for profile picture
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);

// Add indexes for efficient queries
userSchema.index({ referredBy: 1 });
userSchema.index({ referredBy: 1, position: 1 }); 