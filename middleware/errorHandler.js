const errorHandler = (err, req, res, next) => {
  res.status(err.status || 500).json({
    success: false,
    data: null,
    message: err.message || 'Internal server error',
    error: err.stack || err.message || err
  });
};

export default errorHandler; 