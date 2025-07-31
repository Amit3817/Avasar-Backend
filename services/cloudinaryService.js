import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} folder - Cloudinary folder path
 * @param {string} publicId - Optional public ID for the file
 * @param {string} resourceType - Resource type (auto, image, video, raw)
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = async (fileBuffer, folder, publicId = null, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder,
      resource_type: resourceType,
    };

    if (publicId) {
      uploadOptions.public_id = publicId;
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(new Error('Failed to upload file to Cloudinary'));
        }
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload profile picture
 * @param {Buffer} fileBuffer - Image buffer
 * @param {string} fileName - Original file name
 * @returns {Promise<Object>} Upload result with secure URL
 */
export const uploadProfilePicture = async (fileBuffer, fileName) => {
  // Sanitize filename: remove special characters, spaces, and limit length
  const sanitizedFileName = fileName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars with underscore
    .toLowerCase()
    .substring(0, 50); // Limit length to prevent too long public_ids
  
  const publicId = `profile_${Date.now()}_${sanitizedFileName}`;
  
  try {
    return await uploadToCloudinary(fileBuffer, 'avasar/profile-pictures', publicId, 'image');
  } catch (error) {
    console.error('Profile picture upload error:', error);
    throw error;
  }
};

/**
 * Upload payment slip
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @returns {Promise<Object>} Upload result with secure URL
 */
export const uploadPaymentSlip = async (fileBuffer, fileName) => {
  const publicId = `slip_${Date.now()}_${fileName.replace(/\.[^/.]+$/, '')}`;
  return await uploadToCloudinary(fileBuffer, 'avasar/slips', publicId, 'auto');
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @param {string} resourceType - Resource type (auto, image, video, raw)
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'auto') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    throw new Error('Failed to delete file from Cloudinary');
  }
};

export default cloudinary; 