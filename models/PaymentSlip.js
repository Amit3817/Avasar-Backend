import mongoose from 'mongoose';

const paymentSlipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  file: String,
  status: { type: String, default: 'pending' }, // pending, verified, rejected
  reason: { type: String }, // admin reason for approval/rejection
  uploadedAt: { type: Date, default: Date.now },
  amount: Number,
  method: String,
  transactionId: String,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  rejectedAt: Date,
  remarks: String,
  slipLink: String, // URL to the uploaded slip
});

// Add indexes for frequently queried fields
paymentSlipSchema.index({ user: 1, status: 1 });
paymentSlipSchema.index({ status: 1, uploadedAt: -1 });
paymentSlipSchema.index({ user: 1, amount: 1, status: 1 }); // For registration payment queries

export default mongoose.model('PaymentSlip', paymentSlipSchema); 