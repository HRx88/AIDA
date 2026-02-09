const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[AUTH] Incoming: ${req.method} ${req.url}`);
    next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Auth-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Auth Service running on http://0.0.0.0:${PORT}`);
});

module.exports = app;
