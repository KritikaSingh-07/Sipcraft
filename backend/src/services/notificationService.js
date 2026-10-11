const { Notification, User } = require('../models');
const logger = require('../utils/logger');

/** Creates an in-app notification. Failures are logged, never thrown into the main flow. */
async function notify(userId, { type = 'order', title, message, link }) {
  try {
    return await Notification.create({ user: userId, type, title, message, link });
  } catch (err) {
    logger.error('Failed to create notification', err.message);
    return null;
  }
}

/** In-app alert to every active admin (new orders, messages, return requests). */
async function notifyAdmins({ type = 'order', title, message, link }) {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    if (admins.length) await Notification.insertMany(admins.map((a) => ({ user: a._id, type, title, message, link })));
  } catch (err) {
    logger.error('Failed to notify admins', err.message);
  }
}

module.exports = { notify, notifyAdmins };
