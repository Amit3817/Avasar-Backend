import { sendSuccess, sendError } from '../utils/responseHelpers.js';
import contactService from '../services/contactService.js';
import mongoose from 'mongoose';

export const submitContactForm = async (req, res) => {
  try {
    const { name, email, message,subject } = req.body;
    let userId = null;
    if (req.user && req.user._id) {
      userId = req.user._id;
    }
    const contactMessage = await contactService.createMessage({
      name,
      email,
      message,
      subject,
      user: userId || undefined
    });
    sendSuccess(res, { message: "Message sent successfully! We'll get back to you within 24 hours.", data: contactMessage });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getUserMessages = async (req, res) => {
  try {
    const messages = await contactService.getMessagesByUser(req.user._id,req.user.auth.email);
    sendSuccess(res, { messages });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getUserMessageDetail = async (req, res) => {
  try {
    const message = await contactService.getUserMessageById(req.user._id, req.params.id);
    if (!message) return sendError(res, 'Message not found', 404);
    sendSuccess(res, { message });
  } catch (error) {
    sendError(res, error.message, 500);
  }
};

export const getAllMessages = async (req, res) => {
  try {
    // Optionally add filters from req.query
    const messages = await contactService.getAllMessages(req.query);
    sendSuccess(res, { messages });
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
    const { status, response } = req.body;
    const update = {};
    if (status) update.status = status;
    if (typeof response === 'string') {
      update.response = response;
    }
    const updated = await contactService.updateMessage(req.params.id, update);
    if (!updated) return sendError(res, 'Message not found', 404);
    sendSuccess(res, { message: updated });
  } catch (error) {
    sendError(res, error.message, 500);
  }
}; 