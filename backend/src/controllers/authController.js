const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response');

const VALID_ROLES = ['admin', 'operator', 'viewer'];

function bcryptRounds() {
  return parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
}

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

function formatUser(user) {
  return { id: user._id.toString(), email: user.email, role: user.role, createdAt: user.createdAt };
}

/**
 * POST /api/auth/login  — public
 * Body: { email, password }
 * Returns: { token, user }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', 400);
    }

    // select('+password') overrides the schema's select:false to load the hash
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
    if (!user) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) {
      return errorResponse(res, 'Invalid credentials', 401);
    }

    const token = signToken(user);
    return successResponse(res, { token, user: formatUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register  — admin only (protected in route)
 * Body: { email, password, role? }
 * Returns: { user }
 */
async function register(req, res, next) {
  try {
    const { email, password, role } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return errorResponse(res, 'Valid email is required', 400);
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return errorResponse(res, 'Password must be at least 8 characters', 400);
    }
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return errorResponse(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400);
    }

    const normalised = email.toLowerCase().trim();
    const existing   = await User.findOne({ email: normalised });
    if (existing) {
      return errorResponse(res, 'Email already registered', 409);
    }

    const hash = await bcrypt.hash(password, bcryptRounds());
    const user = await User.create({ email: normalised, password: hash, role: role || 'viewer' });

    return successResponse(res, { user: formatUser(user) }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me  — requireAuth
 * Returns the authenticated user's profile.
 */
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    return successResponse(res, { user: formatUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, register, me };
