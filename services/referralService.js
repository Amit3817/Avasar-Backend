import User from '../models/User.js';

const referralService = {
  async getDirectReferrals(userId) {
    return await User.find({ referredBy: userId }).lean();
  },

  async getIndirectReferrals(userId) {
    async function getIndirect(uId) {
      const direct = await User.find({ referredBy: uId }).lean();
      let all = [];
      for (const user of direct) {
        all.push(user);
        all = all.concat(await getIndirect(user._id));
      }
      return all;
    }
    let all = await getIndirect(userId);
    // Remove direct referrals
    const directIds = new Set((await User.find({ referredBy: userId }).select('_id')).map(u => String(u._id)));
    all = all.filter(u => !directIds.has(String(u._id)));
    return all;
  },

  // Get indirect referrals up to a certain level (default 10)
  async getIndirectReferrals(userId, maxLevel = 10) {
    let result = [];
    let queue = [];
    let visited = new Set();

    // Start with direct children
    const user = await User.findById(userId).select('leftChildren rightChildren');
    if (!user) return [];

    if (user.leftChildren) user.leftChildren.forEach(id => queue.push({ id, level: 1 }));
    if (user.rightChildren) user.rightChildren.forEach(id => queue.push({ id, level: 1 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (level > maxLevel) continue;
      if (visited.has(String(id))) continue;
      visited.add(String(id));
      if (level > 1) result.push(id); // Only indirect, not direct
      // Get this user's children
      const u = await User.findById(id).select('leftChildren rightChildren');
      if (u) {
        if (u.leftChildren) u.leftChildren.forEach(cid => queue.push({ id: cid, level: level + 1 }));
        if (u.rightChildren) u.rightChildren.forEach(cid => queue.push({ id: cid, level: level + 1 }));
      }
    }
    return result;
  },

  // Add more referral logic as needed
};

export default referralService; 