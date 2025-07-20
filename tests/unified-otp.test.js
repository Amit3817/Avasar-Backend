import request from 'supertest';
import app from '../app.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

describe('Unified OTP System Tests', () => {
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

  describe('Registration OTP', () => {
    it('should set OTP type to registration during user creation', async () => {
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      expect(user.auth.otpType).toBe('registration');
    });
  });

  describe('Password Reset OTP', () => {
    it('should send password reset OTP successfully', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Password reset OTP sent');
    });

    it('should set OTP type to password-reset', async () => {
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      expect(user.auth.otpType).toBe('password-reset');
    });

    it('should resend password reset OTP successfully', async () => {
      const response = await request(app)
        .post('/api/auth/resend-password-reset-otp')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('New password reset OTP sent');
    });

    it('should verify password reset OTP successfully', async () => {
      // Get the OTP from database
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      const otp = user.auth.otp;

      const response = await request(app)
        .post('/api/auth/verify-password-reset-otp')
        .send({
          email: 'test@example.com',
          otp: otp
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Password reset OTP verified');
    });

    it('should reset password with verified OTP', async () => {
      // First send new OTP
      await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'test@example.com'
        });

      // Get the OTP
      const user = await User.findOne({ 'auth.email': 'test@example.com' });
      const otp = user.auth.otp;

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: 'test@example.com',
          otp: otp,
          newPassword: 'newPassword123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Password reset successfully');
    });

    it('should return error for wrong OTP type', async () => {
      // Try to verify registration OTP when password reset OTP is expected
      const response = await request(app)
        .post('/api/auth/verify-password-reset-otp')
        .send({
          email: 'test@example.com',
          otp: '123456'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid OTP type');
    });
  });

  describe('Withdrawal OTP (Separate System)', () => {
    it('should send withdrawal OTP successfully', async () => {
      const response = await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Withdrawal OTP sent');
    });

    it('should verify withdrawal OTP successfully', async () => {
      // Get the withdrawal OTP from database
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

    it('should process withdrawal with valid OTP', async () => {
      // First send withdrawal OTP
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

  describe('OTP Type Validation', () => {
    it('should not allow registration OTP for password reset', async () => {
      // Create a user with registration OTP
      const newUser = await User.create({
        avasarId: 'AV000002',
        profile: { fullName: 'New User', phone: '9876543210' },
        auth: {
          email: 'newuser@example.com',
          password: 'hashedPassword',
          otp: '123456',
          otpExpires: new Date(Date.now() + 10 * 60 * 1000),
          otpType: 'registration'
        },
        referral: { referralCode: 'NEW1234' }
      });

      const response = await request(app)
        .post('/api/auth/verify-password-reset-otp')
        .send({
          email: 'newuser@example.com',
          otp: '123456'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid OTP type');

      await User.deleteOne({ _id: newUser._id });
    });

    it('should not allow password reset OTP for registration', async () => {
      // Create a user with password reset OTP
      const newUser = await User.create({
        avasarId: 'AV000003',
        profile: { fullName: 'Another User', phone: '5555555555' },
        auth: {
          email: 'another@example.com',
          password: 'hashedPassword',
          otp: '654321',
          otpExpires: new Date(Date.now() + 10 * 60 * 1000),
          otpType: 'password-reset'
        },
        referral: { referralCode: 'ANOTHER5' }
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: 'another@example.com',
          otp: '654321'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid OTP type');

      await User.deleteOne({ _id: newUser._id });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting for password reset OTP', async () => {
      // Send first OTP
      await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'test@example.com'
        });

      // Try to send another immediately
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Password reset OTP recently sent');
    });

    it('should enforce rate limiting for withdrawal OTP', async () => {
      // Send first withdrawal OTP
      await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      // Try to send another immediately
      const response = await request(app)
        .post('/api/auth/send-withdrawal-otp')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Withdrawal OTP recently sent');
    });
  });
}); 