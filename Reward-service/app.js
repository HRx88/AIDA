const path = require('path');
// Load ROOT .env (shared across services)
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.REWARD_SERVICE_PORT || 5007;

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// JWT middleware
const { authenticateJWT } = require('./middleware/authMiddleware');

// Routes
const rewardsRoutes = require('./routes/rewardsRoutes');

// ✅ Health check (NO JWT)
app.get('/health', (req, res) => {
  res.json({
    service: 'Reward-service',
    status: 'running',
    port: PORT
  });
});

// ✅ Protect ALL /api routes with JWT
app.use('/api', authenticateJWT);

// Rewards endpoints (JWT required)
app.use('/api/rewards', rewardsRoutes);

app.listen(PORT, () => {
  console.log(`Reward Service running on http://localhost:${PORT}`);
});

module.exports = app;
