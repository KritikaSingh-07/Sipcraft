const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * CSRF defence for state-changing requests.
 *
 * Layers:
 *  1. The refresh cookie is HttpOnly, SameSite and path-scoped to /api/auth.
 *  2. Every other authenticated API uses a Bearer access token held in memory, which a
 *     cross-site form can never attach — those routes are not CSRF-able.
 *  3. This middleware rejects unsafe requests whose Origin (or Referer) is not a trusted
 *     frontend origin.
 *  4. Cookie-authenticated endpoints (refresh / logout) additionally require the custom
 *     `X-Requested-With` header (see requireCsrfHeader). Custom headers trigger a CORS
 *     preflight, which untrusted origins fail.
 */
const verifyOrigin = (req, res, next) => {
  if (!UNSAFE.has(req.method)) return next();
  const origin = req.get('origin') || originOf(req.get('referer') || '');
  // Non-browser clients (curl, server-to-server, Razorpay webhooks) send no Origin.
  // They also carry no ambient cookies from a victim's browser, so they cannot mount CSRF.
  if (!origin) return next();
  if (env.clientUrls.includes(origin)) return next();
  return next(ApiError.forbidden('Request origin is not allowed', { code: 'CSRF_ORIGIN' }));
};

const requireCsrfHeader = (req, res, next) => {
  if (req.get('x-requested-with') === 'XMLHttpRequest') return next();
  return next(ApiError.forbidden('Missing CSRF header', { code: 'CSRF_HEADER' }));
};

module.exports = { verifyOrigin, requireCsrfHeader };
