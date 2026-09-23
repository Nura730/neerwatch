const { Router } = require('express');
const { createTest, listTests, mapTests, syncTests } = require('../controllers/testController');

const router = Router();

router.get('/map',  mapTests);
router.post('/sync', syncTests);
router.get('/',     listTests);
router.post('/',    createTest);

module.exports = router;
