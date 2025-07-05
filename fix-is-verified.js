import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixIsVerified() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users who are not admins, have a password, and are not marked as isVerified
    const users = await User.find({ isAdmin: { $ne: true }, password: { $exists: true, $ne: null }, isVerified: { $ne: true } });
    for (const user of users) {
      await User.findByIdAndUpdate(user._id, { isVerified: true });
      console.log(`Marked user as verified: ${user.email}`);
    }
    console.log('✅ isVerified fixed for all users');
  } catch (error) {
    console.error('Error fixing isVerified:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

fixIsVerified(); 