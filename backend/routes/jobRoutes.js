const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobController');

// Trigger scraping / fetch jobs
router.post('/sync', requireAuth, jobController.syncJobs);

// Generate matches mapping jobs to recent resume
router.post('/match', requireAuth, jobController.matchJobs);
router.post('/full-auto', requireAuth, jobController.runFullAutomation);

// Get recommended jobs for user based on decision engine
router.get('/recommendations', requireAuth, jobController.getRecommendations);

module.exports = router;
