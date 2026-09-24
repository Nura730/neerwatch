const mongoose = require('mongoose');
const FieldTask = require('../models/FieldTask');
const { successResponse, errorResponse } = require('../utils/response');

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES   = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];

// Allowed status transitions: from → [allowed to]
const VALID_TRANSITIONS = {
  pending:     ['assigned', 'in_progress', 'cancelled'],
  assigned:    ['in_progress', 'pending', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

function formatTask(doc) {
  const t = doc.toObject ? doc.toObject() : doc;
  const hasLoc = t.location && t.location.lat != null && t.location.lng != null;
  return {
    id:                  t._id.toString(),
    title:               t.title,
    description:         t.description,
    wardId:              t.wardId,
    location:            hasLoc ? { lat: t.location.lat, lng: t.location.lng } : null,
    priority:            t.priority,
    status:              t.status,
    assignedTo:          t.assignedTo || null,
    sourceObservationId: t.sourceObservationId ? t.sourceObservationId.toString() : null,
    dueAt:               t.dueAt || null,
    completedAt:         t.completedAt || null,
    createdAt:           t.createdAt,
    updatedAt:           t.updatedAt,
  };
}

async function listFieldTasks(req, res, next) {
  try {
    const filter = {};
    if (req.query.wardId)     filter.wardId     = req.query.wardId;
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.priority)   filter.priority   = req.query.priority;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const tasks = await FieldTask.find(filter).sort({ createdAt: -1 });
    return successResponse(res, { tasks: tasks.map(formatTask) });
  } catch (err) {
    next(err);
  }
}

async function getFieldTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid task id', 400);
    }
    const task = await FieldTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Field task not found', 404);
    return successResponse(res, { task: formatTask(task) });
  } catch (err) {
    next(err);
  }
}

async function createFieldTask(req, res, next) {
  try {
    const { title, description, wardId, location, priority, dueAt, sourceObservationId, assignedTo } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return errorResponse(res, 'title is required', 400);
    }
    if (!wardId || typeof wardId !== 'string' || !wardId.trim()) {
      return errorResponse(res, 'wardId is required', 400);
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return errorResponse(res, `priority must be one of: ${VALID_PRIORITIES.join(', ')}`, 400);
    }
    if (location !== undefined && location !== null) {
      const { lat, lng } = location;
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return errorResponse(res, 'location must include numeric lat and lng', 400);
      }
    }
    if (dueAt !== undefined && dueAt !== null && isNaN(new Date(dueAt).getTime())) {
      return errorResponse(res, 'dueAt must be a valid date', 400);
    }
    if (sourceObservationId !== undefined && sourceObservationId !== null &&
        !mongoose.Types.ObjectId.isValid(sourceObservationId)) {
      return errorResponse(res, 'sourceObservationId must be a valid id', 400);
    }

    const data = {
      title: title.trim(),
      wardId: wardId.trim(),
      description: description || '',
      priority: priority || 'medium',
      status: 'pending',
    };
    if (location)             data.location = { lat: location.lat, lng: location.lng };
    if (dueAt)                data.dueAt = new Date(dueAt);
    if (sourceObservationId)  data.sourceObservationId = sourceObservationId;
    if (assignedTo) {
      data.assignedTo = assignedTo;
      data.status = 'assigned';
    }

    const task = await FieldTask.create(data);
    return successResponse(res, { task: formatTask(task) }, 201);
  } catch (err) {
    next(err);
  }
}

async function updateFieldTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid task id', 400);
    }
    const task = await FieldTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Field task not found', 404);

    const { title, description, wardId, location, priority, dueAt } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return errorResponse(res, 'title must be a non-empty string', 400);
      }
      task.title = title.trim();
    }
    if (description !== undefined) task.description = description;
    if (wardId !== undefined) {
      if (typeof wardId !== 'string' || !wardId.trim()) {
        return errorResponse(res, 'wardId must be a non-empty string', 400);
      }
      task.wardId = wardId.trim();
    }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return errorResponse(res, `priority must be one of: ${VALID_PRIORITIES.join(', ')}`, 400);
      }
      task.priority = priority;
    }
    if (location !== undefined) {
      if (location === null) {
        task.location = { lat: null, lng: null };
      } else {
        const { lat, lng } = location;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          return errorResponse(res, 'location must include numeric lat and lng', 400);
        }
        task.location = { lat, lng };
      }
    }
    if (dueAt !== undefined) {
      if (dueAt === null) {
        task.dueAt = null;
      } else if (isNaN(new Date(dueAt).getTime())) {
        return errorResponse(res, 'dueAt must be a valid date', 400);
      } else {
        task.dueAt = new Date(dueAt);
      }
    }

    await task.save();
    return successResponse(res, { task: formatTask(task) });
  } catch (err) {
    next(err);
  }
}

async function assignFieldTask(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid task id', 400);
    }
    const task = await FieldTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Field task not found', 404);

    if (['completed', 'cancelled'].includes(task.status)) {
      return errorResponse(res, `Cannot assign a ${task.status} task`, 400);
    }

    const { assignedTo } = req.body;

    if (!assignedTo) {
      // Unassign
      task.assignedTo = null;
      if (task.status === 'assigned') task.status = 'pending';
    } else {
      task.assignedTo = String(assignedTo);
      if (task.status === 'pending') task.status = 'assigned';
    }

    await task.save();
    return successResponse(res, { task: formatTask(task) });
  } catch (err) {
    next(err);
  }
}

async function updateFieldTaskStatus(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 'Invalid task id', 400);
    }
    const task = await FieldTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Field task not found', 404);

    const { status } = req.body;
    if (!status) return errorResponse(res, 'status is required', 400);
    if (!VALID_STATUSES.includes(status)) {
      return errorResponse(res, `status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const allowed = VALID_TRANSITIONS[task.status] || [];
    if (!allowed.includes(status)) {
      return errorResponse(
        res,
        `Cannot transition from '${task.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`,
        400
      );
    }

    task.status = status;
    if (status === 'completed') task.completedAt = new Date();
    if (status === 'pending')   task.assignedTo = null; // clear assignment on revert

    await task.save();
    return successResponse(res, { task: formatTask(task) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/field-tasks/suggest
 *
 * Returns a suggested (not yet created) field task based on recent failing
 * observations for the given ward/testType. The operator must explicitly
 * create the task — nothing is auto-dispatched.
 *
 * Query params: wardId (required), testType (optional)
 * Public endpoint (no auth required).
 */
async function suggestFieldTask(req, res, next) {
  try {
    const { wardId, testType } = req.query;

    if (!wardId) {
      return errorResponse(res, 'wardId is required', 400);
    }

    const Observation = require('../models/Observation');
    const { isFailing } = require('../utils/testThresholds');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filter = { wardId, testedAt: { $gte: sevenDaysAgo } };
    if (testType) filter.testType = testType;

    const recentObs = await Observation.find(filter).sort({ testedAt: -1 }).limit(50);
    const failing = recentObs.filter(o => isFailing(o.testType, o.result));

    if (failing.length < 3) {
      return successResponse(res, {
        suggestion: null,
        reason: failing.length === 0
          ? 'No recent failing observations for this ward — no field investigation suggested'
          : `Only ${failing.length} recent failing observation(s) — below the threshold of 3 required to suggest field work`,
      });
    }

    // Determine priority from failure count
    let priority = 'medium';
    if (failing.length >= 10) priority = 'critical';
    else if (failing.length >= 6) priority = 'high';

    // Most common failing test type in the set
    const typeCounts = {};
    for (const o of failing) {
      typeCounts[o.testType] = (typeCounts[o.testType] || 0) + 1;
    }
    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];

    // Centroid of failing observations with location
    const withLoc = failing.filter(o => o.location && o.location.type === 'Point');
    let centroid = null;
    if (withLoc.length > 0) {
      const avgLat = withLoc.reduce((s, o) => s + o.location.coordinates[1], 0) / withLoc.length;
      const avgLng = withLoc.reduce((s, o) => s + o.location.coordinates[0], 0) / withLoc.length;
      centroid = { lat: Math.round(avgLat * 1e6) / 1e6, lng: Math.round(avgLng * 1e6) / 1e6 };
    }

    return successResponse(res, {
      suggestion: {
        title: `Verify ${dominantType} contamination in ${wardId}`,
        description: `${failing.length} recent failing ${dominantType} observation(s) detected in ${wardId} within the last 7 days. Field verification recommended.`,
        wardId,
        location:  centroid,
        priority,
        sourceObservationId: failing[0]._id.toString(),
        suggestedAction: `Inspect water supply points in ${wardId} for ${dominantType} threshold exceedances. Collect fresh samples for laboratory confirmation.`,
      },
      recentFailureCount: failing.length,
      dominantTestType:   dominantType,
      reason: `${failing.length} recent failing observations in the last 7 days exceed the suggestion threshold`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listFieldTasks,
  getFieldTask,
  createFieldTask,
  updateFieldTask,
  assignFieldTask,
  updateFieldTaskStatus,
  suggestFieldTask,
};
