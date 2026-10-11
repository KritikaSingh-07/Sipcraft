const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, RefreshToken } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sha256, randomToken } = require('../utils/helpers');
const { env } = require('../config/env');
const tokens = require('../services/tokenService');
const { queueEmail } = require('../services/emailService');
const { ROLES } = require('../utils/constants');
const { ensureEnvAdmin, isEnvAdminEmail } = require('../services/adminBootstrap');

// Compared against when the email doesn't exist, so login timing doesn't reveal registered emails.
let dummyHash;
const getDummyHash = async () => (dummyHash ||= await bcrypt.hash('timing-equaliser', env.bcryptRounds));

const clientMeta = (req) => ({ userAgent: req.get('user-agent'), ipAddress: req.ip });

/** Issues a new access token + refresh session and sets the HttpOnly cookie. */
async function startSession(req, res, user, family) {
  const accessToken = tokens.signAccessToken(user);
  const { token } = await tokens.issueRefreshToken(user, { family, ...clientMeta(req) });
  tokens.setRefreshCookie(res, token);
  return accessToken;
}

/* POST /api/auth/register */
const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists', { code: 'EMAIL_TAKEN' });

  // Role is always decided by the server. Any "role" in the request was stripped by validation.
  const user = await User.create({ name, email, phone, password, role: ROLES.USER });
  const accessToken = await startSession(req, res, user);
  queueEmail(user.email, 'welcome', { name: user.name });

  res.status(201).json({ success: true, message: 'Account created', data: { user: user.toSafeObject(), accessToken } });
});

/* POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Self-heal the .env admin (e.g. deleted or demoted while the server was running).
  if (isEnvAdminEmail(email) && password === env.seed.adminPassword) await ensureEnvAdmin();
  const user = await User.findOne({ email }).select('+password');

  const valid = user ? await user.comparePassword(password) : await bcrypt.compare(password, await getDummyHash());
  if (!user || !valid) throw ApiError.unauthorized('Incorrect email or password', { code: 'INVALID_CREDENTIALS' });
  if (!user.isActive) throw ApiError.forbidden('This account has been disabled. Please contact support.', { code: 'ACCOUNT_DISABLED' });

  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });
  const accessToken = await startSession(req, res, user);

  res.json({ success: true, message: 'Logged in', data: { user: user.toSafeObject(), accessToken } });
});

/* POST /api/auth/refresh — validates, rotates and re-issues. */
const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[tokens.REFRESH_COOKIE];
  const fail = (code = 'REFRESH_INVALID') => {
    tokens.clearRefreshCookie(res);
    return ApiError.unauthorized('Your session has expired. Please sign in again.', { code });
  };
  if (!raw) throw fail('REFRESH_MISSING');

  let payload;
  try {
    payload = tokens.verifyRefreshJwt(raw);
  } catch (err) {
    throw fail(err instanceof jwt.TokenExpiredError ? 'REFRESH_EXPIRED' : 'REFRESH_INVALID');
  }

  const session = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!session || String(session.user) !== payload.sub) throw fail();

  if (session.revokedAt) {
    // A rotated (already used) token was presented again: likely theft. Kill the whole chain.
    if (session.revokedReason === 'rotated') await tokens.revokeFamily(session.family, 'reuse_detected');
    throw fail('REFRESH_REVOKED');
  }
  if (session.expiresAt <= new Date()) throw fail('REFRESH_EXPIRED');

  const user = await User.findById(payload.sub);
  if (!user) throw fail();
  if (!user.isActive) {
    await tokens.revokeAllForUser(user._id, 'account_disabled');
    throw fail('ACCOUNT_DISABLED');
  }

  // Rotate atomically: only one concurrent request can consume this token.
  const { token: newRaw } = await tokens.issueRefreshToken(user, { family: session.family, ...clientMeta(req) });
  const consumed = await RefreshToken.findOneAndUpdate(
    { _id: session._id, revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'rotated', replacedByHash: sha256(newRaw), lastUsedAt: new Date() },
  );
  if (!consumed) {
    await RefreshToken.updateOne({ tokenHash: sha256(newRaw) }, { revokedAt: new Date(), revokedReason: 'race' });
    await tokens.revokeFamily(session.family, 'reuse_detected');
    throw fail('REFRESH_REVOKED');
  }

  tokens.setRefreshCookie(res, newRaw);
  res.json({ success: true, data: { accessToken: tokens.signAccessToken(user), user: user.toSafeObject() } });
});

/* POST /api/auth/logout */
const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[tokens.REFRESH_COOKIE];
  if (raw) {
    await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { revokedAt: new Date(), revokedReason: 'logout' });
  }
  tokens.clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

/* POST /api/auth/logout-all (authenticated) */
const logoutAll = asyncHandler(async (req, res) => {
  await tokens.revokeAllForUser(req.user._id, 'logout_all');
  tokens.clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out from all devices' });
});

/* GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.user.toSafeObject() } });
});

/* GET /api/auth/sessions */
const sessions = asyncHandler(async (req, res) => {
  const list = await RefreshToken.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('userAgent ipAddress createdAt lastUsedAt expiresAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ success: true, data: list });
});

/* POST /api/auth/forgot-password — always returns the same response (no account enumeration). */
const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, isActive: true });
  if (user) {
    const raw = randomToken(32);
    user.passwordResetTokenHash = sha256(raw);
    user.passwordResetExpires = new Date(Date.now() + env.resetExpiresMinutes * 60 * 1000);
    await user.save({ validateModifiedOnly: true });
    queueEmail(user.email, 'passwordReset', {
      name: user.name,
      resetUrl: `${env.clientUrls[0]}/reset-password?token=${raw}`,
      minutes: env.resetExpiresMinutes,
    });
  }
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

/* POST /api/auth/reset-password */
const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    passwordResetTokenHash: sha256(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired', { code: 'RESET_INVALID' });

  user.password = req.body.password;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await tokens.revokeAllForUser(user._id, 'password_reset');
  tokens.clearRefreshCookie(res);
  queueEmail(user.email, 'passwordChanged', { name: user.name });
  res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
});

/* POST /api/auth/change-password (authenticated) */
const changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', { code: 'INVALID_PASSWORD' });
  }
  user.password = req.body.newPassword;
  await user.save();

  // Sign out everywhere, then start a fresh session for this device.
  await tokens.revokeAllForUser(user._id, 'password_changed');
  const accessToken = await startSession(req, res, user);
  queueEmail(user.email, 'passwordChanged', { name: user.name });
  res.json({ success: true, message: 'Password changed. Other devices have been signed out.', data: { accessToken } });
});

module.exports = { register, login, refresh, logout, logoutAll, me, sessions, forgotPassword, resetPassword, changePassword };
