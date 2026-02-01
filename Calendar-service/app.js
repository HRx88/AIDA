const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.CALENDAR_SERVICE_PORT || 5003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const scheduleRoutes = require('./routes/scheduleRoutes');
const taskRoutes = require('./routes/taskRoutes');
const taskLogRoutes = require('./routes/taskLogRoutes');
const pointsRoutes = require('./routes/pointsRoutes');
const googleCalendarRoutes = require('./routes/googleCalendarRoutes');

app.use('/api/schedules', scheduleRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/logs', taskLogRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
// Also mount at /api/google for Google Cloud Console compatibility
app.use('/api/google', googleCalendarRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'Calendar-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
    console.log(`Calendar Service running on http://localhost:${PORT}`);
});

module.exports = app;
