const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Set default timezone to Singapore for consistent date handling
process.env.TZ = 'Asia/Singapore';

const CallModel = require('./models/callModel');
const app = express();
const PORT = process.env.VIDEO_SERVICE_PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

const { authenticateJWT } = require('./middleware/authMiddleware');

// Routes (API only - no views)
const callRoutes = require('./routes/callRoutes');
app.use('/api/calls', authenticateJWT, callRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Video-call-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Video Call Service (API) running on http://0.0.0.0:${PORT}`);

    // Start auto-expiry background task (runs every 1 minute)
    setInterval(() => {
        CallModel.autoExpireStaleCalls().catch(err => console.error('[Auto-Expiry Error]', err));
    }, 60000);
});

module.exports = app;
