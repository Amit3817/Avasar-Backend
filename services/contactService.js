import ContactMessage from '../models/ContactMessage.js';
import mongoose from 'mongoose';

class ContactService {
  /**
   * Create a new message
   */
  async createMessage(data) {
    try {
      const message = await ContactMessage.create({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        user: data.user || null,
        status: data.status || 'open',
        priority: data.priority || 'medium',
        category: data.category || 'general',
        adminNotes: '',
        userNotes: '',
        response: ''
      });

      return message;
    } catch (error) {
      throw new CustomError('Failed to create message', 500, error.message);
    }
  }

  /**
   * Get messages by user with pagination
   */
  async getMessagesByUserWithPagination(query, options) {
    try {
      const { skip = 0, limit = 10, sort = { createdAt: -1 } } = options;

      const messages = await ContactMessage.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      return messages;
    } catch (error) {
      throw new CustomError('Failed to fetch user messages', 500, error.message);
    }
  }

  /**
   * Get total count of messages
   */
  async getMessagesCount(query) {
    try {
      const count = await ContactMessage.countDocuments(query);
      return count;
    } catch (error) {
      throw new CustomError('Failed to count messages', 500, error.message);
    }
  }

  /**
   * Get user message by ID
   */
  async getUserMessageById(userId, messageId) {
    try {
      const message = await ContactMessage.findOne({
        _id: messageId,
        $or: [
          { user: userId },
          { email: { $exists: true } }
        ]
      }).lean();

      return message;
    } catch (error) {
      if (error.name === 'CastError') {
        throw new CustomError('Invalid message ID', 400);
      }
      throw new CustomError('Failed to fetch message', 500, error.message);
    }
  }

  /**
 * Get message by ID with populated responses
 */
async getMessageById(messageId) {
  try {
    const message = await ContactMessage.findById(messageId)
      .populate('user', 'name email avatar')
      .populate('responses.respondedBy', 'name email avatar role') // <-- Populate response authors
      .populate('lastResponseBy', 'name email avatar')
      .populate('lastViewedBy', 'name email avatar')
      .lean();

    return message;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new CustomError('Invalid message ID', 400);
    }
    throw new CustomError('Failed to fetch message', 500, error.message);
  }
}

/**
 * Update message with response handling
 */
async updateMessage(messageId, updates) {
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      messageId,
      updates,
      { 
        new: true, 
        runValidators: true 
      }
    )
    .populate('user', 'name email avatar')
    .populate('responses.respondedBy', 'name email avatar role')
    .populate('lastResponseBy', 'name email avatar')
    .populate('lastViewedBy', 'name email avatar');

    return message;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new CustomError('Invalid message ID', 400);
    }
    throw new CustomError('Failed to update message', 500, error.message);
  }
}

/**
 * Get user message by ID with full response population
 */
async getUserMessageById(userId, messageId) {
  try {
    const message = await ContactMessage.findOne({
      _id: messageId,
      $or: [
        { user: userId },
        { email: { $exists: true } } // Allow access by email match if needed
      ]
    })
    .populate('user', 'name email avatar')
    .populate('responses.respondedBy', 'name email avatar role') // <-- ADD THIS
    .populate('lastResponseBy', 'name email avatar')
    .populate('lastViewedBy', 'name email avatar')
    .lean();

    return message;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new CustomError('Invalid message ID', 400);
    }
    throw new CustomError('Failed to fetch message', 500, error.message);
  }
}

/**
 * Get messages by user with pagination - include response info
 */
async getMessagesByUserWithPagination(query, options) {
  try {
    const { skip = 0, limit = 10, sort = { createdAt: -1 } } = options;

    const messages = await ContactMessage.find(query)
      .populate('user', 'name email avatar')
      .populate('responses.respondedBy', 'name email avatar role') // <-- ADD THIS
      .populate('lastResponseBy', 'name email avatar')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    return messages;
  } catch (error) {
    throw new CustomError('Failed to fetch user messages', 500, error.message);
  }
}

  /**
   * Get all messages with pagination (admin)
   */
  async getAllMessagesWithPagination(query, options) {
    try {
      const { 
        skip = 0, 
        limit = 10, 
        sort = { createdAt: -1 },
        populate = ''
      } = options;

      let queryBuilder = ContactMessage.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      if (populate) {
        queryBuilder = queryBuilder.populate(populate, 'name email avatar');
      }

      const messages = await queryBuilder.lean();

      return messages;
    } catch (error) {
      throw new CustomError('Failed to fetch messages', 500, error.message);
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId) {
    try {
      const message = await ContactMessage.findById(messageId)
        .populate('user', 'name email avatar')
        .lean();

      return message;
    } catch (error) {
      if (error.name === 'CastError') {
        throw new CustomError('Invalid message ID', 400);
      }
      throw new CustomError('Failed to fetch message', 500, error.message);
    }
  }

  /**
   * Update message
   */
  async updateMessage(messageId, updates) {
    try {
      const message = await ContactMessage.findByIdAndUpdate(
        messageId,
        updates,
        { 
          new: true, 
          runValidators: true 
        }
      );

      return message;
    } catch (error) {
      if (error.name === 'CastError') {
        throw new CustomError('Invalid message ID', 400);
      }
      throw new CustomError('Failed to update message', 500, error.message);
    }
  }

  /**
   * Update message view tracking
   */
  async updateMessageView(messageId, userId) {
    try {
      await ContactMessage.findByIdAndUpdate(
        messageId,
        {
          lastViewedAt: new Date(),
          lastViewedBy: userId
        }
      );
    } catch (error) {
      // Silent fail for view tracking
      console.error('Failed to update message view:', error);
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats(userId = null) {
    try {
      const baseQuery = userId ? { user: userId } : {};

      const [
        totalMessages,
        openMessages,
        pendingMessages,
        resolvedMessages,
        closedMessages,
        todayMessages,
        thisWeekMessages,
        thisMonthMessages,
        priorityStats
      ] = await Promise.all([
        // Total messages
        ContactMessage.countDocuments(baseQuery),
        
        // Open messages
        ContactMessage.countDocuments({ ...baseQuery, status: 'open' }),
        
        // Pending messages
        ContactMessage.countDocuments({ ...baseQuery, status: 'pending' }),
        
        // Resolved messages
        ContactMessage.countDocuments({ ...baseQuery, status: 'resolved' }),
        
        // Closed messages
        ContactMessage.countDocuments({ ...baseQuery, status: 'closed' }),
        
        // Today's messages
        ContactMessage.countDocuments({
          ...baseQuery,
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }),
        
        // This week's messages
        ContactMessage.countDocuments({
          ...baseQuery,
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }),
        
        // This month's messages
        ContactMessage.countDocuments({
          ...baseQuery,
          createdAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }),
        
        // Priority distribution
        ContactMessage.aggregate([
          { $match: baseQuery },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ])
      ]);

      // Calculate response rate
      const respondedMessages = await ContactMessage.countDocuments({
        ...baseQuery,
        response: { $exists: true, $ne: '' }
      });
      
      const responseRate = totalMessages > 0 
        ? ((respondedMessages / totalMessages) * 100).toFixed(2)
        : 0;

      // Format priority stats
      const priorityDistribution = {
        low: 0,
        medium: 0,
        high: 0,
        urgent: 0
      };
      
      priorityStats.forEach(stat => {
        if (stat._id && priorityDistribution.hasOwnProperty(stat._id)) {
          priorityDistribution[stat._id] = stat.count;
        }
      });

      return {
        total: totalMessages,
        byStatus: {
          open: openMessages,
          pending: pendingMessages,
          resolved: resolvedMessages,
          closed: closedMessages
        },
        byTime: {
          today: todayMessages,
          thisWeek: thisWeekMessages,
          thisMonth: thisMonthMessages
        },
        byPriority: priorityDistribution,
        responseRate: `${responseRate}%`,
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new CustomError('Failed to get message statistics', 500, error.message);
    }
  }
}

export default new ContactService();