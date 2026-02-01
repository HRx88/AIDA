const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.VIDEO_SERVICE_PORT || 5002;

// Middleware
app.use(cors());
app.use(express.json());

// Routes (API only - no views)
const callRoutes = require('./routes/callRoutes');
app.use('/api/calls', callRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Video-call-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`Video Call Service (API) running on http://localhost:${PORT}`);
});

module.exports = app;
