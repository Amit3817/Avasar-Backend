// Standardized API response helpers
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, details = null) => {
  res.status(statusCode).json({
    success: false,
    error: message,
    details
  });
};

export const sendValidationError = (res, errors) => {
  res.status(400).json({
    success: false,
    error: 'Validation failed',
    details: errors
  });
};

export const sendNotFound = (res, message = 'Resource not found') => {
  res.status(404).json({
    success: false,
    error: message
  });
};

export const sendUnauthorized = (res, message = 'Unauthorized access') => {
  res.status(401).json({
    success: false,
    error: message
  });
};

export const sendForbidden = (res, message = 'Access forbidden') => {
  res.status(403).json({
    success: false,
    error: message
  });
}; 