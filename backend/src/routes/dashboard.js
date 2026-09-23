const { Router } = require('express');
const { getDashboard } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.get('/', requireAuth, getDashboard);

module.exports = router;
