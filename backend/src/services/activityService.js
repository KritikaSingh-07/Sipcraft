const AdminActivity = require('../models/AdminActivity');
const logger = require('../utils/logger');

/**
 * Records an admin action. Never throws — auditing must not break the action itself,
 * but failures are logged loudly so gaps are noticed.
 */
async function logActivity(req, { action, entity, entityId, description, metadata }) {
  try {
    if (!req.user) return;
    await AdminActivity.create({
      admin: req.user._id,
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      description: description?.slice(0, 500),
      metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 512),
    });
  } catch (err) {
    logger.error('Failed to record admin activity:', err.message);
  }
}

module.exports = { logActivity };
