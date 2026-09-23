const { Router } = require('express');
const { listAlerts } = require('../controllers/alertController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.get('/', requireAuth, listAlerts);

module.exports = router;
