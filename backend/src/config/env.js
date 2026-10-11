const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes'].includes(String(v).toLowerCase()));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: num(process.env.PORT, 5000),
  trustProxy: num(process.env.TRUST_PROXY, 0),
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  // Public origin of this API, used to build URLs for locally stored uploads.
  // Leave empty when the frontend proxies /uploads to the API (same domain).
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),
  mongoUri: process.env.MONGO_URI || '',
  useMemoryDb: bool(process.env.USE_MEMORY_DB) && !isProd,
  // Serve frontend/dist from this server (single-service deployment).
  serveClient: bool(process.env.SERVE_CLIENT),

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'sipcraft-api',
    audience: process.env.JWT_AUDIENCE || 'sipcraft-web',
    algorithm: 'HS256',
  },

  cookie: {
    sameSite: (process.env.COOKIE_SAMESITE || 'strict').toLowerCase(),
    secure: bool(process.env.COOKIE_SECURE, isProd),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  bcryptRounds: num(process.env.BCRYPT_SALT_ROUNDS, 12),
  resetExpiresMinutes: num(process.env.PASSWORD_RESET_EXPIRES_MINUTES, 15),

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'sipcraft',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: num(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Sipcraft <hello@sipcraft.in>',
    adminNotify: process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || '',
  },

  store: {
    currency: process.env.CURRENCY || 'INR',
    freeShippingThreshold: num(process.env.FREE_SHIPPING_THRESHOLD, 999),
    shippingFee: num(process.env.SHIPPING_FEE, 79),
    taxRate: num(process.env.TAX_RATE, 18),
    paymentHoldMinutes: num(process.env.PAYMENT_HOLD_MINUTES, 20),
  },

  seed: {
    adminName: process.env.ADMIN_NAME || 'Store Admin',
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    userPassword: process.env.SEED_USER_PASSWORD || '',
  },
};

if (!['lax', 'strict', 'none'].includes(env.cookie.sameSite)) env.cookie.sameSite = 'strict';
// Browsers reject SameSite=None cookies that are not Secure.
if (env.cookie.sameSite === 'none') env.cookie.secure = true;

function assertEnv() {
  const problems = [];
  if (!env.jwt.accessSecret || env.jwt.accessSecret.length < 32) problems.push('JWT_ACCESS_SECRET must be set (at least 32 characters)');
  if (!env.jwt.refreshSecret || env.jwt.refreshSecret.length < 32) problems.push('JWT_REFRESH_SECRET must be set (at least 32 characters)');
  if (env.jwt.accessSecret && env.jwt.accessSecret === env.jwt.refreshSecret) problems.push('JWT access and refresh secrets must differ');
  if (!env.mongoUri && !env.useMemoryDb) problems.push('MONGO_URI must be set (or USE_MEMORY_DB=true in development)');
  if (problems.length) {
    const err = new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    err.isConfigError = true;
    throw err;
  }
}

env.features = {
  payments: () => Boolean(env.razorpay.keyId && env.razorpay.keySecret),
  uploads: () => Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret),
  smtp: () => Boolean(env.smtp.host),
};

module.exports = { env, assertEnv };
