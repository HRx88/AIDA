const express = require('express');
const router = express.Router();
const pointsController = require('../controllers/pointsController');

// Get user's point balance
router.get('/:userId', pointsController.getBalance);

// Get user's points history
router.get('/:userId/history', pointsController.getHistory);

// Get points breakdown by category
router.get('/:userId/breakdown', pointsController.getBreakdownByCategory);

// Get leaderboard
router.get('/leaderboard/all', pointsController.getLeaderboard);

module.exports = router;
