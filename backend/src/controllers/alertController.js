const mongoose = require('mongoose');
const Alert = require('../models/Alert');
const { successResponse, errorResponse } = require('../utils/response');

function formatAlert(doc) {
  const a = doc.toObject ? doc.toObject() : doc;
  return {
    id:         a._id.toString(),
    clusterId:  a.clusterId.toString(),
    severity:   a.severity,
    message:    a.message,
    wardId:     a.wardId,
    createdAt:  a.createdAt,
    resolved:   a.resolved,
    resolvedAt: a.resolvedAt || null,
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

async function resolveAlert(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid alert id', 400);
    }

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return errorResponse(res, 'Alert not found', 404);
    }

    if (!alert.resolved) {
      alert.resolved   = true;
      alert.resolvedAt = new Date();
      await alert.save();
    }

    return successResponse(res, { alert: formatAlert(alert) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAlerts, resolveAlert };
