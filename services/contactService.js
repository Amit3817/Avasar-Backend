import ContactMessage from '../models/ContactMessage.js';

const contactService = {
  async createMessage({ name, email, message, user }) {
    // If user is a User object, extract its _id
    let userId = user;
    if (user && typeof user === 'object' && user._id) userId = user._id;
    const doc = { name, email, message,subject };
    if (userId) doc.user = userId;
    const contactMessage = await ContactMessage.create(doc);
    return contactMessage;
  },
  async getMessagesByUser(userId, email) {
    // Fetch messages linked to user or (if not found) by email (for legacy/guest messages)
    const query = [];
    if (userId) query.push({ user: userId });
    if (email) query.push({ user: null, email });
    if (query.length === 0) return [];
    return ContactMessage.find({ $or: query }).populate('user', 'avasarId profile auth').sort({ createdAt: -1 });
  },
  async getUserMessageById(userId, email, id) {
    // Fetch message by id, linked to user or (if not found) by email
    const query = [];
    if (userId) query.push({ _id: id, user: userId });
    if (email) query.push({ _id: id, user: null, email });
    if (query.length === 0) return null;
    return ContactMessage.findOne({ $or: query }).populate('user', 'avasarId profile auth');
  },
  async getAllMessages(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.email) filter.email = query.email;
    // Add more filters as needed
    return ContactMessage.find(filter).sort({ createdAt: -1 });
  },
  async getMessageById(id) {
    return ContactMessage.findById(id);
  },
  async updateMessage(id, update) {
    // If update.$push exists, use $push, else $set
    if (update.$push) {
      return ContactMessage.findByIdAndUpdate(id, { $set: update, $push: update.$push }, { new: true });
    } else {
      return ContactMessage.findByIdAndUpdate(id, { $set: update }, { new: true });
    }
  }
};

export default contactService; 