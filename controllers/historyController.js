import {
  createUserHistory,
  getAllUserHistories,
  getUserHistoryByUserId,
  updateUserHistoryStatus,
} from '../services/historyService.js'; // rename your file accordingly
import { sendSuccess,sendError } from '../utils/responseHelpers.js';

// 1. Create a new history entry (e.g. by backend or bonus service)
export const handleCreateUserHistory = async (req, res) => {
  try {
    const { userId, type, amount, status, remarks } = req.body;
    const history = await createUserHistory({ userId, type, amount, status, remarks });
    res.status(201).json(history[0]); // it's created as array
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user history', error: error.message });
  }
};

// 2. Get all histories (admin only, with filters/pagination)
export const handleGetAllUserHistories = async (req, res) => {
  try {
    const { page = 1, limit = 50, ...filters } = req.query;
    const result = await getAllUserHistories({
      page: parseInt(page),
      limit: parseInt(limit),
      filters,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch histories', error: error.message });
  }
};

// 3. Get histories for a specific user
export const handleGetUserHistoryByUserId = async (req, res) => {
  try {
    const userId  = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    const result = await getUserHistoryByUserId(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });
   return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

// 4. Admin updates a specific user history record (status/remarks)
export const handleUpdateUserHistoryStatus = async (req, res) => {
  try {
    const { historyId } = req.params;
    const { status, remarks } = req.body;
    const adminId = req.user?._id; // assuming you're using auth middleware

    const updated = await updateUserHistoryStatus(historyId, { status, remarks }, adminId);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: 'Failed to update history status', error: error.message });
  }
};
