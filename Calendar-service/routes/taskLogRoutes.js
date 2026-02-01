const express = require('express');
const router = express.Router();
const taskLogController = require('../controllers/taskLogController');

// Mark task as complete (DONE button - main cloud logging endpoint)
router.post('/complete', taskLogController.completeTask);

// Get today's task status for a user
router.get('/today/:userId', taskLogController.getTodayStatus);

// Get logs for a specific date
router.get('/user/:userId/date/:date', taskLogController.getLogsByDate);

// Get logs for a week
router.get('/user/:userId/week/:weekStart', taskLogController.getLogsByWeek);

// Get completion statistics
router.get('/stats/:userId', taskLogController.getStats);

module.exports = router;
