const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Auth-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`Auth Service running on http://localhost:${PORT}`);
});

module.exports = app;
