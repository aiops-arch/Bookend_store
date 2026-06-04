// Load .env files when present (local dev / Render).
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('dotenv').config();
// Fill non-secret runtime defaults after platform/local env has loaded.
require('./runtime-config');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const db = require('./config/db');

const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const itemsRoutes = require('./routes/items');
const vendorsRoutes = require('./routes/vendors');
const customersRoutes = require('./routes/customers');
const purchaseOrdersRoutes = require('./routes/purchase-orders');
const inwardRoutes = require('./routes/inward');
const outwardRoutes = require('./routes/outward');
const stockTransfersRoutes = require('./routes/stock-transfers');
const batchesRoutes = require('./routes/batches');

const app = express();

app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.CORS_ORIGINS ||
  'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // '*' in ALLOWED_ORIGINS = allow any origin (handy for single-server deploys
    // where the frontend + API share one domain). Auth still guards everything.
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`Origin not allowed by CORS: ${origin}`));
  },
}));

app.use('/api', rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests - slow down a moment.' },
}));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: process.uptime(),
      timestamp: new Date(),
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/inward', inwardRoutes);
app.use('/api/outward', outwardRoutes);
app.use('/api/stock-transfers', stockTransfersRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit-log', require('./routes/audit-log'));
app.use('/api/normalize', require('./routes/normalize'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/tags', require('./routes/tags'));
app.use('/api/custom-fields', require('./routes/custom-fields'));
app.use('/api/system', require('./routes/system'));
app.use('/api/intelligence', require('./routes/intelligence'));
app.use('/api/barcode', require('./routes/barcode'));
app.use('/api/invoices', require('./routes/invoices'));

// Serve the built frontend so ONE service hosts the whole app (great for free
// single-service hosting). Skipped in local dev where Vite serves the frontend.
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '../../frontend/dist');
if (require('fs').existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/(api|uploads)\b).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
