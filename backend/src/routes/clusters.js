const { Router } = require('express');
const { listClusters } = require('../controllers/clusterController');

const router = Router();
router.get('/', listClusters);

module.exports = router;
