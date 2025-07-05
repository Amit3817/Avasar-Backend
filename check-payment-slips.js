import mongoose from 'mongoose';
import PaymentSlip from './models/PaymentSlip.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkPaymentSlips() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const paymentSlips = await PaymentSlip.find({}).populate('user', 'fullName email');
    
    console.log(`Found ${paymentSlips.length} payment slips in database:`);
    
    if (paymentSlips.length === 0) {
      console.log('No payment slips found in database.');
      return;
    }
    
    paymentSlips.forEach((slip, index) => {
      console.log(`\n${index + 1}. Payment Slip ID: ${slip._id}`);
      console.log(`   User: ${slip.user?.fullName || 'Unknown'} (${slip.user?.email || 'No email'})`);
      console.log(`   Amount: ₹${slip.amount}`);
      console.log(`   Status: ${slip.status}`);
      console.log(`   Method: ${slip.method}`);
      console.log(`   Uploaded: ${slip.uploadedAt}`);
      console.log(`   Transaction ID: ${slip.transactionId || 'N/A'}`);
    });
    
    // Check by status
    const pendingSlips = paymentSlips.filter(slip => slip.status === 'pending');
    const approvedSlips = paymentSlips.filter(slip => slip.status === 'approved');
    const rejectedSlips = paymentSlips.filter(slip => slip.status === 'rejected');
    
    console.log(`\nSummary:`);
    console.log(`- Pending: ${pendingSlips.length}`);
    console.log(`- Approved: ${approvedSlips.length}`);
    console.log(`- Rejected: ${rejectedSlips.length}`);
    
  } catch (error) {
    console.error('Error checking payment slips:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkPaymentSlips(); 