const Observation = require('../models/Observation');
const { successResponse, errorResponse } = require('../utils/response');

// Mirror of testThresholds.js expressed as MongoDB aggregation expressions.
// Must stay in sync with FAIL_CHECKS in testThresholds.js.
const FAILING_EXPR = {
  $switch: {
    branches: [
      {
        case: { $and: [{ $eq: ['$testType', 'TDS'] }, { $gt: ['$result', 500] }] },
        then: 1,
      },
      {
        case: {
          $and: [
            { $eq: ['$testType', 'pH'] },
            { $or: [{ $lt: ['$result', 6.5] }, { $gt: ['$result', 8.5] }] },
          ],
        },
        then: 1,
      },
      {
        case: { $and: [{ $eq: ['$testType', 'turbidity'] }, { $gt: ['$result', 4] }] },
        then: 1,
      },
      {
        case: { $and: [{ $eq: ['$testType', 'coliform'] }, { $gt: ['$result', 0] }] },
        then: 1,
      },
    ],
    default: 0,
  },
};

// Build the $group _id expression for the chosen interval.
// Periods:  day → "YYYY-MM-DD"
//           week → "YYYY-WNN"  (ISO week, zero-padded)
//           month → "YYYY-MM"
function periodExpr(interval) {
  if (interval === 'month') {
    return { $dateToString: { format: '%Y-%m', date: '$testedAt' } };
  }
  if (interval === 'week') {
    return {
      $concat: [
        { $toString: { $isoWeekYear: '$testedAt' } },
        '-W',
        {
          $cond: {
            if:   { $lt: [{ $isoWeek: '$testedAt' }, 10] },
            then: { $concat: ['0', { $toString: { $isoWeek: '$testedAt' } }] },
            else: { $toString: { $isoWeek: '$testedAt' } },
          },
        },
      ],
    };
  }
  // default: day
  return { $dateToString: { format: '%Y-%m-%d', date: '$testedAt' } };
}

/**
 * GET /api/analytics/contamination-trend
 *
 * Query params:
 *   wardId, testType, from, to
 *   interval = day | week | month  (default: day)
 *
 * Response: { wardId, testType, interval, series: [{ period, totalTests, positiveTests, positiveRate }] }
 * Requires authentication.
 */
async function getContaminationTrend(req, res, next) {
  try {
    const { wardId, testType } = req.query;
    const interval = ['day', 'week', 'month'].includes(req.query.interval)
      ? req.query.interval
      : 'day';

    const match = {};
    if (wardId)   match.wardId   = wardId;
    if (testType) match.testType = testType;

    if (req.query.from || req.query.to) {
      match.testedAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid from date', 400);
        match.testedAt.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid to date', 400);
        match.testedAt.$lte = d;
      }
    }

    const pipeline = [
      { $match: match },
      { $addFields: { _failing: FAILING_EXPR } },
      {
        $group: {
          _id:           periodExpr(interval),
          totalTests:    { $sum: 1 },
          positiveTests: { $sum: '$_failing' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id:           0,
          period:        '$_id',
          totalTests:    1,
          positiveTests: 1,
          positiveRate: {
            $cond: {
              if:   { $gt: ['$totalTests', 0] },
              then: {
                $round: [
                  { $multiply: [{ $divide: ['$positiveTests', '$totalTests'] }, 100] },
                  1,
                ],
              },
              else: 0,
            },
          },
        },
      },
    ];

    const series = await Observation.aggregate(pipeline);

    return successResponse(res, {
      wardId:   wardId   || null,
      testType: testType || null,
      interval,
      series,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/data-quality
 *
 * Aggregates data quality metrics across observations.
 * Optional filters: wardId, testType
 *
 * Response:
 *   { totalObservations, missingLocationCount, staleCount, implausibleCount,
 *     coverageGaps: { missingLocationPct, stalePct, implausiblePct } }
 *
 * Requires authentication.
 */
async function getDataQuality(req, res, next) {
  try {
    const match = {};
    if (req.query.wardId)   match.wardId   = req.query.wardId;
    if (req.query.testType) match.testType = req.query.testType;

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // PHYSICAL_BOUNDS as aggregation $switch expression
    const IMPLAUSIBLE_EXPR = {
      $switch: {
        branches: [
          {
            case: { $and: [{ $eq: ['$testType', 'TDS'] }, { $or: [{ $lt: ['$result', 0] }, { $gt: ['$result', 5000] }] }] },
            then: 1,
          },
          {
            case: { $and: [{ $eq: ['$testType', 'pH'] }, { $or: [{ $lt: ['$result', 0] }, { $gt: ['$result', 14] }] }] },
            then: 1,
          },
          {
            case: { $and: [{ $eq: ['$testType', 'turbidity'] }, { $or: [{ $lt: ['$result', 0] }, { $gt: ['$result', 1000] }] }] },
            then: 1,
          },
          {
            case: { $and: [{ $eq: ['$testType', 'coliform'] }, { $or: [{ $lt: ['$result', 0] }, { $gt: ['$result', 10000] }] }] },
            then: 1,
          },
        ],
        default: 0,
      },
    };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id:              null,
          total:            { $sum: 1 },
          missingLocation:  { $sum: { $cond: [{ $ifNull: ['$location.type', false] }, 0, 1] } },
          stale:            { $sum: { $cond: [{ $lt: ['$testedAt', ninetyDaysAgo] }, 1, 0] } },
          implausible:      { $sum: IMPLAUSIBLE_EXPR },
        },
      },
    ];

    const [result] = await Observation.aggregate(pipeline);

    if (!result || result.total === 0) {
      return successResponse(res, {
        totalObservations:    0,
        missingLocationCount: 0,
        staleCount:           0,
        implausibleCount:     0,
        coverageGaps:         { missingLocationPct: 0, stalePct: 0, implausiblePct: 0 },
      });
    }

    const pct = (n) => result.total > 0 ? Math.round((n / result.total) * 1000) / 10 : 0;

    return successResponse(res, {
      totalObservations:    result.total,
      missingLocationCount: result.missingLocation,
      staleCount:           result.stale,
      implausibleCount:     result.implausible,
      coverageGaps: {
        missingLocationPct: pct(result.missingLocation),
        stalePct:           pct(result.stale),
        implausiblePct:     pct(result.implausible),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/anomaly
 *
 * Compares recent contamination rate (last 7 days) against historical baseline
 * (days 8–90) for a given wardId and/or testType. Returns an anomaly signal.
 *
 * Query params: wardId, testType
 * Requires authentication.
 */
async function getAnomalySignal(req, res, next) {
  try {
    const { wardId, testType } = req.query;

    const match = {};
    if (wardId)   match.wardId   = wardId;
    if (testType) match.testType = testType;

    const now = new Date();
    const sevenDaysAgo   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo  = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Aggregate recent (0-7d) and baseline (8-90d) in one pipeline
    const pipeline = [
      { $match: { ...match, testedAt: { $gte: ninetyDaysAgo } } },
      { $addFields: { _failing: FAILING_EXPR } },
      {
        $group: {
          _id: {
            $cond: [{ $gte: ['$testedAt', sevenDaysAgo] }, 'recent', 'baseline'],
          },
          total:    { $sum: 1 },
          positive: { $sum: '$_failing' },
        },
      },
    ];

    const buckets = await Observation.aggregate(pipeline);
    const recent   = buckets.find(b => b._id === 'recent')   || { total: 0, positive: 0 };
    const baseline = buckets.find(b => b._id === 'baseline') || { total: 0, positive: 0 };

    // Need minimum observations for meaningful comparison
    const MIN_OBSERVATIONS = 3;

    if (baseline.total < MIN_OBSERVATIONS) {
      return successResponse(res, {
        anomalyDetected: false,
        reason: 'Insufficient historical observations for anomaly detection (need at least 3 in the last 90 days excluding the past 7)',
        recentRate:   recent.total > 0 ? Math.round((recent.positive / recent.total) * 1000) / 10 : null,
        baselineRate: null,
      });
    }

    const recentRate   = recent.total   > 0 ? recent.positive   / recent.total   : 0;
    const baselineRate = baseline.total > 0 ? baseline.positive / baseline.total : 0;

    // Anomaly threshold: recent rate > 1.5× baseline AND recent total ≥ MIN_OBSERVATIONS
    const SPIKE_MULTIPLIER = 1.5;
    const isSpike = recent.total >= MIN_OBSERVATIONS && recentRate > baselineRate * SPIKE_MULTIPLIER;

    const explanation = isSpike
      ? `Recent contamination rate (${Math.round(recentRate * 1000) / 10}%) is ${(recentRate / baselineRate).toFixed(1)}× above the historical baseline (${Math.round(baselineRate * 1000) / 10}%) — potential emerging contamination event`
      : recentRate > baselineRate
        ? `Recent contamination rate (${Math.round(recentRate * 1000) / 10}%) is elevated compared to baseline (${Math.round(baselineRate * 1000) / 10}%) but below the anomaly threshold`
        : `Contamination rate is within normal historical range`;

    return successResponse(res, {
      anomalyDetected: isSpike,
      anomalyType:     isSpike ? 'contamination_spike' : null,
      explanation,
      recentRate:      Math.round(recentRate   * 1000) / 10,
      baselineRate:    Math.round(baselineRate * 1000) / 10,
      recentTotal:     recent.total,
      baselineTotal:   baseline.total,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getContaminationTrend, getDataQuality, getAnomalySignal };
