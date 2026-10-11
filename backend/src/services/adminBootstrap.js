const { env } = require('../config/env');
const { User } = require('../models');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Makes sure the admin account described by ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME in .env
 * exists and can sign in with exactly those credentials — no seed script needed.
 *
 * - Missing account   → created with role "admin".
 * - Existing account  → promoted to admin, re-activated, and its password re-synced to
 *                       ADMIN_PASSWORD if it differs (so .env stays the source of truth).
 *
 * Safe to call repeatedly; it only writes when something is out of sync.
 */
async function ensureEnvAdmin() {
  const email = (env.seed.adminEmail || '').trim().toLowerCase();
  const password = env.seed.adminPassword || '';
  if (!email || !password) return null;
  if (password.length < 8) {
    logger.warn('ADMIN_PASSWORD must be at least 8 characters — the .env admin account was not set up.');
    return null;
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const created = await User.create({ name: env.seed.adminName || 'Store Admin', email, password, role: ROLES.ADMIN });
    logger.info(`Admin account created for ${email} (credentials from .env)`);
    return created;
  }

  let changed = false;
  if (user.role !== ROLES.ADMIN) {
    user.role = ROLES.ADMIN;
    changed = true;
  }
  if (!user.isActive) {
    user.isActive = true;
    changed = true;
  }
  if (!(await user.comparePassword(password))) {
    user.password = password; // hashed by the model's pre-save hook
    changed = true;
  }
  if (changed) {
    await user.save();
    logger.info(`Admin account ${email} synced with .env`);
  }
  return user;
}

/** True when `email` is the admin email configured in .env. */
const isEnvAdminEmail = (email) => Boolean(env.seed.adminEmail) && String(email || '').trim().toLowerCase() === env.seed.adminEmail.trim().toLowerCase();

module.exports = { ensureEnvAdmin, isEnvAdminEmail };
