const express = require('express');
const router = express.Router();
const callController = require('../controllers/callController');

// Staff check-in routes
router.post('/checkin', callController.createCheckInCall);

// Emergency call routes
router.post('/emergency', callController.createEmergencyCall);

// Get calls for staff
router.get('/staff/:staffId', callController.getStaffCalls);

// Get calls for client
router.get('/client/:clientId', callController.getClientCalls);

// Update call status
router.patch('/:callId/status', callController.updateCallStatus);

module.exports = router;
