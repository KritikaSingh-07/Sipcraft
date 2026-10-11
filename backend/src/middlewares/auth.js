const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../services/tokenService');
const { User } = require('../models');
const { ROLES } = require('../utils/constants');

const readBearer = (req) => {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme && scheme.toLowerCase() === 'bearer' && token ? token.trim() : null;
};

/** Resolves the user for a request, or throws a generic 401 ApiError. */
async function authenticate(req) {
  const token = readBearer(req);
  if (!token) throw ApiError.unauthorized('Authentication required', { code: 'TOKEN_MISSING' });

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
    throw ApiError.unauthorized('Invalid authentication', { code: 'TOKEN_INVALID' });
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Invalid authentication', { code: 'TOKEN_INVALID' });
  if (!user.isActive) throw ApiError.unauthorized('This account has been disabled', { code: 'ACCOUNT_DISABLED' });
  if (user.changedPasswordAfter(payload.iat)) throw ApiError.unauthorized('Session expired', { code: 'TOKEN_EXPIRED' });
  return user;
}

/** Requires a valid access token; attaches the user document to req.user. */
const protect = async (req, res, next) => {
  try {
    req.user = await authenticate(req);
    next();
  } catch (err) {
    next(err);
  }
};
const requireAuth = protect;

/** Attaches req.user when a valid token is present but never fails the request. */
const optionalAuth = async (req, res, next) => {
  if (!readBearer(req)) return next();
  try {
    req.user = await authenticate(req);
  } catch {
    req.user = undefined;
  }
  next();
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

const requireAdmin = [protect, requireRole(ROLES.ADMIN)];

module.exports = { protect, requireAuth, optionalAuth, requireRole, requireAdmin };
