// contactController.js
import { sendSuccess, sendError } from '../utils/responseHelpers.js';
import contactService from '../services/contactService.js';
import mongoose from 'mongoose';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, message, subject, priority, category } = req.body;
    let userId = null;
    if (req.user && req.user._id) {
      userId = req.user._id;
    }
    const contactMessage = await contactService.createMessage({
      name,
      email,
      message,
      subject,
      priority: priority || 'medium',
      category: category || 'general',
      user: userId || undefined,
      status: 'open'
    });
    sendSuccess(res, { 
      message: "Ticket submitted successfully! We'll get back to you within 24 hours.", 
      data: contactMessage 
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getUserMessages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      priority = 'all',
      category = 'all',
      sortBy = 'newest'
    } = req.query;

    // Build query object
    const query = {
      $or: [
        { user: req.user._id }
      ]
    };

    // Add email condition if user has email
    if (req.user.auth && req.user.auth.email) {
      query.$or.push({ email: req.user.auth.email });
    }

    // Add search conditions
    if (search) {
      const searchConditions = {
        $or: [
          { subject: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
          { ticketId: { $regex: search, $options: 'i' } }
        ]
      };
      
      // If search looks like an ObjectId, add _id search
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        searchConditions.$or.push({ _id: search });
      }
      
      // Combine search with existing query
      query.$and = query.$and || [];
      query.$and.push(searchConditions);
    }

    // Add status filter
    if (status !== 'all' && ['open', 'pending', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }

    // Add priority filter
    if (priority !== 'all' && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      query.priority = priority;
    }

    // Add category filter
    if (category !== 'all' && ['technical', 'billing', 'general', 'feature-request'].includes(category)) {
      query.category = category;
    }

    // Determine sort order
    let sortOrder = { createdAt: -1 };
    if (sortBy === 'oldest') {
      sortOrder = { createdAt: 1 };
    } else if (sortBy === 'priority') {
      sortOrder = { priority: 1, createdAt: -1 };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get messages with pagination
    const messages = await contactService.getMessagesByUserWithPagination(
      query,
      {
        skip,
        limit: parseInt(limit),
        sort: sortOrder
      }
    );

    // Get total count for pagination
    const totalCount = await contactService.getMessagesCount(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    sendSuccess(res, { 
      messages: messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getUserMessageDetail = async (req, res) => {
  try {
    const message = await contactService.getUserMessageById(req.user._id, req.params.id);
    if (!message) return sendError(res, 'Message not found', 404);
    
    // Mark as viewed
    await contactService.updateMessageView(req.params.id, req.user._id);
    
    sendSuccess(res, { message });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getAllMessages = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      priority = 'all',
      category = 'all',
      sortBy = 'newest',
      userId = ''
    } = req.query;

    // Build query object
    const query = {};

    // Add user filter if specified
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = userId;
    }

    // Add search conditions
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } }
      ];
    }

    // Add filters
    if (status !== 'all' && ['open', 'pending', 'resolved', 'closed'].includes(status)) {
      query.status = status;
    }
    if (priority !== 'all' && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      query.priority = priority;
    }
    if (category !== 'all' && ['technical', 'billing', 'general', 'feature-request'].includes(category)) {
      query.category = category;
    }

    // Determine sort order
    let sortOrder = { createdAt: -1 };
    if (sortBy === 'oldest') {
      sortOrder = { createdAt: 1 };
    } else if (sortBy === 'priority') {
      sortOrder = { priority: 1, createdAt: -1 };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get messages with pagination
    const messages = await contactService.getAllMessagesWithPagination(
      query,
      {
        skip,
        limit: parseInt(limit),
        sort: sortOrder,
        populate: 'user'
      }
    );

    // Get total count for pagination
    const totalCount = await contactService.getMessagesCount(query);
    const totalPages = Math.ceil(totalCount / parseInt(limit));

    sendSuccess(res, { 
      messages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getMessageDetail = async (req, res) => {
  try {
    const message = await contactService.getMessageById(req.params.id);
    if (!message) return sendError(res, 'Message not found', 404);
    sendSuccess(res, { message });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const adminReplyOrUpdate = async (req, res) => {
  try {
    const { status, response, priority, adminNotes, isInternal = false } = req.body;
    

    const update = {};
    
    if (status && ['open', 'pending', 'resolved', 'closed'].includes(status)) {
      update.status = status;
    }
    
    // Add new response to responses array
    if (typeof response === 'string' && response.trim()) {
      const newResponse = {
        message: response.trim(), // This should be the actual message text
        respondedBy: req.user._id,
        respondedAt: new Date(),
        isAdminResponse: true,
        isInternal: isInternal
      };
      
      
      // Push new response to array
      update.$push = { responses: newResponse };
      
      // Update last response tracking
      update.lastResponseDate = new Date();
      update.lastResponseBy = req.user._id;
      
      // If adding a customer-facing response, update status to pending if it's open
      if (!isInternal && !status) {
        const currentMessage = await contactService.getMessageById(req.params.id);
        if (currentMessage && currentMessage.status === 'open') {
          update.status = 'pending';
        }
      }
    }

    if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority)) {
      update.priority = priority;
    }

    if (typeof adminNotes === 'string') {
      update.adminNotes = adminNotes;
    }
    
    // Always track who last updated the ticket
    update.lastViewedBy = req.user._id;
    update.lastViewedAt = new Date();
    
    
    const updated = await contactService.updateMessage(req.params.id, update);
    if (!updated) return sendError(res, 'Message not found', 404);
    
    sendSuccess(res, { 
      message: 'Ticket updated successfully',
      data: updated 
    });
  } catch (error) {
    console.error('Error in adminReplyOrUpdate:', error);
    sendError(res, error.message, 500);
  }
};

// New function for users to add responses to their tickets
export const userAddResponse = async (req, res) => {
  try {
    const { response } = req.body;
    const ticketId = req.params.id;
    
    // Check if user owns this ticket
    const ticket = await contactService.getUserMessageById(req.user._id, ticketId);
    if (!ticket) {
      return sendError(res, 'Ticket not found or you do not have permission to access it', 404);
    }
    
    // Don't allow responses to closed tickets
    if (ticket.status === 'closed') {
      return sendError(res, 'Cannot add response to a closed ticket', 400);
    }
    
    const newResponse = {
      message: response.trim(),
      respondedBy: req.user._id,
      respondedAt: new Date(),
      isAdminResponse: false, // <-- User response
      isInternal: false // User responses are never internal
    };
    
    const update = {
      $push: { responses: newResponse },
      lastResponseDate: new Date(),
      lastResponseBy: req.user._id,
      lastViewedBy: req.user._id,
      lastViewedAt: new Date()
    };
    
    // If ticket was resolved, move it back to pending when user responds
    if (ticket.status === 'resolved') {
      update.status = 'pending';
    }
    
    const updated = await contactService.updateMessage(ticketId, update);
    if (!updated) return sendError(res, 'Failed to add response', 500);
    
    sendSuccess(res, { 
      message: 'Response added successfully',
      data: updated 
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// Updated getTicketResponses to work for both users and admins
export const getTicketResponses = async (req, res) => {
  try {
    let ticket;
    
    // Check if user is admin or ticket owner
    if (req.user.role === 'admin') {
      ticket = await contactService.getMessageById(req.params.id);
    } else {
      ticket = await contactService.getUserMessageById(req.user._id, req.params.id);
    }
    
    if (!ticket) return sendError(res, 'Ticket not found', 404);
    
    // Filter responses based on user role
    let responses = ticket.responses || [];
    if (req.user.role !== 'admin') {
      // Regular users only see non-internal responses
      responses = responses.filter(response => !response.isInternal);
    }
    
    sendSuccess(res, { responses });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// New endpoint to get response history


// Enhanced message statistics
export const getMessageStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const stats = await contactService.getMessageStats(userId);
    
    sendSuccess(res, { stats });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

// controllers/contactController.js - Simple Additional Functions

/**
 * Enhanced submit with basic validations (for unsigned users)
 */
export const submitContactWithValidation = async (req, res) => {
  try {
    const { name, email, message, subject } = req.body;
    
    // Basic validation
    if (!name || name.length < 2) {
      return sendError(res, 'Name must be at least 2 characters', 400);
    }
    if (!email || !email.includes('@')) {
      return sendError(res, 'Valid email is required', 400);
    }
    if (!message || message.length < 10) {
      return sendError(res, 'Message must be at least 10 characters', 400);
    }

    // Check rate limiting
    const rateLimit = await contactService.checkRateLimit(email);
    if (rateLimit.isLimited) {
      return sendError(res, `Too many submissions. Maximum ${rateLimit.maxAllowed} per hour.`, 429);
    }

    // Check for duplicates
    const isDuplicate = await contactService.checkDuplicate(email, message);
    if (isDuplicate) {
      return sendError(res, 'Similar message already submitted recently', 400);
    }

    // Auto-categorize
    const category = contactService.categorizeMessage(message, subject);
    
    // Check if returning user
    const hasHistory = await contactService.hasEmailHistory(email);
    const priority = hasHistory ? 'medium' : 'low';

    const contactMessage = await contactService.createMessage({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      message: message.trim(),
      subject: subject?.trim() || 'Unsigned Query',
      priority,
      category,
      status: 'open'
    });

    sendSuccess(res, { 
      message: "Message sent successfully! We'll respond within 24 hours.", 
      data: {
        ticketId: contactMessage.ticketId,
        status: contactMessage.status,
        category: contactMessage.category
      }
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

/**
 * Check contact status by ticket ID and email
 */
export const checkContactStatus = async (req, res) => {
  try {
    const { ticketId, email } = req.body;
    
    if (!ticketId || !email) {
      return sendError(res, 'Ticket ID and email are required', 400);
    }

    const contact = await contactService.getContactStatus(ticketId, email);
    
    if (!contact) {
      return sendError(res, 'Contact not found or email mismatch', 404);
    }

    sendSuccess(res, { 
      data: {
        ticketId: contact.ticketId,
        subject: contact.subject,
        status: contact.status,
        submittedAt: contact.createdAt,
        lastResponse: contact.lastResponseDate
      }
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

/**
 * Simple contact form validation endpoint
 */
export const validateContactForm = async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const errors = [];

    if (!name || name.length < 2) errors.push('Name required (min 2 chars)');
    if (!email || !email.includes('@')) errors.push('Valid email required');
    if (!message || message.length < 10) errors.push('Message required (min 10 chars)');

    if (email) {
      const rateLimit = await contactService.checkRateLimit(email);
      if (rateLimit.isLimited) {
        errors.push(`Rate limit exceeded: ${rateLimit.count}/${rateLimit.maxAllowed} per hour`);
      }
    }

    sendSuccess(res, { 
      isValid: errors.length === 0,
      errors: errors
    });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};