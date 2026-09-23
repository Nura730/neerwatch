function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  return res.status(status).json({ success: false, message });
}

module.exports = errorHandler;
