// controllers/kycController.js
import kycService from '../services/kycService.js';
import mongoose from 'mongoose';
import { uploadKYCDocument, deleteFromCloudinary } from '../services/cloudinaryService.js';
import { validateKYCData,sanitizeKYCData,validateKYCFile } from '../validators/kycValidators.js';

class KYCController {
  
  // Submit KYC
 // Update the submitKYC method in your controller to use all validators

async submitKYC(req, res) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  let documentImageUrl = null;
  
  try {
    const userId = req.user._id;
    
    // Sanitize input data
    const sanitizedData = sanitizeKYCData(req.body);
    const { fullName, dateOfBirth, address, documentType, documentNumber } = sanitizedData;
    
    // Validate form data
    const dataValidationError = validateKYCData(sanitizedData);
    if (dataValidationError) {
      return res.status(400).json({
        success: false,
        message: dataValidationError
      });
    }
    
    // Validate uploaded file
    const fileValidationError = validateKYCFile(req.file);
    if (fileValidationError) {
      return res.status(400).json({
        success: false,
        message: fileValidationError
      });
    }
    
    try {
      // Upload file to Cloudinary
      const uploadResult = await uploadKYCDocument(
        req.file.buffer, 
        req.file.originalname, 
        userId.toString()
      );
      documentImageUrl = uploadResult.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload document image'
      });
    }
    
    const kycData = {
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      address,
      documentType,
      documentNumber,
      documentImage: documentImageUrl
    };
    
    const kyc = await kycService.submitKYC(userId, kycData, session);
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'KYC submitted successfully',
      data: {
        id: kyc._id,
        status: kyc.status,
        submittedAt: kyc.submittedAt
      }
    });
    
  } catch (error) {
    await session.abortTransaction();
    
    // Delete uploaded file if error occurs
    if (documentImageUrl) {
      try {
        const publicId = kycService.extractPublicIdFromUrl(documentImageUrl);
        if (publicId) {
          await deleteFromCloudinary(publicId, 'image');
        }
      } catch (deleteError) {
        console.error('Failed to cleanup uploaded file:', deleteError);
      }
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
}
  
  // Get user's KYC status
  async getMyKYC(req, res) {
    try {
      const userId = req.user._id;
      const kyc = await kycService.getKYCByUserId(userId);
      
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC not found'
        });
      }
      
      // Remove sensitive data for user
      const response = {
        id: kyc._id,
        status: kyc.status,
        fullName: kyc.fullName,
        dateOfBirth: kyc.dateOfBirth,
        address: kyc.address,
        documentType: kyc.documentType,
        documentNumber: kyc.documentNumber.replace(/(.{4}).*(.{4})/, '$1****$2'), // Mask document number
        submittedAt: kyc.submittedAt,
        rejectionReason: kyc.rejectionReason,
        createdAt: kyc.createdAt
      };
      
      res.json({
        success: true,
        data: response
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Get all KYCs (Admin only)
  async getAllKYCs(req, res) {
    try {
      const { status, documentType, page = 1, limit = 10 } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (documentType) filters.documentType = documentType;
      
      const result = await kycService.getAllKYCs(
        filters, 
        parseInt(page), 
        parseInt(limit)
      );
      
      res.json({
        success: true,
        data: result.kycs,
        pagination: result.pagination
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Get KYC by ID (Admin only)
  async getKYCById(req, res) {
    try {
      const { id } = req.params;
      
      // Check if id is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid KYC ID'
        });
      }
      
      const kyc = await kycService.getKYCByUserId(id);
      
      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC not found'
        });
      }
      
      res.json({
        success: true,
        data: kyc
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
  
  // Approve KYC (Admin only)
  async approveKYC(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { id } = req.params;
      const adminId = req.user._id;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid KYC ID'
        });
      }
      
      const kyc = await kycService.approveKYC(id, adminId, session);
      
      await session.commitTransaction();
      
      res.json({
        success: true,
        message: 'KYC approved successfully',
        data: {
          id: kyc._id,
          status: kyc.status,
          reviewedAt: kyc.reviewedAt
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    } finally {
      session.endSession();
    }
  }
  
  // Reject KYC (Admin only)
  async rejectKYC(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;
      const adminId = req.user._id;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid KYC ID'
        });
      }
      
      if (!rejectionReason || rejectionReason.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required and must be at least 10 characters'
        });
      }
      
      const kyc = await kycService.rejectKYC(id, adminId, rejectionReason.trim(), session);
      
      await session.commitTransaction();
      
      res.json({
        success: true,
        message: 'KYC rejected successfully',
        data: {
          id: kyc._id,
          status: kyc.status,
          rejectionReason: kyc.rejectionReason,
          reviewedAt: kyc.reviewedAt
        }
      });
      
    } catch (error) {
      await session.abortTransaction();
      
      res.status(400).json({
        success: false,
        message: error.message
      });
    } finally {
      session.endSession();
    }
  }
  
  // Get KYC statistics (Admin only)
  async getKYCStats(req, res) {
    try {
      const stats = await kycService.getKYCStats();
      
      res.json({
        success: true,
        data: stats
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new KYCController();