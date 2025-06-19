const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'read', 'replied'],
    default: 'pending'
  },
  source: {
    type: String,
    enum: ['website', 'user_panel'],
    default: 'website'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema); 