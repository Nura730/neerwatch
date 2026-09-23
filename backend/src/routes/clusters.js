const { Router } = require('express');
const { listClusters } = require('../controllers/clusterController');
const { requireAuth } = require('../middleware/auth');

const router = Router();
router.get('/', requireAuth, listClusters);

module.exports = router;
