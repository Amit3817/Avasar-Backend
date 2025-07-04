import mongoose from 'mongoose';

const investmentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true }, // 24 months from start date
  lockInPeriod: { type: Number, default: 24 }, // 24 months lock-in
  monthsPaid: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  isLocked: { type: Boolean, default: true }, // Whether investment is still locked
  withdrawalRestriction: { type: Number, default: 0 }, // Amount that cannot be withdrawn
  // Add any additional fields as needed
});

investmentSchema.index({ user: 1, active: 1 });
investmentSchema.index({ user: 1, startDate: -1 });

export default mongoose.model('Investment', investmentSchema); 