const { Router } = require('express');

const testsRouter     = require('./tests');
const clustersRouter  = require('./clusters');
const alertsRouter    = require('./alerts');
const dashboardRouter = require('./dashboard');
const wardsRouter     = require('./wards');
const rainfallRouter  = require('./rainfall');

const router = Router();

router.use('/tests',     testsRouter);
router.use('/clusters',  clustersRouter);
router.use('/alerts',    alertsRouter);
router.use('/dashboard', dashboardRouter);
router.use('/wards',     wardsRouter);
router.use('/rainfall',  rainfallRouter);

module.exports = router;
