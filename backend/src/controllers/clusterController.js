const Cluster = require('../models/Cluster');
const { fromGeoJSON } = require('../utils/geo');
const { successResponse, errorResponse } = require('../utils/response');

function formatCluster(doc) {
  const c = doc.toObject ? doc.toObject() : doc;
  return {
    id:               c._id.toString(),
    testType:         c.testType,
    centroid:         fromGeoJSON(c.centroid),
    radiusMetres:     c.radiusMetres,
    observationCount: c.observationCount,
    failureRate:      c.failureRate,
    windowStart:      c.windowStart,
    windowEnd:        c.windowEnd,
    wardId:           c.wardId,
    detectedAt:       c.detectedAt,
    active:           c.active,
  };
}

async function listClusters(req, res, next) {
  try {
    const filter = {};
    if (req.query.active === 'true')  filter.active = true;
    if (req.query.active === 'false') filter.active = false;
    if (req.query.wardId) filter.wardId = req.query.wardId;

    const clusters = await Cluster.find(filter).sort({ detectedAt: -1 });
    return successResponse(res, { clusters: clusters.map(formatCluster) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listClusters };
