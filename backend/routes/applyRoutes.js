const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const applyController = require('../controllers/applyController');

// Mark application as ready for extension-assisted apply flow.
router.post('/start', requireAuth, applyController.applyToJob);
router.post('/auto', requireAuth, applyController.autoApplyToJob);
router.post('/auto/batch', requireAuth, applyController.autoApplyBatch);
router.post('/complete', requireAuth, applyController.completeApplication);
router.get('/context/:applicationId', requireAuth, applyController.getApplyContext);
router.put('/:applicationId/cover-letter', requireAuth, applyController.updateCoverLetter);
router.put('/cover-letter', requireAuth, applyController.updateCoverLetter);

module.exports = router;
