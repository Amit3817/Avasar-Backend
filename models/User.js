const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Referral Code
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  // MLM Structure
  sponsorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  upline: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  downline: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  rank: {
    type: String,
    enum: ['Supervisor', 'Senior Supervisor', 'Manager', 'Executive Manager', 'Eagle', 'Eagle Executive', 'Silver', 'Gold', 'Pearl', 'Diamond', 'Ambassador', 'King', 'Universal King'],
    default: 'Supervisor'
  },
  // Investment Details
  investment: {
    amount: {
      type: Number,
      default: 0
    },
    date: {
      type: Date
    }
  },
  // Income Tracking
  income: {
    referral: { type: Number, default: 0 },
    matching: { type: Number, default: 0 },
    generation: { type: Number, default: 0 },
    trading: { type: Number, default: 0 },
    reward: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  // Timestamps
  joinedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate unique referral code
userSchema.methods.generateReferralCode = async function() {
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = generateCode();
    const existingUser = await mongoose.model('User').findOne({ referralCode: code });
    if (!existingUser) {
      isUnique = true;
    }
  }
  
  return code;
};

// Hash password and generate referral code before saving
userSchema.pre('save', async function(next) {
  try {
    // Hash password if modified
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    
    // Generate referral code if new user and no referral code exists
    if (this.isNew && !this.referralCode) {
      this.referralCode = await this.generateReferralCode();
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Method to calculate total income
userSchema.methods.calculateTotalIncome = function() {
  this.income.total = this.income.referral + this.income.matching + 
                     this.income.generation + this.income.trading + this.income.reward;
  return this.income.total;
};

module.exports = mongoose.model('User', userSchema); 