const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response');

/**
 * requireAuth — verifies the Bearer token in the Authorization header.
 * On success attaches { id, email, role } to req.user and calls next().
 * Returns 401 on missing, invalid, or expired tokens.
 *
 * JWT_SECRET is read at request time so the module can be required safely
 * in tests without setting the env var at import time.  server.js validates
 * the variable is present before starting the HTTP server.
 */
function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return errorResponse(res, 'Server authentication not configured', 500);
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication required', 401);
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, secret);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
}

/**
 * requireRole(...roles) — must be used after requireAuth.
 * Returns 403 if req.user.role is not in the allowed list.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Insufficient permissions', 403);
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
