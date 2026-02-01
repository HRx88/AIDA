const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.FRONTEND_PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (views)
app.use(express.static('views'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Frontend-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`Frontend Service running on http://localhost:${PORT}`);
});

module.exports = app;
