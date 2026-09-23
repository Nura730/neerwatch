const { Router } = require('express');
const { getRainfall } = require('../controllers/rainfallController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.get('/', requireAuth, getRainfall);

module.exports = router;
