import logger from './logger.js';

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack || err.message || err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    message: err.message || 'Internal server error',
    error: err.stack || err.message || err
  });
};

export default errorHandler; 