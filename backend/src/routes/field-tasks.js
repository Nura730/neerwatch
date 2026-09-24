const { Router } = require('express');
const {
  listFieldTasks,
  getFieldTask,
  createFieldTask,
  updateFieldTask,
  assignFieldTask,
  updateFieldTaskStatus,
  suggestFieldTask,
} = require('../controllers/fieldTaskController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = Router();

// Suggestion endpoint (public read, no auth required) — must be before /:id
router.get('/suggest', suggestFieldTask);

// Read endpoints — publicly accessible (consistent with other GET routes)
router.get('/',    listFieldTasks);
router.get('/:id', getFieldTask);

// Write endpoints — operator and admin only
router.post('/',                requireAuth, requireRole('operator', 'admin'), createFieldTask);
router.patch('/:id',            requireAuth, requireRole('operator', 'admin'), updateFieldTask);
router.patch('/:id/assign',     requireAuth, requireRole('operator', 'admin'), assignFieldTask);
router.patch('/:id/status',     requireAuth, requireRole('operator', 'admin'), updateFieldTaskStatus);

module.exports = router;
