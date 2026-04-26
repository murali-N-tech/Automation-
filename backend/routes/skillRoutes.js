const express = require('express');

const { requireAuth } = require('../middleware/authMiddleware');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/', requireAuth, aiController.analyzeSkillGap);
router.post('/gap', requireAuth, aiController.analyzeSkillGap);

module.exports = router;
