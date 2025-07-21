import adminService from '../services/adminService.js';
import referralService from '../services/referralService.js';
import { createPaginationResponse } from '../middleware/pagination.js';
import { sendSuccess, sendError } from '../utils/responseHelpers.js';
import logger from '../config/logger.js';

export async function getAllUsers(req, res) {
  try {
    const { users, total, page, limit } = await adminService.getAllUsers(req.pagination);
    const response = createPaginationResponse(users, total, page, limit);
    sendSuccess(res, response, 'All users fetched successfully.');
  } catch (err) {
    logger.error('Error fetching all users:', err);
    sendError(res, err.message, 500);
  }
}

export async function updateUserIncome(req, res) {
  try {
    const user = await adminService.updateUserIncome(req.params.id, req.body);
    res.json({ message: 'User details updated successfully.', user });
  } catch (err) {
    logger.error('Error updating user income:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getAllPaymentSlips(req, res) {
  try {
    const { slips, total, page, limit } = await adminService.getAllPaymentSlips(req.pagination);
    const response = createPaginationResponse(slips, total, page, limit);
    sendSuccess(res, response, 'Payment slips fetched successfully.');
  } catch (err) {
    logger.error('Error fetching all payment slips:', err);
    sendError(res, err.message, 500);
  }
}

export async function updatePaymentSlipStatus(req, res) {
  try {
    const slip = await adminService.updatePaymentSlipStatus(req.params.id, req.body, req.user.id);
    logger.info(`Payment slip status updated by admin: ${req.user?._id}`);
    res.json({ message: `Payment slip ${req.body.status} successfully.`, slip });
  } catch (err) {
    logger.error('Error updating payment slip status:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function getUserRewards(req, res) {
  try {
    const rewards = await adminService.getUserRewards(req.params.id);
    res.json(rewards);
  } catch (err) {
    logger.error('Error fetching user rewards:', err);
    res.status(500).json({ error: 'Failed to fetch user rewards', details: err.message });
  }
}

export async function getDashboardStats(req, res) {
  try {
    const stats = await adminService.getDashboardStats();
    sendSuccess(res, stats, 'Dashboard stats fetched successfully.');
  } catch (err) {
    logger.error('Error fetching dashboard stats:', err);
    sendError(res, err.message, 500);
  }
}

export async function getUserById(req, res) {
  try {
    const user = await adminService.getUserById(req.params.id);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }
    sendSuccess(res, { user }, 'User fetched successfully.');
  } catch (err) {
    logger.error('Error fetching user by ID:', err);
    sendError(res, err.message, 500);
  }
}

export async function getPlatformIncomeStats(req, res) {
  try {
    const stats = await adminService.getPlatformIncomeStats();
    sendSuccess(res, stats, 'Platform income stats fetched successfully.');
  } catch (err) {
    logger.error('Error fetching platform income stats:', err);
    sendError(res, err.message, 500);
  }
} 