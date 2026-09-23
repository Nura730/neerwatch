const Observation              = require('../models/Observation');
const { validateObservation }  = require('../validators/observationValidator');
const { runClusterDetection }  = require('../services/clusterDetection');
const { toGeoJSON, fromGeoJSON } = require('../utils/geo');
const { successResponse, errorResponse } = require('../utils/response');

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

    const [observations, total] = await Promise.all([
      Observation.find(filter).sort({ testedAt: -1 }).skip(skip).limit(limit),
      Observation.countDocuments(filter),
    ]);

    return successResponse(res, {
      observations: observations.map(formatObs),
      total,
      page,
      limit,
    });
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

    const observations = await Observation.find(filter).sort({ testedAt: -1 }).limit(1000);
    return successResponse(res, { observations: observations.map(formatObs) });
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

    for (const item of observations) {
      try {
        const errors = validateObservation(item);
        if (errors.length) { failed++; continue; }
        await Observation.create(buildObsData(item));
        created++;
      } catch (err) {
        if (err.code === 11000) { duplicates++; }
        else { failed++; }
      }
    }

    if (created > 0) {
      runClusterDetection().catch((e) => console.error('Cluster detection error:', e.message));
    }

    return successResponse(res, { processed, created, duplicates, failed });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTest, listTests, mapTests, syncTests };
