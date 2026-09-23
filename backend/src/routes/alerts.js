const { Router } = require('express');
const { listAlerts } = require('../controllers/alertController');

const router = Router();
router.get('/', listAlerts);

module.exports = router;
