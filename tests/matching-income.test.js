import mongoose from 'mongoose';
import User from '../models/User.js';
import PaymentSlip from '../models/PaymentSlip.js';
import referralService from '../services/referralService.js';
import { REGISTRATION_AMOUNT } from '../config/constants.js';
import { setDirectIncomeValues, createPaymentSlip } from './test-helper.js';

// Use production logic with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

describe('Matching Income Tests', () => {
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
  
  test('Setup test users in a binary structure', async () => {
    // Create parent user (Level 1)
    const parent = new User({
      auth: {
        email: 'parent@test.com',
        password: 'hashedPassword',
        isVerified: true
      },
      profile: {
        fullName: 'Level 1 User',
        phone: '1234567890'
      },
      referral: {
        code: 'REF1',
        leftChildren: [],
        rightChildren: [],
        directReferralCount: 10 // More than the max requirement
      },
      // Initialize income and system objects
      income: {
        referralIncome: 0,
        matchingIncome: 0,
        walletBalance: 0
      },
      system: {
        totalPairs: 0,
        matchingPairsToday: {}
      }
    });
    
    await parent.save();
    users.push(parent);
    
    // Create left child (Level 2 Left)
    const leftChild = new User({
      auth: {
        email: 'left@test.com',
        password: 'hashedPassword',
        isVerified: true
      },
      profile: {
        fullName: 'Level 2 Left User',
        phone: '1234567891',
        position: 'left'
      },
      referral: {
        code: 'REF2L',
        referredBy: parent._id,
        leftChildren: [],
        rightChildren: [],
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
    
    await leftChild.save();
    users.push(leftChild);
    
    // Update parent with left child
    parent.referral.leftChildren = [leftChild._id];
    await parent.save();
    
    // Create right child (Level 2 Right)
    const rightChild = new User({
      auth: {
        email: 'right@test.com',
        password: 'hashedPassword',
        isVerified: true
      },
      profile: {
        fullName: 'Level 2 Right User',
        phone: '1234567892',
        position: 'right'
      },
      referral: {
        code: 'REF2R',
        referredBy: parent._id,
        leftChildren: [],
        rightChildren: [],
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
    
    await rightChild.save();
    users.push(rightChild);
    
    // Update parent with right child
    parent.referral.rightChildren = [rightChild._id];
    await parent.save();
    
    expect(users.length).toBe(3);
  });
  
  test('Create approved registration payment for right child', async () => {
    const paymentSlip = new PaymentSlip({
      user: users[2]._id, // Right child
      amount: REGISTRATION_AMOUNT,
      status: 'approved',
      paymentMethod: 'bank',
      transactionId: 'test-transaction'
    });
    
    await paymentSlip.save();
    expect(paymentSlip.status).toBe('approved');
    
    // Add direct referrals to parent to meet requirements
    for (let j = 0; j < 10; j++) {
      const directRef = new User({
        auth: {
          email: `direct_parent_${j}@test.com`,
          password: 'hashedPassword',
          isVerified: true
        },
        profile: {
          fullName: `Direct Ref Parent ${j}`,
          phone: `9${j}${j}${j}${j}${j}${j}${j}`
        },
        referral: {
          referredBy: users[0]._id
        }
      });
      await directRef.save();
    }
  });
  
  test('Process matching income when right child registers', async () => {
    // Call the actual service function
    const result = await referralService.processRegistrationIncome(users[2]._id);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Registration income processed successfully');
  });
  
  test('Verify parent receives matching income', async () => {
    // Refresh parent user data from database
    const updatedParent = await User.findById(users[0]._id);
    
    // Parent should receive 10% of registration amount as matching income
    const expectedMatchingIncome = Math.floor(REGISTRATION_AMOUNT * 0.10);
    expect(updatedParent.income.matchingIncome).toBe(expectedMatchingIncome);
    
    // Parent's wallet balance should include matching income
    expect(updatedParent.income.walletBalance).toBeGreaterThanOrEqual(expectedMatchingIncome);
    
    // Parent's total pairs should be incremented
    expect(updatedParent.system.totalPairs).toBe(1);
  });
  
  test('Verify matching income is not awarded twice for the same pair', async () => {
    // Try to process registration income again for the same user
    const result = await referralService.processRegistrationReferralIncome(users[2]._id);
    
    // Should not process again since registration was already processed
    expect(result.success).toBe(false);
    expect(result.message).toContain('Registration already processed');
    
    // Refresh parent user data from database
    const updatedParent = await User.findById(users[0]._id);
    
    // Parent's matching income should remain the same
    const expectedMatchingIncome = Math.floor(REGISTRATION_AMOUNT * 0.10);
    expect(updatedParent.income.matchingIncome).toBe(expectedMatchingIncome);
    
    // Parent's total pairs should remain the same
    expect(updatedParent.system.totalPairs).toBe(1);
  });
});