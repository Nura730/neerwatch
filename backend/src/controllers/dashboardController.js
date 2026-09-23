const Observation = require('../models/Observation');
const Cluster     = require('../models/Cluster');
const { isFailing } = require('../utils/testThresholds');
const { successResponse } = require('../utils/response');

async function getDashboard(req, res, next) {
  try {
    const [allObs, activeClusters, missingLocations] = await Promise.all([
      Observation.find({}, { testType: 1, result: 1 }).lean(),
      Cluster.countDocuments({ active: true }),
      Observation.countDocuments({ 'location.type': { $exists: false } }),
    ]);

    const totalTests    = allObs.length;
    const positiveTests = allObs.filter((o) => isFailing(o.testType, o.result)).length;

    return successResponse(res, {
      totalTests,
      positiveTests,
      activeClusters,
      pendingSync: 0,   // No persistent sync queue in this architecture
      missingLocations,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboard };
