const jwt = require('jsonwebtoken');
const User = require('../models/User');
const nodemailer = require('nodemailer');
const Otp = require('../models/Otp');


exports.registerUser = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, phone, sponsorId } = req.body;
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }
    // If sponsorId is provided, validate it
    let sponsor = null;
    if (sponsorId) {
      sponsor = await User.findOne({ $or: [{ referralCode: sponsorId }, { username: sponsorId }] });
      if (!sponsor) {
        return res.status(400).json({ message: 'Invalid sponsor ID or referral code' });
      }
    }
    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
      phone,
      sponsorId: sponsor ? sponsor._id : null
    });
    await user.save();
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        rank: user.rank,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    // Check if account is active
    if (!user.isActive) {
      return res.status(400).json({ message: 'Account is deactivated' });
    }
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        rank: user.rank,
        referralCode: user.referralCode
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getReferral = async (req, res) => {
  try {
    const { referralCode } = req.params;
    const user = await User.findOne({ referralCode }).select('firstName lastName username');
    if (!user) {
      return res.status(404).json({ message: 'Referral code not found' });
    }
    res.json({
      sponsor: {
        name: `${user.firstName} ${user.lastName}`,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Get referral error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry
    // Remove any existing OTPs for this email
    await Otp.deleteMany({ email });
    // Save OTP to DB
    await Otp.create({ email, otp, expiresAt });
    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is: ${otp}`
    });
    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
    const record = await Otp.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    if (Date.now() > record.expiresAt.getTime()) {
      await Otp.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'OTP expired' });
    }
    await Otp.deleteOne({ _id: record._id });
    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ message: 'Email and new password are required' });
    // For demo, allow reset if OTP was verified (in production, use a more secure method)
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ available: false, message: 'Username is required' });
    const user = await User.findOne({ username });
    if (user) {
      return res.json({ available: false, message: 'Username already taken' });
    }
    res.json({ available: true, message: 'Username is available' });
  } catch (error) {
    res.status(500).json({ available: false, message: 'Server error' });
  }
}; 