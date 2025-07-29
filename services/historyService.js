import mongoose from 'mongoose';
import UserHistory from '../models/History.js';

/**
 * 1. Create a new user history log
 */
export const createUserHistory = async ({
  userId,
  type,
  amount,
  status = 'completed',
  remarks = '',
}, session = null) => {
  return await UserHistory.create([{
    user: userId,
    type,
    amount,
    status,
    remarks,
  }], session ? { session } : {});
};


/**
 * 2. Get ALL logs - for admin (with optional filters)
 */
export const getAllUserHistories = async ({ page = 1, limit = 50, filters = {} }) => {
  const skip = (page - 1) * limit;
  const query = {};

  if (filters.type) query.type = filters.type;
  if (filters.status) query.status = filters.status;
  if (filters.userId) query.user = new mongoose.Types.ObjectId(filters.userId);
  if (filters.actor) query.actor = new mongoose.Types.ObjectId(filters.actor);
  if (filters.from || filters.to) {
    query.createdAt = {};
    if (filters.from) query.createdAt.$gte = new Date(filters.from);
    if (filters.to) query.createdAt.$lte = new Date(filters.to);
  }

  const [data, total] = await Promise.all([
    UserHistory.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'profile.fullName profile.phone')
      .populate('actor', 'profile.fullName profile.phone')
      .lean(),
    UserHistory.countDocuments(query)
  ]);

  return {
    total,
    page,
    limit,
    data
  };
};

/**
 * 3. Get ALL logs for a specific user
 */
export const getUserHistoryByUserId = async (userId, { page = 1, limit = 50 }) => {
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    UserHistory.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserHistory.countDocuments({ user: userId })
  ]);

  return {
    total,
    page,
    limit,
    data
  };
};

/**
 * 4. Update status/remarks by admin
 */
export const updateUserHistoryStatus = async (historyId, { status, remarks }, adminId) => {

  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  const history = await UserHistory.findById(historyId);
  if (!history) {
    throw new Error('History record not found');
  }

  history.status = status;
  history.remarks = remarks || history.remarks;
  history.actor = adminId;

  await history.save();
  return history;
};


const findUserHistoryByModelRef = async (referenceId, refModel) => {
  if (!referenceId || !refModel) {
    throw new Error('Both referenceId and refModel are required');
  }

  return await UserHistory.findOne({ referenceId, refModel }).lean();
};