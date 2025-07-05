import mongoose from 'mongoose';
import User from './models/User.js';
import Investment from './models/Investment.js';
import PaymentSlip from './models/PaymentSlip.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixInvestmentData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check users with approved investment payment slips but no totalInvestment
    const investmentSlips = await PaymentSlip.find({
      status: 'approved',
      amount: { $gte: 10000 }
    }).populate('user');

    console.log(`Found ${investmentSlips.length} approved investment payment slips`);

    for (const slip of investmentSlips) {
      const user = slip.user;
      if (!user) {
        console.log(`No user found for slip ${slip._id}`);
        continue;
      }

      console.log(`\nProcessing user: ${user.email} (${user._id})`);
      console.log(`Payment slip amount: ₹${slip.amount}`);
      console.log(`Current totalInvestment: ${user.totalInvestment || 0}`);

      // Check if user has totalInvestment set
      if (!user.totalInvestment || user.totalInvestment === 0) {
        console.log(`❌ User has no totalInvestment, fixing...`);
        
        // Update user's totalInvestment
        await User.findByIdAndUpdate(user._id, {
          totalInvestment: Number(slip.amount),
          investmentStartDate: slip.verifiedAt || slip.createdAt,
          investmentEndDate: new Date((slip.verifiedAt || slip.createdAt).getTime() + (24 * 30 * 24 * 60 * 60 * 1000)) // 24 months
        });

        // Check if investment record exists
        const existingInvestment = await Investment.findOne({ user: user._id });
        if (!existingInvestment) {
          console.log(`Creating investment record...`);
          await Investment.create({
            user: user._id,
            amount: Number(slip.amount),
            startDate: slip.verifiedAt || slip.createdAt,
            endDate: new Date((slip.verifiedAt || slip.createdAt).getTime() + (24 * 30 * 24 * 60 * 60 * 1000)),
            monthsPaid: 0,
            active: true,
            isLocked: true,
            withdrawalRestriction: Number(slip.amount)
          });
        } else {
          console.log(`Investment record already exists, updating...`);
          existingInvestment.amount = Math.max(existingInvestment.amount, Number(slip.amount));
          await existingInvestment.save();
        }

        console.log(`✅ Fixed totalInvestment for user ${user.email}`);
      } else {
        console.log(`✅ User already has totalInvestment: ₹${user.totalInvestment}`);
      }
    }

    // Check final state
    const usersWithInvestments = await User.find({ totalInvestment: { $gt: 0 } });
    console.log(`\n📊 Final state: ${usersWithInvestments.length} users have totalInvestment > 0`);
    
    for (const user of usersWithInvestments) {
      console.log(`- ${user.email}: ₹${user.totalInvestment}`);
    }

    console.log('\n✅ Investment data fix completed');
  } catch (error) {
    console.error('Error fixing investment data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixInvestmentData(); 