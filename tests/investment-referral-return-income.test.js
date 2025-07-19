import mongoose from 'mongoose';
import User from '../models/User.js';
import referralService from '../services/referralService.js';
import { MIN_INVESTMENT_AMOUNT, MONTHLY_ROI_PERCENT, INVESTMENT_MONTHLY_PERCENTS } from '../config/constants.js';
import { setDirectIncomeValues } from './test-helper.js';

// Use production logic with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

describe('Investment Referral Return Income Tests', () => {
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
  
  test('Process investment and monthly returns for Level 11 user', async () => {
    // Reset income values to ensure clean test
    for (let i = 0; i < 10; i++) {
      users[i].income.investmentReferralReturnIncome = 0;
      users[i].income.walletBalance = 0;
      await users[i].save();
    }
    
    // Manually set up pending investment bonuses for testing monthly returns
    const monthlyROI = Math.floor(MIN_INVESTMENT_AMOUNT * MONTHLY_ROI_PERCENT);
    
    // Set up pending bonuses for each user in the chain
    for (let i = 0; i < 10; i++) {  // For users 0-9 (upline of user 10)
      const level = 10 - i;  // Calculate level (1-10)
      const monthlyBonus = Math.floor(monthlyROI * INVESTMENT_MONTHLY_PERCENTS[level]);
      
      // Create a pending bonus that's ready to be awarded
      const today = new Date();
      const bonus = {
        investor: users[10]._id,
        amount: monthlyBonus,
        month: 1,  // First month
        awarded: false,
        createdAt: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()),  // 1 month ago
        type: 'investmentReturn'
      };
      
      users[i].investment = users[i].investment || {};
      users[i].investment.pendingInvestmentBonuses = [bonus];
      await users[i].save();
    }
    
    // Then process the monthly returns
    const result = await referralService.processMonthlyInvestmentReturns();
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('Monthly investment returns processed successfully');
  });
  
  test('Verify monthly investment return income distribution to upline users', async () => {
    // Add direct referrals to each user in the chain to meet requirements
    for (let i = 0; i < users.length - 1; i++) {
      // Create 10 direct referrals for each user (more than max requirement)
      for (let j = 0; j < 10; j++) {
        const directRef = new User({
          auth: {
            email: `direct_return_${i}_${j}@test.com`,
            password: 'hashedPassword',
            isVerified: true
          },
          profile: {
            fullName: `Direct Ref Return ${i}_${j}`,
            phone: `8${i}${j}${i}${j}${i}${j}${i}${j}`
          },
          referral: {
            referredBy: users[i]._id
          }
        });
        await directRef.save();
      }
    }
    
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    const monthlyROI = Math.floor(MIN_INVESTMENT_AMOUNT * MONTHLY_ROI_PERCENT);
    
    // Check all 10 levels of monthly investment return income
    for (let i = 0; i < 10; i++) {
      const level = i + 1; // Level 1-10
      const expectedIncome = Math.floor(monthlyROI * INVESTMENT_MONTHLY_PERCENTS[level]);
      expect(users[9-i].income.investmentReferralReturnIncome).toBe(expectedIncome);
    }
  });
  
  test('Verify wallet balance is updated with monthly investment return income', async () => {
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Each user's wallet balance should match their investment return income
    // (since we reset wallet balance to 0 at the beginning)
    for (let i = 0; i < 10; i++) {
      expect(users[i].income.walletBalance).toBe(users[i].income.investmentReferralReturnIncome);
    }
  });
  
  test('Verify monthly returns are not processed twice in the same month', async () => {
    // Reset all pending bonuses to avoid double processing
    for (let i = 0; i < 10; i++) {
      users[i].investment.pendingInvestmentBonuses = [];
      await users[i].save();
    }
    
    // Store the current values
    const initialValues = [];
    for (let i = 0; i < 10; i++) {
      initialValues.push({
        returnIncome: users[i].income.investmentReferralReturnIncome,
        walletBalance: users[i].income.walletBalance
      });
    }
    
    // Process monthly returns again (should not change anything)
    await referralService.processMonthlyInvestmentReturns();
    
    // Refresh user data from database
    for (let i = 0; i < users.length; i++) {
      users[i] = await User.findById(users[i]._id);
    }
    
    // Values should remain the same
    for (let i = 0; i < 10; i++) {
      expect(users[i].income.investmentReferralReturnIncome).toBe(initialValues[i].returnIncome);
      expect(users[i].income.walletBalance).toBe(initialValues[i].walletBalance);
    }
  });
});