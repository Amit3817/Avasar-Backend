import mongoose from 'mongoose';

const userHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Type of the event: now includes income types directly
  type: {
    type: String,
    required: true,
    enum: [
      'reward',
      "referral",
      "matching",
      "investment-referral",
      "monthly-investment-bonus",
      "investmentReferralReturn",
      'extra-referral',
      'extra-matching',
      "extra-investment-referral",
      "extra-monthly-investment-bonus"
    ]
  },

  amount: {
    type: Number,
    required: true
  },


status: {
  type: String,
  enum: ['pending', 'approved', 'rejected','completed'],
  default: 'completed', // or 'pending' based on your use case
},

  remarks: {
    type: String,
    default: ''
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
userHistorySchema.index({ user: 1, createdAt: -1 });
userHistorySchema.index({ referenceId: 1, refModel: 1 });

const UserHistory = mongoose.model('History', userHistorySchema);
export default UserHistory;
