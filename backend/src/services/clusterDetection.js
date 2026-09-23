const Observation = require('../models/Observation');
const Cluster     = require('../models/Cluster');
const Alert       = require('../models/Alert');
const { haversineDistance } = require('../utils/geo');
const { isFailing }         = require('../utils/testThresholds');

// Prototype cluster parameters — exposed as constants so they can be tuned.
const CLUSTER_RADIUS_M   = 500;
const CLUSTER_WINDOW_DAYS = 7;
const CLUSTER_MIN_COUNT   = 3;

const TEST_TYPES = ['TDS', 'pH', 'turbidity', 'coliform'];

async function runClusterDetection() {
  const windowEnd   = new Date();
  const windowStart = new Date(windowEnd.getTime() - CLUSTER_WINDOW_DAYS * 86400 * 1000);

  for (const testType of TEST_TYPES) {
    const observations = await Observation.find({
      testType,
      testedAt: { $gte: windowStart, $lte: windowEnd },
      'location.type': 'Point',
    }).lean();

    const failing = observations.filter((o) => isFailing(testType, o.result));
    if (failing.length < CLUSTER_MIN_COUNT) continue;

    const visited = new Set();

    for (let i = 0; i < failing.length; i++) {
      if (visited.has(i)) continue;

      const [lng1, lat1] = failing[i].location.coordinates;
      const group = [i];

      for (let j = i + 1; j < failing.length; j++) {
        const [lng2, lat2] = failing[j].location.coordinates;
        if (haversineDistance(lat1, lng1, lat2, lng2) <= CLUSTER_RADIUS_M) {
          group.push(j);
        }
      }

      if (group.length < CLUSTER_MIN_COUNT) continue;

      group.forEach((idx) => visited.add(idx));

      const groupObs = group.map((idx) => failing[idx]);
      const avgLat = groupObs.reduce((s, o) => s + o.location.coordinates[1], 0) / groupObs.length;
      const avgLng = groupObs.reduce((s, o) => s + o.location.coordinates[0], 0) / groupObs.length;
      const wardId = failing[i].wardId;

      // One active cluster per ward+testType per window — avoid duplicates
      const existing = await Cluster.findOne({
        testType,
        wardId,
        windowStart: { $lte: windowEnd },
        windowEnd:   { $gte: windowStart },
        active: true,
      });
      if (existing) continue;

      const cluster = await Cluster.create({
        testType,
        centroid:         { type: 'Point', coordinates: [avgLng, avgLat] },
        radiusMetres:     CLUSTER_RADIUS_M,
        observationCount: groupObs.length,
        failureRate:      parseFloat((groupObs.length / observations.length).toFixed(2)),
        windowStart,
        windowEnd,
        wardId,
        detectedAt: new Date(),
        active: true,
      });

      await createAlertForCluster(cluster);
    }
  }
}

async function createAlertForCluster(cluster) {
  const existing = await Alert.findOne({ clusterId: cluster._id });
  if (existing) return existing;

  return Alert.create({
    clusterId: cluster._id,
    severity:  'high',
    message:   `Failing ${cluster.testType} cluster detected in ${cluster.wardId} — ${cluster.observationCount} observations`,
    wardId:    cluster.wardId,
    resolved:  false,
  });
}

module.exports = { runClusterDetection, CLUSTER_RADIUS_M, CLUSTER_WINDOW_DAYS, CLUSTER_MIN_COUNT };
