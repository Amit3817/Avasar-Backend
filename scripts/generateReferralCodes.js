const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Generate unique referral code
const generateReferralCode = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate unique referral code that doesn't exist
const generateUniqueReferralCode = async () => {
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = await generateReferralCode();
    const existingUser = await User.findOne({ referralCode: code });
    if (!existingUser) {
      isUnique = true;
    }
  }
  
  return code;
};

// Update users without referral codes
const updateUsersWithReferralCodes = async () => {
  try {
    // Find all users without referral codes
    const usersWithoutCodes = await User.find({ referralCode: { $exists: false } });
    
    console.log(`Found ${usersWithoutCodes.length} users without referral codes`);
    
    for (const user of usersWithoutCodes) {
      const referralCode = await generateUniqueReferralCode();
      user.referralCode = referralCode;
      await user.save();
      console.log(`Generated referral code ${referralCode} for user ${user.username}`);
    }
    
    console.log('Successfully updated all users with referral codes');
  } catch (error) {
    console.error('Error updating users:', error);
  }
};

// Run the script
updateUsersWithReferralCodes()
  .then(() => {
    console.log('Script completed successfully');
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Script failed:', err);
    mongoose.connection.close();
  }); 