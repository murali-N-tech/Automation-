const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const applyController = require('../controllers/applyController');

// Trigger puppeteer to open and fill a job app form.
router.post('/start', requireAuth, applyController.applyToJob);

module.exports = router;