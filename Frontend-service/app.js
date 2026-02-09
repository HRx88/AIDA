const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.FRONTEND_PORT || 5001;

// Middleware
app.use(cors());
//app.use(express.json());

// Proxy calendar-service through this frontend server
// Browser calls:  /calendar/api/...
// This forwards to: http://calendar-service:5003/api/...  (docker)
// or http://localhost:5003/api/... (local)
const CALENDAR_BASE_URL = process.env.CALENDAR_BASE_URL || 'http://localhost:5003';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || 'http://localhost:5002';
const PET_SERVICE_URL = process.env.PET_SERVICE_URL || 'http://localhost:5004';



// ✅ IMPORTANT: Proxy FIRST (before express.json)
app.use(
  '/calendar',
  createProxyMiddleware({
    target: CALENDAR_BASE_URL,
    changeOrigin: true,
    pathRewrite: { '^/calendar': '' }, // /calendar/api/... -> /api/...
    logLevel: 'debug',

    // ✅ Prevent random 408 timeouts
    timeout: 120000,
    proxyTimeout: 120000,
  })
);

app.use(
  '/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/auth': '' },
    logLevel: 'debug',
    timeout: 120000,
    proxyTimeout: 120000,
  })
);

app.use(
  '/calls',
  createProxyMiddleware({
    target: VIDEO_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/calls': '' },
    logLevel: 'debug',
    timeout: 120000,
    proxyTimeout: 120000,
  })
);

// ✅ Only parse JSON for your own frontend routes AFTER proxy
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (views)
app.use(express.static('views'));
app.use('/js', express.static('js'));
app.use('/css', express.static('css'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Health check
app.use(
  '/pet',
  createProxyMiddleware({
    target: PET_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/pet': '' },
    logLevel: 'debug',
    timeout: 120000,
    proxyTimeout: 120000,
  })
);

app.get('/health', (req, res) => {
  res.json({ service: 'Frontend-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`Frontend Service running on http://localhost:${PORT}`);
  console.log(`Proxying /calendar -> ${CALENDAR_BASE_URL}`);
});

module.exports = app;
