import mongoose from 'mongoose';

// Response subdocument schema
const ResponseSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  respondedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  respondedAt: {
    type: Date,
    default: Date.now
  },
  isAdminResponse: {
    type: Boolean,
    default: true
  },
  isInternal: {
    type: Boolean,
    default: false // false = sent to customer, true = internal admin note
  }
}, {
  _id: true,
  timestamps: false
});

const ContactMessageSchema = new mongoose.Schema({
  // Ticket ID
  ticketId: {
    type: String,
    unique: true,
    default: function() {
      return 'TKT' + Date.now().toString(36).toUpperCase();
    }
  },
  
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
    maxlength: 200
  },
  status: {
    type: String,
    enum: ['open', 'pending', 'resolved', 'closed'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['technical', 'billing', 'general', 'feature-request'],
    default: 'general'
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  
  // Replace single response with response history
  responses: [ResponseSchema], // <-- NEW: Array of responses
  
  adminNotes: {
    type: String,
    default: ''
  },
  userNotes: {
    type: String,
    default: ''
  },
  
  // Keep these for backward compatibility and quick access
  lastResponseDate: Date,
  lastResponseBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  lastViewedAt: Date,
  lastViewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for better performance
ContactMessageSchema.index({ ticketId: 1 });
ContactMessageSchema.index({ email: 1, status: 1 });
ContactMessageSchema.index({ user: 1, status: 1 });
ContactMessageSchema.index({ status: 1, priority: 1 });
ContactMessageSchema.index({ createdAt: -1 });
ContactMessageSchema.index({ lastResponseBy: 1 });
ContactMessageSchema.index({ 'responses.respondedBy': 1 });

export default mongoose.model('ContactMessage', ContactMessageSchema);