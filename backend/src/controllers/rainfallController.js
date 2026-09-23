const Rainfall = require('../models/Rainfall');
const { successResponse } = require('../utils/response');

async function getRainfall(req, res, next) {
  try {
    const filter = {};
    if (req.query.wardId) filter.wardId = req.query.wardId;
    if (req.query.from || req.query.to) {
      filter.recordedAt = {};
      if (req.query.from) filter.recordedAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.recordedAt.$lte = new Date(req.query.to);
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
