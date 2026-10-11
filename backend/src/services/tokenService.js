const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { env } = require('../config/env');
const { RefreshToken } = require('../models');
const { sha256, durationToMs } = require('../utils/helpers');

const REFRESH_COOKIE = 'sc_rt';
const REFRESH_COOKIE_PATH = '/api/auth';
// Non-secret hint readable by the SPA: tells it a session may exist, so guests never probe /auth/refresh.
const SESSION_HINT_COOKIE = 'sc_session';

const signOpts = (expiresIn) => ({
  algorithm: env.jwt.algorithm,
  expiresIn,
  issuer: env.jwt.issuer,
  audience: env.jwt.audience,
});

// Only the expected algorithm is accepted — tokens declaring "none" or RS256 etc. are rejected.
const verifyOpts = { algorithms: [env.jwt.algorithm], issuer: env.jwt.issuer, audience: env.jwt.audience };

/** Access token: identity + role only. Never put personal or secret data here. */
function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, typ: 'access' }, env.jwt.accessSecret, signOpts(env.jwt.accessExpiresIn));
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwt.accessSecret, verifyOpts);
  if (payload.typ !== 'access') throw new jwt.JsonWebTokenError('wrong token type');
  return payload;
}

function verifyRefreshJwt(token) {
  const payload = jwt.verify(token, env.jwt.refreshSecret, verifyOpts);
  if (payload.typ !== 'refresh') throw new jwt.JsonWebTokenError('wrong token type');
  return payload;
}

/**
 * Issues a refresh JWT and persists only its hash as a session record.
 * @returns {{ token: string, session: import('mongoose').Document }}
 */
async function issueRefreshToken(user, { family, userAgent, ipAddress } = {}) {
  const fam = family || crypto.randomUUID();
  const token = jwt.sign(
    { sub: String(user._id), typ: 'refresh', fam, jti: crypto.randomUUID() },
    env.jwt.refreshSecret,
    signOpts(env.jwt.refreshExpiresIn),
  );
  const session = await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(token),
    family: fam,
    expiresAt: new Date(Date.now() + durationToMs(env.jwt.refreshExpiresIn)),
    userAgent: userAgent ? String(userAgent).slice(0, 512) : undefined,
    ipAddress,
  });
  return { token, session };
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  path: REFRESH_COOKIE_PATH,
  domain: env.cookie.domain,
  maxAge: durationToMs(env.jwt.refreshExpiresIn),
});

function setRefreshCookie(res, token) {
  const opts = cookieOptions();
  res.cookie(REFRESH_COOKIE, token, opts);
  res.cookie(SESSION_HINT_COOKIE, '1', { ...opts, httpOnly: false, path: '/' });
}

function clearRefreshCookie(res) {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
  res.clearCookie(SESSION_HINT_COOKIE, { ...opts, httpOnly: false, path: '/' });
}

async function revokeFamily(family, reason) {
  await RefreshToken.updateMany({ family, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

async function revokeAllForUser(userId, reason) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

module.exports = {
  REFRESH_COOKIE,
  signAccessToken,
  verifyAccessToken,
  verifyRefreshJwt,
  issueRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  revokeFamily,
  revokeAllForUser,
};
