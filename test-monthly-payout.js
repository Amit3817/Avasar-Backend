import mongoose from 'mongoose';
import investmentService from './services/investmentService.js';
import User from './models/User.js';
import Investment from './models/Investment.js';
import dotenv from 'dotenv';

dotenv.config();

async function testMonthlyPayout() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get users with investments before payout
    const usersBefore = await User.find({ totalInvestment: { $gt: 0 } }).select('fullName email investmentIncome totalInvestment');
    console.log('\n📊 Users with investments BEFORE monthly payout:');
    usersBefore.forEach(user => {
      console.log(`- ${user.fullName} (${user.email}):`);
      console.log(`  * Total Investment: ₹${user.totalInvestment}`);
      console.log(`  * Current Investment Income: ₹${user.investmentIncome || 0}`);
    });

    // Get active investments
    const activeInvestments = await Investment.find({ active: true }).populate('user', 'fullName email');
    console.log(`\n🔍 Found ${activeInvestments.length} active investments`);

    if (activeInvestments.length === 0) {
      console.log('❌ No active investments found');
      return;
    }

    // Trigger monthly payout
    console.log('\n🔄 Triggering monthly payout...');
    const processed = await investmentService.processMonthlyPayouts();
    console.log(`✅ Monthly payout processed: ${processed} investments`);

    // Get users after payout
    const usersAfter = await User.find({ totalInvestment: { $gt: 0 } }).select('fullName email investmentIncome totalInvestment');
    console.log('\n📊 Users with investments AFTER monthly payout:');
    usersAfter.forEach(user => {
      console.log(`- ${user.fullName} (${user.email}):`);
      console.log(`  * Total Investment: ₹${user.totalInvestment}`);
      console.log(`  * Current Investment Income: ₹${user.investmentIncome || 0}`);
    });

    // Calculate total investment income
    const totalInvestmentIncome = usersAfter.reduce((sum, user) => sum + (user.investmentIncome || 0), 0);
    console.log(`\n💰 Total Investment Income across platform: ₹${totalInvestmentIncome.toLocaleString()}`);

    console.log('\n✅ Monthly payout test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testMonthlyPayout(); 