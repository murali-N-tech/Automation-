const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const applyController = require('../controllers/applyController');

// Mark application as ready for extension-assisted apply flow.
router.post('/start', requireAuth, applyController.applyToJob);
router.post('/complete', requireAuth, applyController.completeApplication);
router.get('/context/:applicationId', requireAuth, applyController.getApplyContext);

module.exports = router;