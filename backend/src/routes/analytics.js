const { Router } = require('express');
const { getContaminationTrend, getDataQuality, getAnomalySignal } = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/auth');

const router = Router();

// All analytics endpoints require authentication
router.get('/contamination-trend', requireAuth, getContaminationTrend);
router.get('/data-quality',        requireAuth, getDataQuality);
router.get('/anomaly',             requireAuth, getAnomalySignal);

module.exports = router;
