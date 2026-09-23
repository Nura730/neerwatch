const { Router } = require('express');
const { successResponse } = require('../utils/response');

const router = Router();

router.get('/', (req, res) => {
  successResponse(res, { status: 'ok' });
});

module.exports = router;
