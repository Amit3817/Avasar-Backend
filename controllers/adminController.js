import adminService from '../services/adminService.js';
import { createPaginationResponse } from '../middleware/pagination.js';

export async function getAllUsers(req, res) {
  try {
    const { users, total, page, limit } = await adminService.getAllUsers(req.pagination);
    const response = createPaginationResponse(users, total, page, limit);
    res.json({ 
      success: true, 
      message: 'All users fetched successfully.', 
      ...response 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserIncome(req, res) {
  try {
    const user = await adminService.updateUserIncome(req.params.id, req.body);
    res.json({ message: 'User details updated successfully.', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAllPaymentSlips(req, res) {
  try {
    const { slips, total, page, limit } = await adminService.getAllPaymentSlips(req.pagination);
    const response = createPaginationResponse(slips, total, page, limit);
    res.json({ 
      success: true, 
      message: 'Payment slips fetched successfully.', 
      ...response 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updatePaymentSlipStatus(req, res) {
  try {
    const slip = await adminService.updatePaymentSlipStatus(req.params.id, req.body, req.user.id);
    res.json({ message: `Payment slip ${req.body.status} successfully.`, slip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUserRewards(req, res) {
  try {
    const rewards = await adminService.getUserRewards(req.params.id);
    res.json(rewards);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user rewards', details: err.message });
  }
} 