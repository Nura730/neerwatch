const { Router } = require('express');
const { createTest, listTests, mapTests, syncTests } = require('../controllers/testController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// Read-only endpoints — publicly accessible without authentication
router.get('/map',   mapTests);
router.get('/',      listTests);

// Operators and admins may create/sync observations; viewers may not
router.post('/sync', requireAuth, requireRole('operator', 'admin'), syncTests);
router.post('/',     requireAuth, requireRole('operator', 'admin'), createTest);

module.exports = router;
