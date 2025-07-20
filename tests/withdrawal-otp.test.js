import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

describe('Withdrawal OTP Tests', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create a test user
    testUser = await User.create({
      avasarId: 'AV000001',
      profile: {
        fullName: 'Test User',
        phone: '1234567890'
      },
      auth: {
        email: 'test@example.com',
        password: 'hashedPassword',
        isVerified: true
      },
      referral: {
        referralCode: 'TEST1234'
      },
      income: {
        walletBalance: 1000
      }
    });

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'hashedPassword'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await User.deleteOne({ _id: testUser._id });
    await mongoose.connection.close();
  });

  describe('POST /api/auth/send-withdrawal-otp', () => {
    it('should send withdrawal OTP successfully', async () => {
      const response = await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Withdrawal OTP sent');
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No user found');
    });
  });

  describe('POST /api/auth/verify-withdrawal-otp', () => {
    it('should verify withdrawal OTP successfully', async () => {
      // First send OTP
      await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      // Get the OTP from database
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      const otp = user.auth.withdrawalOtp;

      const response = await request(app)
        .post('/api/auth/verify-withdrawal-otp')
        .send({
          email: 'test@example.com',
          otp: otp
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Withdrawal OTP verified');
    });

    it('should return error for invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-withdrawal-otp')
        .send({
          email: 'test@example.com',
          otp: '000000'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });
  });

  describe('POST /api/withdrawal', () => {
    it('should require withdrawal OTP', async () => {
      const response = await request(app)
        .post('/api/withdrawal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          bankAccount: {
            accountHolder: 'Test User',
            accountNumber: '1234567890',
            ifsc: 'SBIN0001234',
            bankName: 'State Bank of India'
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Withdrawal OTP is required');
    });

    it('should process withdrawal with valid OTP', async () => {
      // First send OTP
      await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      // Get the OTP from database
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      const otp = user.auth.withdrawalOtp;

      const response = await request(app)
        .post('/api/withdrawal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          bankAccount: {
            accountHolder: 'Test User',
            accountNumber: '1234567890',
            ifsc: 'SBIN0001234',
            bankName: 'State Bank of India'
          },
          withdrawalOtp: otp
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Withdrawal request submitted');
    });
  });
}); 