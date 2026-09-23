const { Router } = require('express');
const { listAlerts, resolveAlert } = require('../controllers/alertController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

router.get('/',               requireAuth,                                   listAlerts);
router.patch('/:id/resolve',  requireAuth, requireRole('operator', 'admin'), resolveAlert);

module.exports = router;
