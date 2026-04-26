const express = require('express');

const { requireAuth } = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/job-analysis', requireAuth, aiController.analyzeJob);
router.post('/match', requireAuth, aiController.analyzeJob);
router.post('/optimize-resume', requireAuth, aiController.optimizeResume);
router.post('/optimize', requireAuth, aiController.optimizeResume);
router.post('/cover-letter', requireAuth, aiController.generateCoverLetter);
router.post('/skill-gap', requireAuth, aiController.analyzeSkillGap);

module.exports = router;
