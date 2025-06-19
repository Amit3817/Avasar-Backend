const express = require('express');
const User = require('../models/User');
const Contact = require('../models/Contact');
const { adminAuth } = require('../middleware/auth');
const { 
  getAllUsers,
  getAllContacts
} = require('../controllers/adminController');

const router = express.Router();

// Get all users (admin only)
router.get('/users', adminAuth, getAllUsers);

// Get user by ID (admin only)
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('sponsorId', 'username firstName lastName')
      .populate('upline', 'username firstName lastName rank')
      .populate('downline', 'username firstName lastName rank joinedAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (admin only)
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, phone, rank, isActive, isVerified } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, phone, rank, isActive, isVerified },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics (admin only)
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const totalInvestment = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$investment.amount' } } }
    ]);

    const rankDistribution = await User.aggregate([
      { $group: { _id: '$rank', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const recentUsers = await User.find()
      .select('username firstName lastName rank joinedAt')
      .sort({ joinedAt: -1 })
      .limit(5);

    const totalIncome = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$income.total' } } }
    ]);

    res.json({
      totalUsers,
      activeUsers,
      verifiedUsers,
      totalInvestment: totalInvestment[0]?.total || 0,
      totalIncome: totalIncome[0]?.total || 0,
      rankDistribution,
      recentUsers
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all contacts (admin only)
router.get('/contacts', adminAuth, getAllContacts);

// Update contact status (admin only)
router.put('/contacts/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 