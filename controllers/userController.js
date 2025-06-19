const User = require('../models/User');
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('sponsorId', 'username firstName lastName')
      .populate('upline', 'username firstName lastName rank')
      .populate('downline', 'username firstName lastName rank joinedAt');
    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName, lastName, phone },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTeam = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'downline',
        select: 'username firstName lastName rank joinedAt investment',
        populate: {
          path: 'downline',
          select: 'username firstName lastName rank joinedAt investment'
        }
      });
    res.json({
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        rank: user.rank
      },
      team: user.downline
    });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getIncome = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('income investment');
    const totalIncome = user.calculateTotalIncome();
    res.json({
      income: user.income,
      investment: user.investment,
      totalIncome
    });
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRank = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('rank downline');
    const rankRequirements = {
      'Supervisor': { pairs: 25, reward: 'Nil' },
      'Senior Supervisor': { pairs: 50, reward: 'Goa Tour' },
      'Manager': { pairs: 100, reward: '₹40,000' },
      'Executive Manager': { pairs: 250, reward: 'Thailand Tour' },
      'Eagle': { pairs: 500, reward: '₹1.80 Lakh' },
      'Eagle Executive': { pairs: 1000, reward: '₹4 Lakh' },
      'Silver': { pairs: 2500, reward: '₹8 Lakh' },
      'Gold': { pairs: 5000, reward: '₹15 Lakh' },
      'Pearl': { pairs: 10000, reward: '₹30 Lakh' },
      'Diamond': { pairs: 25000, reward: '₹50 Lakh' },
      'Ambassador': { pairs: 50000, reward: '₹75 Lakh' },
      'King': { pairs: 100000, reward: '₹1.25 Cr' },
      'Universal King': { pairs: 250000, reward: '₹2.25 Cr' }
    };
    const currentRank = rankRequirements[user.rank];
    const nextRank = Object.entries(rankRequirements).find(([rankName]) => 
      rankName !== user.rank && rankRequirements[rankName].pairs > currentRank.pairs
    );
    res.json({
      currentRank: user.rank,
      currentRankDetails: currentRank,
      nextRank: nextRank ? {
        name: nextRank[0],
        requirements: nextRank[1]
      } : null,
      teamSize: user.downline.length
    });
  } catch (error) {
    console.error('Get rank error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSponsor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('sponsorId', 'username firstName lastName rank phone email');
    res.json(user.sponsorId);
  } catch (error) {
    console.error('Get sponsor error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const imageUrl = req.file.path;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePhoto: imageUrl },
      { new: true }
    ).select('-password');
    res.json({ photoUrl: imageUrl, user });
  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 