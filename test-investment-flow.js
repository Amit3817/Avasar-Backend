import mongoose from 'mongoose';
import User from './models/User.js';
import PaymentSlip from './models/PaymentSlip.js';
import investmentService from './services/investmentService.js';
import referralService from './services/referralService.js';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'https://avasar-backend.onrender.com/api';

async function testInvestmentFlow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a test user with an approved payment slip
    const testSlip = await PaymentSlip.findOne({ 
      status: 'approved', 
      amount: { $gte: 10000 } 
    }).populate('user');

    if (!testSlip) {
      console.log('❌ No approved investment payment slip found for testing');
      return;
    }

    console.log(`\n🔍 Testing with payment slip:`);
    console.log(`- ID: ${testSlip._id}`);
    console.log(`- User: ${testSlip.user.fullName} (${testSlip.user.email})`);
    console.log(`- Amount: ₹${testSlip.amount}`);
    console.log(`- Status: ${testSlip.status}`);

    // Get user data before
    const userBefore = await User.findById(testSlip.user._id);
    console.log(`\n📊 User income BEFORE:`);
    console.log(`- referralIncome: ₹${userBefore.referralIncome || 0}`);
    console.log(`- matchingIncome: ₹${userBefore.matchingIncome || 0}`);
    console.log(`- rewardIncome: ₹${userBefore.rewardIncome || 0}`);
    console.log(`- investmentIncome: ₹${userBefore.investmentIncome || 0}`);
    console.log(`- investmentReferralIncome: ₹${userBefore.investmentReferralIncome || 0}`);
    console.log(`- investmentReferralPrincipalIncome: ₹${userBefore.investmentReferralPrincipalIncome || 0}`);
    console.log(`- investmentReferralReturnIncome: ₹${userBefore.investmentReferralReturnIncome || 0}`);
    console.log(`- walletBalance: ₹${userBefore.walletBalance || 0}`);

    // Test investment approval
    console.log(`\n🔄 Testing investment approval...`);
    try {
      const result = await investmentService.approveInvestment(testSlip._id);
      console.log('✅ Investment approval successful');
    } catch (error) {
      console.log('❌ Investment approval failed:', error.message);
      return;
    }

    // Get user data after
    const userAfter = await User.findById(testSlip.user._id);
    console.log(`\n📊 User income AFTER:`);
    console.log(`- referralIncome: ₹${userAfter.referralIncome || 0}`);
    console.log(`- matchingIncome: ₹${userAfter.matchingIncome || 0}`);
    console.log(`- rewardIncome: ₹${userAfter.rewardIncome || 0}`);
    console.log(`- investmentIncome: ₹${userAfter.investmentIncome || 0}`);
    console.log(`- investmentReferralIncome: ₹${userAfter.investmentReferralIncome || 0}`);
    console.log(`- investmentReferralPrincipalIncome: ₹${userAfter.investmentReferralPrincipalIncome || 0}`);
    console.log(`- investmentReferralReturnIncome: ₹${userAfter.investmentReferralReturnIncome || 0}`);
    console.log(`- walletBalance: ₹${userAfter.walletBalance || 0}`);

    // Calculate total earnings (frontend way)
    const totalEarningsBefore = 
      (userBefore.referralIncome || 0) +
      (userBefore.matchingIncome || 0) +
      (userBefore.rewardIncome || 0) +
      (userBefore.investmentIncome || 0) +
      (userBefore.investmentReferralIncome || 0) +
      (userBefore.investmentReferralPrincipalIncome || 0) +
      (userBefore.investmentReferralReturnIncome || 0);

    const totalEarningsAfter = 
      (userAfter.referralIncome || 0) +
      (userAfter.matchingIncome || 0) +
      (userAfter.rewardIncome || 0) +
      (userAfter.investmentIncome || 0) +
      (userAfter.investmentReferralIncome || 0) +
      (userAfter.investmentReferralPrincipalIncome || 0) +
      (userAfter.investmentReferralReturnIncome || 0);

    console.log(`\n💰 Total Earnings (Frontend calculation):`);
    console.log(`- BEFORE: ₹${totalEarningsBefore}`);
    console.log(`- AFTER: ₹${totalEarningsAfter}`);
    console.log(`- DIFFERENCE: ₹${totalEarningsAfter - totalEarningsBefore}`);

    // Check if upline users got bonuses
    const uplineUsers = await User.find({ 
      $or: [
        { investmentReferralIncome: { $gt: 0 } },
        { investmentReferralPrincipalIncome: { $gt: 0 } }
      ]
    }).select('fullName email investmentReferralIncome investmentReferralPrincipalIncome');

    console.log(`\n👥 Upline users with investment bonuses:`);
    if (uplineUsers.length > 0) {
      uplineUsers.forEach(user => {
        console.log(`- ${user.fullName} (${user.email}):`);
        console.log(`  * investmentReferralIncome: ₹${user.investmentReferralIncome || 0}`);
        console.log(`  * investmentReferralPrincipalIncome: ₹${user.investmentReferralPrincipalIncome || 0}`);
      });
    } else {
      console.log('❌ No upline users found with investment bonuses');
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testInvestmentFlow(); 