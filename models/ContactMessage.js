import mongoose from 'mongoose';

const ContactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    match: /.+@.+\..+/
  },
  message: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 1000
  },  
  subject: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'resolved', 'closed'],
    default: 'open'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // If the user is logged in, can be linked
  },
  adminNotes: {
    type: String,
    default: ''
  },
  userNotes: {
    type: String,
    default: ''
  },
  response: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

export default mongoose.model('ContactMessage', ContactMessageSchema); 