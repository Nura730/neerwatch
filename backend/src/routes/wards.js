const { Router } = require('express');
const { listWards } = require('../controllers/wardController');
const router = Router();
router.get('/', listWards);

module.exports = router;
