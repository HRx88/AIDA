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
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5006';
const VIDEO_SERVICE_URL = process.env.VIDEO_SERVICE_URL || 'http://localhost:5002';
const PET_SERVICE_URL = process.env.PET_SERVICE_URL || 'http://localhost:5004';

// Proxy Error Handler
const proxyErrorHandler = (err, req, res) => {
  console.error(`[PROXY ERROR] Target: ${req.url} -> ${err.message}`);
  res.status(502).json({
    message: 'Proxy error: Could not reach backend service',
    error: err.message,
    path: req.url
  });
};

// Common Proxy Config
const commonProxyOptions = {
  changeOrigin: true,
  logLevel: 'debug',
  timeout: 120000,
  proxyTimeout: 120000,
  onError: proxyErrorHandler,
  onProxyRes: (proxyRes, req, res) => {
    // Log the actual response status from backend
    if (proxyRes.statusCode >= 400) {
      console.warn(`[PROXY WARN] ${req.method} ${req.url} -> Backend returned ${proxyRes.statusCode}`);
    }
  }
};

// ✅ IMPORTANT: Proxy FIRST (before express.json)
app.use(
  '/calendar',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: CALENDAR_BASE_URL,
    pathRewrite: { '^/calendar': '' },
  })
);

app.use(
  '/auth',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: AUTH_SERVICE_URL,
    pathRewrite: { '^/auth': '' },
  })
);

app.use(
  '/calls',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: VIDEO_SERVICE_URL,
    pathRewrite: { '^/calls': '' },
  })
);

app.use(
  '/pet',
  createProxyMiddleware({
    ...commonProxyOptions,
    target: PET_SERVICE_URL,
    pathRewrite: { '^/pet': '' },
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

app.get('/health', (req, res) => {
  res.json({ service: 'Frontend-service', status: 'running', port: PORT });
});

// Start server
app.listen(PORT, () => {
  console.log(`Frontend Service running on http://localhost:${PORT}`);
  console.log('[FRONTEND] Proxies Configured:');
  console.log(`  /auth     -> ${AUTH_SERVICE_URL}`);
  console.log(`  /calendar -> ${CALENDAR_BASE_URL}`);
  console.log(`  /calls    -> ${VIDEO_SERVICE_URL}`);
  console.log(`  /pet      -> ${PET_SERVICE_URL}`);
});

module.exports = app;
