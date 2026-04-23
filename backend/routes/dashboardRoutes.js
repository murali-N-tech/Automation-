const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/stats', requireAuth, getDashboardStats);

module.exports = router;
