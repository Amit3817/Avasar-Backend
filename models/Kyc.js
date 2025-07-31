import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  // User Reference
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  
  // Status
  status: { 
    type: String, 
    enum: ['pending', 'submitted', 'approved', 'rejected'], 
    default: 'pending' 
  },
  
  // Basic Personal Info
  fullName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  
  // Address
  address: { type: String, required: true },
  
  // Document
  documentType: { 
    type: String, 
    enum: ['aadhaar', 'passport', 'driving_license', 'voter_id', 'bank_passbook'], 
    required: true 
  },
  documentNumber: { type: String, required: true },
  documentImage: { type: String, required: true }, // File path/URL
  
  // Admin fields
  rejectionReason: { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  
  // Timestamps
  submittedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
kycSchema.index({ userId: 1 }, { unique: true });
kycSchema.index({ status: 1 });
kycSchema.index({ documentNumber: 1 });

// Update timestamp on save
kycSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Simple methods
kycSchema.methods.isApproved = function() {
  return this.status === 'approved';
};

kycSchema.methods.isPending = function() {
  return this.status === 'pending' || this.status === 'submitted';
};

const KYC = mongoose.model('KYC', kycSchema);
export default KYC;