function successResponse(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function errorResponse(res, message, status = 500) {
  return res.status(status).json({ success: false, message });
}

module.exports = { successResponse, errorResponse };
