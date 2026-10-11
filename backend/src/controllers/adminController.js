/* Admin customer management. Dashboard/analytics live in analyticsController. */
const mongoose = require('mongoose');
const { User, Order, Address } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { parsePagination, paginated, escapeRegex } = require('../utils/helpers');
const { revokeAllForUser } = require('../services/tokenService');
const { PAYMENT_STATUS } = require('../utils/constants');

/* GET /api/admin/customers */
const listCustomers = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = parsePagination(q, { defaultLimit: 20 });
  const filter = {};
  if (!q.role || q.role === 'user') filter.role = 'user';
  else if (q.role === 'admin') filter.role = 'admin';
  if (q.status === 'active') filter.isActive = true;
  if (q.status === 'inactive') filter.isActive = false;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const stats = await Order.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, paymentStatus: PAYMENT_STATUS.PAID } },
    { $group: { _id: '$user', orders: { $sum: 1 }, spent: { $sum: '$total' }, lastOrderAt: { $max: '$createdAt' } } },
  ]);
  const byUser = new Map(stats.map((s) => [String(s._id), s]));
  const items = users.map(({ password, passwordResetTokenHash, passwordResetExpires, ...u }) => ({
    ...u,
    orders: byUser.get(String(u._id))?.orders || 0,
    totalSpent: byUser.get(String(u._id))?.spent || 0,
    lastOrderAt: byUser.get(String(u._id))?.lastOrderAt || null,
  }));
  res.json({ success: true, data: paginated(items, total, page, limit) });
});

/* GET /api/admin/customers/:id */
const getCustomer = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Customer not found');
  const [orders, addresses, stats] = await Promise.all([
    Order.find({ user: user._id, paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } })
      .select('orderNumber total orderStatus paymentStatus createdAt items')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Address.find({ user: user._id }).lean(),
    Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(user._id)), paymentStatus: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, orders: { $sum: 1 }, spent: { $sum: '$total' } } },
    ]),
  ]);
  res.json({ success: true, data: { user: user.toSafeObject(), orders, addresses, stats: { orders: stats[0]?.orders || 0, spent: stats[0]?.spent || 0 } } });
});

/* PATCH /api/admin/customers/:id { isActive?, role? } */
const updateCustomer = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own account status or role');
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Customer not found');
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  if (req.body.role !== undefined) user.role = req.body.role;
  await user.save({ validateModifiedOnly: true });
  // Disabling (or changing role) revokes every session; access tokens are rejected on the next request.
  if (req.body.isActive === false || req.body.role !== undefined) await revokeAllForUser(user._id, req.body.isActive === false ? 'account_disabled' : 'role_changed');
  await logActivity(req, {
    action: req.body.isActive === false ? 'user.disabled' : req.body.isActive === true ? 'user.enabled' : 'user.role_changed',
    entity: 'user',
    entityId: user._id,
    description: `${user.email}: ${req.body.isActive === false ? 'disabled' : req.body.isActive === true ? 're-activated' : `role → ${user.role}`}`,
  });
  res.json({
    success: true,
    message: req.body.isActive === false ? 'Account disabled and signed out everywhere' : req.body.isActive === true ? 'Account re-activated' : 'Customer updated',
    data: user.toSafeObject(),
  });
});

module.exports = { listCustomers, getCustomer, updateCustomer };
