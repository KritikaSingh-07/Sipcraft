const crypto = require('crypto');
const slugify = require('slugify');

const toSlug = (s) => slugify(String(s || ''), { lower: true, strict: true, trim: true });

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/** Constant-time string comparison. */
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const parsePagination = (query, { defaultLimit = 12, maxLimit = 60 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const paginated = (items, total, page, limit) => ({
  items,
  pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: page * limit < total },
});

/** Parses durations like "15m", "7d" or "3600" (seconds) into milliseconds. */
const durationToMs = (value) => {
  const m = String(value).trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const unit = (m[2] || 's').toLowerCase();
  return Number(m[1]) * { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
};

const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const pick = (obj, keys) => keys.reduce((acc, k) => (obj[k] !== undefined ? { ...acc, [k]: obj[k] } : acc), {});

module.exports = { toSlug, sha256, randomToken, safeEqual, escapeRegex, round2, parsePagination, paginated, durationToMs, formatINR, pick };
