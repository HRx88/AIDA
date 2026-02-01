const express = require('express');
const router = express.Router();
const googleCalendarController = require('../controllers/googleCalendarController');

// Get OAuth authorization URL
router.get('/auth/:userId', googleCalendarController.getAuthUrl);

// OAuth callback handler
router.get('/callback', googleCalendarController.handleCallback);

// Check if user is authenticated
router.get('/check/:userId', googleCalendarController.checkAuth);

// Get events from Google Calendar
router.get('/events/:userId', googleCalendarController.getEvents);

// Create event manually
router.post('/create-event', googleCalendarController.createEvent);

module.exports = router;
