const Alert = require('../models/Alert');
const { successResponse } = require('../utils/response');

function formatAlert(doc) {
  const a = doc.toObject ? doc.toObject() : doc;
  return {
    id:        a._id.toString(),
    clusterId: a.clusterId.toString(),
    severity:  a.severity,
    message:   a.message,
    wardId:    a.wardId,
    createdAt: a.createdAt,
    resolved:  a.resolved,
  };
}

async function listAlerts(req, res, next) {
  try {
    const filter = {};
    if (req.query.active === 'true')  filter.resolved = false;
    if (req.query.active === 'false') filter.resolved = true;
    if (req.query.wardId) filter.wardId = req.query.wardId;

    const alerts = await Alert.find(filter).sort({ createdAt: -1 });
    return successResponse(res, { alerts: alerts.map(formatAlert) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts };
