import { sendError } from '../utils/responseHelpers.js';

const errorHandler = (err, req, res, next) => {
  sendError(res, err.message || 'Internal server error', err.status || 500, err.stack || err);
};

export default errorHandler; 