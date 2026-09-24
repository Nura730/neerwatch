const mongoose                 = require('mongoose');
const Observation              = require('../models/Observation');
const { validateObservation }  = require('../validators/observationValidator');
const { runClusterDetection }  = require('../services/clusterDetection');
const { toGeoJSON, fromGeoJSON } = require('../utils/geo');
const { successResponse, errorResponse } = require('../utils/response');
const { computeConfidence, dupKey } = require('../services/confidenceScoring');

function formatObs(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    clientId:    o.clientId,
    householdId: o.householdId,
    testType:    o.testType,
    result:      o.result,
    testedAt:    o.testedAt,
    location:    fromGeoJSON(o.location),
    wardId:      o.wardId,
    createdAt:   o.createdAt,
  };
}

// Attach confidence fields to a list of already-formatted observations.
// Duplicate detection is batch-scoped (within the returned set).
function withConfidenceBatch(formattedList) {
  const countMap = new Map();
  for (const obs of formattedList) {
    const k = dupKey(obs.householdId, obs.testType, obs.testedAt);
    countMap.set(k, (countMap.get(k) || 0) + 1);
  }
  return formattedList.map(obs => {
    const isDuplicate = (countMap.get(dupKey(obs.householdId, obs.testType, obs.testedAt)) || 0) > 1;
    return { ...obs, ...computeConfidence(obs, { isDuplicate }) };
  });
}

function buildObsData(body) {
  const data = {
    clientId:    body.clientId,
    householdId: body.householdId,
    testType:    body.testType,
    result:      body.result,
    testedAt:    new Date(body.testedAt),
    wardId:      body.wardId,
  };
  if (body.location) {
    data.location = toGeoJSON(body.location.lat, body.location.lng);
  }
  return data;
}

async function createTest(req, res, next) {
  try {
    const errors = validateObservation(req.body);
    if (errors.length) return errorResponse(res, errors[0], 400);

    let obs;
    try {
      obs = await Observation.create(buildObsData(req.body));
    } catch (err) {
      if (err.code === 11000) {
        return errorResponse(res, 'Observation with this clientId already exists', 409);
      }
      throw err;
    }

    runClusterDetection().catch((e) => console.error('Cluster detection error:', e.message));
    return successResponse(res, formatObs(obs), 201);
  } catch (err) {
    next(err);
  }
}

async function listTests(req, res, next) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.wardId)   filter.wardId   = req.query.wardId;
    if (req.query.testType) filter.testType = req.query.testType;
    if (req.query.from || req.query.to) {
      filter.testedAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid from date', 400);
        filter.testedAt.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid to date', 400);
        filter.testedAt.$lte = d;
      }
    }

    const [rawObs, total] = await Promise.all([
      Observation.find(filter).sort({ testedAt: -1 }).skip(skip).limit(limit),
      Observation.countDocuments(filter),
    ]);

    const observations = withConfidenceBatch(rawObs.map(formatObs));

    return successResponse(res, { observations, total, page, limit });
  } catch (err) {
    next(err);
  }
}

async function mapTests(req, res, next) {
  try {
    const filter = { 'location.type': 'Point' };
    if (req.query.wardId)   filter.wardId   = req.query.wardId;
    if (req.query.testType) filter.testType = req.query.testType;
    if (req.query.from || req.query.to) {
      filter.testedAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid from date', 400);
        filter.testedAt.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid to date', 400);
        filter.testedAt.$lte = d;
      }
    }

    const rawObs = await Observation.find(filter).sort({ testedAt: -1 }).limit(1000);
    const observations = withConfidenceBatch(rawObs.map(formatObs));
    return successResponse(res, { observations });
  } catch (err) {
    next(err);
  }
}

async function syncTests(req, res, next) {
  try {
    const { observations } = req.body;
    if (!observations || !Array.isArray(observations)) {
      return errorResponse(res, 'observations must be a non-empty array', 400);
    }

    let created = 0, duplicates = 0, failed = 0;
    const processed = observations.length;
    const results = [];

    for (const item of observations) {
      try {
        const errors = validateObservation(item);
        if (errors.length) {
          failed++;
          results.push({ clientId: item.clientId, status: 'failed' });
          continue;
        }
        await Observation.create(buildObsData(item));
        created++;
        results.push({ clientId: item.clientId, status: 'created' });
      } catch (err) {
        if (err.code === 11000) {
          duplicates++;
          results.push({ clientId: item.clientId, status: 'duplicate' });
        } else {
          failed++;
          results.push({ clientId: item.clientId, status: 'failed' });
        }
      }
    }

    if (created > 0) {
      runClusterDetection().catch((e) => console.error('Cluster detection error:', e.message));
    }

    return successResponse(res, { processed, created, duplicates, failed, results });
  } catch (err) {
    next(err);
  }
}

async function getTestConfidence(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid observation id', 400);
    }
    const obs = await Observation.findById(req.params.id);
    if (!obs) return errorResponse(res, 'Observation not found', 404);

    const formatted = formatObs(obs);

    // Detect duplicates: another observation with same household + test type within the same 1-hour bucket
    const bucket = Math.floor(new Date(obs.testedAt).getTime() / (1000 * 3600));
    const hourStart = new Date(bucket * 1000 * 3600);
    const hourEnd   = new Date((bucket + 1) * 1000 * 3600);
    const dupCount = await Observation.countDocuments({
      _id:         { $ne: obs._id },
      householdId: obs.householdId,
      testType:    obs.testType,
      testedAt:    { $gte: hourStart, $lt: hourEnd },
    });

    const confidence = computeConfidence(formatted, { isDuplicate: dupCount > 0 });
    return successResponse(res, confidence);
  } catch (err) {
    next(err);
  }
}

module.exports = { createTest, listTests, mapTests, syncTests, getTestConfidence };
