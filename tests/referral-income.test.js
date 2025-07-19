import mongoose from 'mongoose';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import referralService from '../services/referralService.js';
import { REGISTRATION_AMOUNT, REFERRAL_PERCENTS } from '../config/constants.js';
import { setDirectIncomeValues, createPaymentSlip } from './test-helper.js';

// Use production logic with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

describe('Referral Income Tests', () => {
  let users = [];
  
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/avasar_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Clear test database
    await User.deleteMany({});
    await PaymentSlip.deleteMany({});
  });
  
  afterAll(async () => {
    // Disconnect from test database
    await mongoose.connection.close();
  });
  
  test('Setup test users in a referral chain', async () => {
    // Create a chain of users (Level 1 refers Level 2, Level 2 refers Level 3, etc.)
    for (let i = 1; i <= 11; i++) {
      const user = new User({
        auth: {
          email: `level${i}@test.com`,
          password: 'hashedPassword',
          isVerified: true
        },
        profile: {
          fullName: `Level ${i} User`,
          phone: `123456789${i}`
        },
        referral: {
          code: `REF${i}`,
          referredBy: i > 1 ? users[i-2]._id : null,
          // Initialize arrays to avoid null errors
          leftChildren: [],
          rightChildren: [],
          // Add enough direct referrals to meet requirements
          directReferralCount: 10 // More than the max requirement
        },
        // Initialize income and system objects
        income: {
          referralIncome: 0,
          walletBalance: 0
        },
        system: {
          totalPairs: 0,
          matchingPairsToday: {}
        }
      });
      
      await user.save();
      users.push(user);
      
      // Update the referrer's children arrays if this isn't the first user
      if (i > 1) {
        const referrer = users[i-2];
        // Alternate between left and right for testing
        if (i % 2 === 0) {
          referrer.referral.leftChildren.push(user._id);
        } else {
          referrer.referral.rightChildren.push(user._id);
        }
        await referrer.save();
      }
    }
    
    expect(users.length).toBe(11);
  });
  
  test('Create approved registration payment for Level 11 user', async () => {
    // Create a payment slip for the registration
    const paymentSlip = new PaymentSlip({
      user: users[10]._id,
      amount: REGISTRATION_AMOUNT,
      status: 'approved',
      paymentMethod: 'bank',
      transactionId: 'test-transaction'
    });
    
    await paymentSlip.save();
    expect(paymentSlip.status).toBe('approved');
    
    // Add direct referrals to each user in the chain to meet requirements
    for (let i = 0; i < users.length - 1; i++) {
      // Create 10 direct referrals for each user (more than max requirement)
      for (let j = 0; j < 10; j++) {
        const directRef = new User({
          auth: {
            email: `direct${i}_${j}@test.com`,
            password: 'hashedPassword',
            isVerified: true
          },
          profile: {
            fullName: `Direct Ref ${i}_${j}`,
            phone: `9${i}${j}${i}${j}${i}${j}${i}${j}`
          },
          referral: {
            referredBy: users[i]._id
          }
        });
        await directRef.save();
      }
    }
  });
  
  test('Process referral income for Level 11 user registration', async () => {
    // Call the actual service function
    const result = await referralService.processRegistrationIncome(users[10]._id);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Registration income processed successfully');
  });
  
  test('Verify referral income distribution to upline users', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Check all 10 levels of referral income
    for (let i = 0; i < 10; i++) {
      const level = i + 1; // Level 1-10
      const expectedIncome = Math.floor(REGISTRATION_AMOUNT * REFERRAL_PERCENTS[level]);
      expect(users[9-i].income.referralIncome).toBe(expectedIncome);
    }
  });
  
  test('Verify wallet balance is updated with referral income', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Each user's wallet balance should match their referral income
    for (let i = 0; i < 10; i++) {
      expect(users[i].income.walletBalance).toBe(users[i].income.referralIncome);
    }
  });
});