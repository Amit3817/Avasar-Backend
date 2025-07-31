// services/kycService.js
import KYC from '../models/Kyc.js';

class KYCService {
  
  // Submit KYC for user
  async submitKYC(userId, kycData, session = null) {
    try {
      // Check if KYC already exists
      const existingKYC = await KYC.findOne({ userId }).session(session);
      
      if (existingKYC) {
        // Update existing KYC if it's pending or rejected
        if (!['pending', 'rejected'].includes(existingKYC.status)) {
          throw new Error('KYC already submitted and under review or approved');
        }
        
        // Update existing KYC
        Object.assign(existingKYC, kycData);
        existingKYC.status = 'submitted';
        existingKYC.submittedAt = new Date();
        existingKYC.rejectionReason = undefined; // Clear previous rejection reason
        
        await existingKYC.save({ session });
        
        return existingKYC;
      }
      
      // Create new KYC
      const kyc = new KYC({
        userId,
        ...kycData,
        status: 'submitted',
        submittedAt: new Date()
      });
      
      await kyc.save({ session });
      
      return kyc;
      
    } catch (error) {
      throw new Error(`Failed to submit KYC: ${error.message}`);
    }
  }
  
  // Get KYC by user ID
  async getKYCByUserId(userId) {
    try {
      const kyc = await KYC.findOne({ userId }).populate('userId', 'profile.fullName auth.email');
      return kyc;
    } catch (error) {
      throw new Error(`Failed to get KYC: ${error.message}`);
    }
  }
  
  // Get all KYCs (admin)
  async getAllKYCs(filters = {}, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      
      // Build query
      const query = {};
      if (filters.status) query.status = filters.status;
      if (filters.documentType) query.documentType = filters.documentType;
      
      const kycs = await KYC.find(query)
        .populate('userId', 'profile.fullName auth.email avasarId')
        .populate('reviewedBy', 'profile.fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await KYC.countDocuments(query);
      
      return {
        kycs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      throw new Error(`Failed to get KYCs: ${error.message}`);
    }
  }
  
  // Approve KYC (admin)
  async approveKYC(kycId, adminId, session = null) {
    try {
      const kyc = await KYC.findById(kycId).session(session);
      if (!kyc) {
        throw new Error('KYC not found');
      }
      
      if (kyc.status === 'approved') {
        throw new Error('KYC already approved');
      }
      
      kyc.status = 'approved';
      kyc.reviewedBy = adminId;
      kyc.reviewedAt = new Date();
      kyc.rejectionReason = undefined;
      
      await kyc.save({ session });
      
      return kyc;
    } catch (error) {
      throw new Error(`Failed to approve KYC: ${error.message}`);
    }
  }
  
  // Reject KYC (admin)
  async rejectKYC(kycId, adminId, rejectionReason, session = null) {
    try {
      const kyc = await KYC.findById(kycId).session(session);
      if (!kyc) {
        throw new Error('KYC not found');
      }
      
      if (kyc.status === 'approved') {
        throw new Error('Cannot reject approved KYC');
      }
      
      kyc.status = 'rejected';
      kyc.reviewedBy = adminId;
      kyc.reviewedAt = new Date();
      kyc.rejectionReason = rejectionReason;
      
      await kyc.save({ session });
    
      
      return kyc;
    } catch (error) {
      throw new Error(`Failed to reject KYC: ${error.message}`);
    }
  }
  
  // Check if user is KYC verified
  async isUserKYCVerified(userId) {
    try {
      const kyc = await KYC.findOne({ userId });
      return kyc && kyc.isApproved();
    } catch (error) {
      throw new Error(`Failed to check KYC status: ${error.message}`);
    }
  }
  
  // Get KYC statistics (admin)
  async getKYCStats() {
    try {
      const stats = await KYC.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);
      
      const result = {
        pending: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        total: 0
      };
      
      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get KYC stats: ${error.message}`);
    }
  }
}

export default new KYCService();