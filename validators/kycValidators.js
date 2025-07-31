// validators/kycValidator.js

/**
 * Validate KYC form data
 * @param {Object} data - KYC form data
 * @returns {string|null} - Error message if validation fails, null if valid
 */
export const validateKYCData = (data) => {
  const { fullName, dateOfBirth, address, documentType, documentNumber } = data;
  
  // Validate full name
  if (!fullName || typeof fullName !== 'string') {
    return 'Full name is required';
  }
  
  const trimmedName = fullName.trim();
  if (trimmedName.length < 2) {
    return 'Full name must be at least 2 characters long';
  }
  
  if (trimmedName.length > 100) {
    return 'Full name must not exceed 100 characters';
  }
  
  // Check if name contains only letters, spaces, dots, and hyphens
  if (!/^[a-zA-Z\s.-]+$/.test(trimmedName)) {
    return 'Full name can only contain letters, spaces, dots, and hyphens';
  }
  
  // Validate date of birth
  if (!dateOfBirth) {
    return 'Date of birth is required';
  }
  
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) {
    return 'Invalid date of birth format';
  }
  
  // Check if user is at least 18 years old
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  
  if (age < 18 || (age === 18 && monthDiff < 0) || (age === 18 && monthDiff === 0 && now.getDate() < dob.getDate())) {
    return 'You must be at least 18 years old';
  }
  
  // Check if date is not in the future
  if (dob > now) {
    return 'Date of birth cannot be in the future';
  }
  
  // Check if date is not too far in the past (reasonable age limit)
  const maxAge = 120;
  if (age > maxAge) {
    return 'Invalid date of birth - age cannot exceed 120 years';
  }
  
  // Validate address
  if (!address || typeof address !== 'string') {
    return 'Address is required';
  }
  
  const trimmedAddress = address.trim();
  if (trimmedAddress.length < 10) {
    return 'Address must be at least 10 characters long';
  }
  
  if (trimmedAddress.length > 500) {
    return 'Address must not exceed 500 characters';
  }
  
  // Validate document type
  const validDocumentTypes = ['aadhaar', 'passport', 'driving_license', 'voter_id', 'bank_passbook'];
  if (!documentType || !validDocumentTypes.includes(documentType)) {
    return 'Please select a valid document type';
  }
  
  // Validate document number
  if (!documentNumber || typeof documentNumber !== 'string') {
    return 'Document number is required';
  }
  
  const trimmedDocNumber = documentNumber.trim();
  if (trimmedDocNumber.length < 5) {
    return 'Document number must be at least 5 characters long';
  }
  
  if (trimmedDocNumber.length > 50) {
    return 'Document number must not exceed 50 characters';
  }
  
  // Document-specific validations
  switch (documentType) {
    case 'aadhaar':
      if (!validateAadhaarNumber(trimmedDocNumber)) {
        return 'Invalid Aadhaar number format. Should be 12 digits or XXXX-XXXX-XXXX format';
      }
      break;
      
    case 'passport':
      if (!validatePassportNumber(trimmedDocNumber)) {
        return 'Invalid passport number format. Should be 8 alphanumeric characters';
      }
      break;
      
    case 'driving_license':
      if (!validateDrivingLicenseNumber(trimmedDocNumber)) {
        return 'Invalid driving license number format';
      }
      break;
      
    case 'voter_id':
      if (!validateVoterIdNumber(trimmedDocNumber)) {
        return 'Invalid voter ID number format. Should be 10 alphanumeric characters';
      }
      break;
      case 'bank_passbook': // Add bank passbook validation
      if (!validateBankPassbookNumber(trimmedDocNumber)) {
        return 'Invalid bank account number format. Should be 9-18 digits';
      }
      break;
  }
  
  return null; // No validation errors
};

/**
 * Validate Aadhaar number
 * @param {string} aadhaar - Aadhaar number
 * @returns {boolean} - True if valid
 */
const validateAadhaarNumber = (aadhaar) => {
  // Remove spaces and hyphens
  const cleanAadhaar = aadhaar.replace(/[\s-]/g, '');
  
  // Check if it's 12 digits
  if (!/^\d{12}$/.test(cleanAadhaar)) {
    return false;
  }
  
  // Basic Aadhaar validation (Verhoeff algorithm would be more accurate)
  // For simplicity, just checking format and that it's not all same digits
  const allSameDigits = /^(\d)\1{11}$/.test(cleanAadhaar);
  return !allSameDigits;
};

/**
 * Validate passport number
 * @param {string} passport - Passport number
 * @returns {boolean} - True if valid
 */
const validatePassportNumber = (passport) => {
  // Indian passport format: 8 alphanumeric characters
  return /^[A-Z]\d{7}$/.test(passport.toUpperCase());
};

/**
 * Validate driving license number
 * @param {string} dlNumber - Driving license number
 * @returns {boolean} - True if valid
 */
const validateDrivingLicenseNumber = (dlNumber) => {
  // Indian DL format: HR-0619850034761 (State code + numbers)
  // Simplified validation - at least 10 characters with letters and numbers
  return /^[A-Z]{2}[-]?\d{8,}$/.test(dlNumber.toUpperCase());
};

/**
 * Validate voter ID number
 * @param {string} voterId - Voter ID number
 * @returns {boolean} - True if valid
 */
const validateVoterIdNumber = (voterId) => {
  // Indian voter ID format: 10 alphanumeric characters
  return /^[A-Z]{3}\d{7}$/.test(voterId.toUpperCase());
};

/**
 * Validate rejection reason (for admin)
 * @param {string} reason - Rejection reason
 * @returns {string|null} - Error message if validation fails, null if valid
 */
export const validateRejectionReason = (reason) => {
  if (!reason || typeof reason !== 'string') {
    return 'Rejection reason is required';
  }
  
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return 'Rejection reason must be at least 10 characters long';
  }
  
  if (trimmedReason.length > 1000) {
    return 'Rejection reason must not exceed 1000 characters';
  }
  
  return null;
};

/**
 * Validate file for KYC document
 * @param {Object} file - Multer file object
 * @returns {string|null} - Error message if validation fails, null if valid
 */
export const validateKYCFile = (file) => {
  if (!file) {
    return 'Document image is required';
  }
  
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    return 'Only JPEG, PNG, and WebP images are allowed';
  }
  
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return 'File size must be less than 5MB';
  }
  
  // Check minimum file size (to avoid empty files)
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    return 'File is too small. Please upload a valid document image';
  }
  
  return null;
};

const validateBankPassbookNumber = (accountNumber) => {
  // Bank account numbers in India are typically 9-18 digits
  return /^\d{9,18}$/.test(accountNumber);
};

/**
 * Sanitize and format KYC data
 * @param {Object} data - Raw KYC data
 * @returns {Object} - Sanitized KYC data
 */
export const sanitizeKYCData = (data) => {
  return {
    fullName: data.fullName?.trim(),
    dateOfBirth: data.dateOfBirth,
    address: data.address?.trim(),
    documentType: data.documentType?.toLowerCase(),
    documentNumber: data.documentNumber?.trim().toUpperCase()
  };
};