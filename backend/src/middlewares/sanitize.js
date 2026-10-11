const mongoSanitize = require('express-mongo-sanitize');
const { filterXSS } = require('xss');

// Fields that legitimately contain secrets or need to be preserved byte-for-byte.
const SKIP_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'confirmPassword', 'token', 'razorpay_signature']);

const xssOptions = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] };

function clean(value, key) {
  if (typeof value === 'string') return SKIP_KEYS.has(key) ? value : filterXSS(value, xssOptions);
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    for (const k of Object.keys(value)) value[k] = clean(value[k], k);
  }
  return value;
}

/** Strips HTML/script markup from all incoming string input. */
const xssClean = (req, res, next) => {
  if (req.body && !Buffer.isBuffer(req.body)) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  if (req.query) req.query = clean(req.query);
  next();
};

/** Removes keys beginning with "$" or containing "." to prevent NoSQL operator injection. */
const noSqlSanitize = mongoSanitize({ replaceWith: '_' });

module.exports = { xssClean, noSqlSanitize };
