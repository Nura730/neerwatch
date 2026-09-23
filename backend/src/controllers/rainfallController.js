const Rainfall = require('../models/Rainfall');
const { successResponse, errorResponse } = require('../utils/response');

async function getRainfall(req, res, next) {
  try {
    const filter = {};
    if (req.query.wardId) filter.wardId = req.query.wardId;
    if (req.query.from || req.query.to) {
      filter.recordedAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid from date', 400);
        filter.recordedAt.$gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return errorResponse(res, 'Invalid to date', 400);
        filter.recordedAt.$lte = d;
      }
    }

    const rainfall = await Rainfall.find(filter).sort({ recordedAt: -1 });
    return successResponse(res, {
      rainfall: rainfall.map((r) => ({
        wardId:     r.wardId,
        rainfallMm: r.rainfallMm,
        recordedAt: r.recordedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getRainfall };
