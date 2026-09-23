const { Router } = require('express');
const { getRainfall } = require('../controllers/rainfallController');
const router = Router();
router.get('/', getRainfall);

module.exports = router;
