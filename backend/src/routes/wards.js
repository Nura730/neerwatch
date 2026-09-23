const { Router } = require('express');
const { listWards } = require('../controllers/wardController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.get('/', requireAuth, listWards);

module.exports = router;
