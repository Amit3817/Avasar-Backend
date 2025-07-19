import mongoose from 'mongoose';
import User from '../models/User.js';
import referralService from '../services/referralService.js';
import { MIN_INVESTMENT_AMOUNT, INVESTMENT_ONE_TIME_PERCENTS } from '../config/constants.js';
import { setDirectIncomeValues } from './test-helper.js';

// Use production logic with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

describe('Investment Referral Income Tests', () => {
  let users = [];
  
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/avasar_test', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Clear test database
    await User.deleteMany({});
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
          leftChildren: [],
          rightChildren: [],
          directReferralCount: 10 // More than the max requirement
        },
        // Initialize income and system objects
        income: {
          referralIncome: 0,
          investmentReferralIncome: 0,
          investmentReferralReturnIncome: 0,
          investmentReferralPrincipalIncome: 0,
          referralInvestmentPrincipal: 0,
          walletBalance: 0
        },
        system: {
          totalPairs: 0,
          matchingPairsToday: {}
        },
        investment: {
          pendingInvestmentBonuses: []
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
  
  test('Process investment referral income for Level 11 user', async () => {
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
    
    // Call the actual service function
    const result = await referralService.processInvestmentBonuses(users[10]._id, MIN_INVESTMENT_AMOUNT);
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Investment bonuses processed successfully');
  });
  
  test('Verify investment referral income distribution to upline users', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Check all 10 levels of investment referral income
    for (let i = 0; i < 10; i++) {
      const level = i + 1; // Level 1-10
      const expectedIncome = Math.floor(MIN_INVESTMENT_AMOUNT * INVESTMENT_ONE_TIME_PERCENTS[level]);
      expect(users[9-i].income.investmentReferralIncome).toBe(expectedIncome);
    }
  });
  
  test('Verify wallet balance is updated with investment referral income', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Each user's wallet balance should match their investment referral income
    for (let i = 0; i < 10; i++) {
      expect(users[i].income.walletBalance).toBe(users[i].income.investmentReferralIncome);
    }
  });
  
  test('Verify investment referral principal income is tracked correctly', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Each user should have the investment principal tracked
    for (let i = 0; i < 10; i++) {
      expect(users[i].income.investmentReferralPrincipalIncome).toBe(users[i].income.investmentReferralIncome);
      expect(users[i].income.referralInvestmentPrincipal).toBe(MIN_INVESTMENT_AMOUNT);
    }
  });
});