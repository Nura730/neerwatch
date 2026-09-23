const Observation   = require('../models/Observation');
const { isFailing } = require('../utils/testThresholds');
const { successResponse } = require('../utils/response');

async function listWards(req, res, next) {
  try {
    const grouped = await Observation.aggregate([
      {
        $group: {
          _id:         '$wardId',
          totalTests:  { $sum: 1 },
          lastTestedAt:{ $max: '$testedAt' },
          tests:       { $push: { testType: '$testType', result: '$result' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const wards = grouped.map((w) => {
      const failCount = w.tests.filter((t) => isFailing(t.testType, t.result)).length;
      const passCount = w.totalTests - failCount;
      return {
        wardId:      w._id,
        name:        `Ward ${w._id.replace(/^ward-0*/i, '')}`,
        totalTests:  w.totalTests,
        passCount,
        failCount,
        failureRate: w.totalTests > 0 ? parseFloat((failCount / w.totalTests).toFixed(2)) : 0,
        lastTestedAt: w.lastTestedAt,
      };
    });

    return successResponse(res, { wards });
  } catch (err) {
    next(err);
  }
}

module.exports = { listWards };
