const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const { env } = require('./config/env');
const routes = require('./routes');
const { razorpayWebhook } = require('./webhooks/razorpayWebhook');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { xssClean, noSqlSanitize } = require('./middlewares/sanitize');
const { verifyOrigin } = require('./middlewares/csrf');
const { apiLimiter } = require('./middlewares/rateLimiters');
const { UPLOAD_ROOT } = require('./services/uploadService');

const app = express();

app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', env.trustProxy);

const sharedHelmet = {
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: env.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  frameguard: { action: 'deny' },
  noSniff: true,
};

/* API responses are JSON only, so their CSP is maximally strict. */
const apiHelmet = helmet({
  ...sharedHelmet,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] },
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
});

/* When this server also hosts the built SPA (SERVE_CLIENT=true): a CSP that allows exactly what the storefront needs. */
const clientHelmet = helmet({
  ...sharedHelmet,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://res.cloudinary.com', 'https://*.razorpay.com'],
      connectSrc: ["'self'", 'https://*.razorpay.com'],
      frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: env.isProd ? [] : null,
    },
  },
});

app.use((req, res, next) => (req.path.startsWith('/api') || req.path.startsWith('/uploads') || !env.serveClient ? apiHelmet : clientHelmet)(req, res, next));

/* CORS: only trusted frontend origins, credentials allowed for the refresh cookie. */
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 600,
  }),
);

app.use(compression());
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

/* Razorpay webhook needs the raw body for signature verification — mount before JSON parsing. */
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook);

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(cookieParser());
app.use(noSqlSanitize);
app.use(xssClean);

app.use('/api', apiLimiter, verifyOrigin, routes);

// Locally stored uploads (used when Cloudinary isn't configured). Images only, never executable.
app.use(
  '/uploads',
  helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }),
  express.static(UPLOAD_ROOT, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny', setHeaders: (res) => res.set('X-Content-Type-Options', 'nosniff') }),
);

if (env.serveClient) {
  // Single-service deployment: serve the built React app and fall back to index.html for client routes.
  const clientDist = path.resolve(__dirname, '../../frontend/dist');
  app.use(express.static(clientDist, { index: false, maxAge: '1y', immutable: true, setHeaders: (res, file) => file.endsWith('.html') && res.set('Cache-Control', 'no-cache') }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.set('Cache-Control', 'no-cache').sendFile(path.join(clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.json({ success: true, name: 'Sipcraft API', docs: '/api/health' }));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
