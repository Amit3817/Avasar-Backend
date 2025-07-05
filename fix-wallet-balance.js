import mongoose from 'mongoose';
import User from './models/User.js';
import Withdrawal from './models/Withdrawal.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixWalletBalances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({});
    for (const user of users) {
      // Get all approved withdrawals for this user
      const withdrawals = await Withdrawal.find({ user: user._id, status: 'approved' });
      const totalWithdrawn = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
      const originalBalance = user.walletBalance || 0;
      const correctedBalance = Math.max(0, originalBalance - totalWithdrawn);
      if (originalBalance !== correctedBalance) {
        await User.findByIdAndUpdate(user._id, { walletBalance: correctedBalance });
        console.log(`Fixed walletBalance for ${user.email}: ${originalBalance} -> ${correctedBalance}`);
      }
    }
    console.log('✅ Wallet balances fixed for all users');
  } catch (error) {
    console.error('Error fixing wallet balances:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixWalletBalances(); 