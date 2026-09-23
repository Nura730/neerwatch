const { Router } = require('express');
const { login, register, me } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// Public
router.post('/login',    login);

// Admin only — admin creates other users and assigns their role
router.post('/register', requireAuth, requireRole('admin'), register);

// Any authenticated user
router.get('/me', requireAuth, me);

module.exports = router;
