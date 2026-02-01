const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');

// Create a new schedule
router.post('/', scheduleController.createSchedule);

// Get all schedules for a user
router.get('/user/:userId', scheduleController.getSchedulesByUser);

// Get current week's schedule for a user
router.get('/current/:userId', scheduleController.getCurrentSchedule);

// Get schedule by ID
router.get('/:id', scheduleController.getScheduleById);

// Update a schedule
router.put('/:id', scheduleController.updateSchedule);

// Delete a schedule
router.delete('/:id', scheduleController.deleteSchedule);

// Generate AI schedule from routines
router.post('/generate/:userId', scheduleController.generateAISchedule);

// Sync schedule to Google Calendar
router.post('/:id/sync', scheduleController.syncToGoogleCalendar);

module.exports = router;
