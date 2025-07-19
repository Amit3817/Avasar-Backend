import mongoose from 'mongoose';
import User from '../models/User.js';
import referralService from '../services/referralService.js';
import { REWARD_MILESTONES } from '../config/constants.js';

// Use production logic with test database
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://localhost:27017/avasar_test';

describe('Reward Income Tests', () => {
  let testUser;
  
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
  
  test('Create test user for reward testing', async () => {
    testUser = new User({
      auth: {
        email: 'reward@test.com',
        password: 'hashedPassword',
        isVerified: true
      },
      profile: {
        fullName: 'Reward Test User',
        phone: '1234567890'
      },
      referral: {
        code: 'REWARD1',
        leftChildren: [],
        rightChildren: [],
        directReferralCount: 10 // More than the max requirement
      },
      system: {
        totalPairs: 0,
        awardedRewards: [],
        matchingPairsToday: {}
      },
      income: {
        referralIncome: 0,
        matchingIncome: 0,
        rewardIncome: 0,
        walletBalance: 0
      }
    });
    
    await testUser.save();
    expect(testUser._id).toBeDefined();
  });
  
  test('No rewards awarded at 0 pairs', async () => {
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // No rewards should be awarded yet (empty array)
    expect(testUser.system.awardedRewards.length).toBe(0);
  });
  
  test('First reward milestone (Supervisor) awarded at 25 pairs', async () => {
    // Set user's total pairs to 25
    testUser.system.totalPairs = 25;
    await testUser.save();
    
    // Check and award rewards
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // Supervisor reward should be awarded
    expect(testUser.system.awardedRewards).toContain('Supervisor');
    
    // No cash reward for Supervisor
    expect(testUser.income.rewardIncome).toBe(0);
  });
  
  test('Second reward milestone (Senior Supervisor) awarded at 75 pairs', async () => {
    // Set user's total pairs to 75
    testUser.system.totalPairs = 75;
    await testUser.save();
    
    // Check and award rewards
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // Senior Supervisor reward should be awarded
    expect(testUser.system.awardedRewards).toContain('Senior Supervisor');
    
    // No cash reward for Senior Supervisor (it's a tour)
    expect(testUser.income.rewardIncome).toBe(0);
  });
  
  test('Third reward milestone (Manager) awarded at 175 pairs with cash reward', async () => {
    // Set user's total pairs to 175
    testUser.system.totalPairs = 175;
    await testUser.save();
    
    // Check and award rewards
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // Manager reward should be awarded
    expect(testUser.system.awardedRewards).toContain('Manager');
    
    // Cash reward for Manager (40000)
    const managerReward = REWARD_MILESTONES.find(m => m.name === 'Manager').reward;
    expect(testUser.income.rewardIncome).toBe(managerReward);
    expect(testUser.income.walletBalance).toBe(managerReward);
  });
  
  test('Multiple rewards not awarded twice', async () => {
    // Set user's total pairs to 425 (Executive Manager milestone)
    testUser.system.totalPairs = 425;
    await testUser.save();
    
    // Check and award rewards
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // Executive Manager reward should be awarded
    expect(testUser.system.awardedRewards).toContain('Executive Manager');
    
    // Previous rewards should still be there
    expect(testUser.system.awardedRewards).toContain('Supervisor');
    expect(testUser.system.awardedRewards).toContain('Senior Supervisor');
    expect(testUser.system.awardedRewards).toContain('Manager');
    
    // No additional cash reward for Executive Manager (it's a tour)
    expect(testUser.income.rewardIncome).toBe(REWARD_MILESTONES.find(m => m.name === 'Manager').reward);
    
    // Process rewards again
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // No duplicate rewards should be added
    expect(testUser.system.awardedRewards.filter(r => r === 'Executive Manager').length).toBe(1);
  });
  
  test('Higher reward milestone (Eagle) awarded at 925 pairs with cash reward', async () => {
    // Set user's total pairs to 925
    testUser.system.totalPairs = 925;
    await testUser.save();
    
    // Check and award rewards
    await referralService.checkAndAwardRewards(testUser);
    
    // Refresh user data
    testUser = await User.findById(testUser._id);
    
    // Eagle reward should be awarded
    expect(testUser.system.awardedRewards).toContain('Eagle');
    
    // Cash reward for Eagle (180000) should be added to previous reward
    const managerReward = REWARD_MILESTONES.find(m => m.name === 'Manager').reward;
    const eagleReward = REWARD_MILESTONES.find(m => m.name === 'Eagle').reward;
    expect(testUser.income.rewardIncome).toBe(managerReward + eagleReward);
    expect(testUser.income.walletBalance).toBe(managerReward + eagleReward);
  });
});