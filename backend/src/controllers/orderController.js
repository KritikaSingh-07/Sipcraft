const { Order, Payment, Review } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, paginated, escapeRegex } = require('../utils/helpers');
const { ORDER_STATUS, PAYMENT_STATUS, ORDER_TRANSITIONS } = require('../utils/constants');
const orderService = require('../services/orderService');
const { notify, notifyAdmins } = require('../services/notificationService');
const { getSettings } = require('../services/settingsService');
const { logActivity } = require('../services/activityService');

const returnWindowDays = async () => (await getSettings()).returnWindowDays ?? 7;

// Abandoned checkouts (cancelled before any payment) are hidden from the customer's history.
const visibleToCustomer = {
  $nor: [{ orderStatus: ORDER_STATUS.CANCELLED, paymentStatus: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED] } }],
};

/* GET /api/orders */
const myOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });
  const filter = { user: req.user._id, ...visibleToCustomer };
  if (req.query.status === 'active') {
    filter.orderStatus = { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY] };
  } else if (req.query.status && ORDER_STATUS[req.query.status]) filter.orderStatus = req.query.status;

  const [items, total] = await Promise.all([
    Order.find(filter)
      .select('orderNumber items total orderStatus paymentStatus createdAt reservationExpiresAt stockReserved')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, page, limit) });
});

const loadOrderFor = async (req) => {
  const isAdmin = req.user.role === 'admin';
  const filter = { _id: req.params.id };
  if (!isAdmin) filter.user = req.user._id; // ownership check
  const order = await Order.findOne(filter);
  if (!order) throw ApiError.notFound('Order not found');
  return order;
};

/* GET /api/orders/:id */
const getOrder = asyncHandler(async (req, res) => {
  const order = await loadOrderFor(req);
  await order.populate([
    { path: 'payment', select: 'razorpayOrderId razorpayPaymentId status method amount createdAt refundId' },
    ...(req.user.role === 'admin' ? [{ path: 'user', select: 'name email phone createdAt isActive' }] : []),
  ]);
  const reviews = await Review.find({ order: order._id, user: order.user._id || order.user }).select('product rating').lean();
  const data = order.toObject();
  data.reviewedProducts = reviews.map((r) => String(r.product));
  data.canCancel = ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'PROCESSING'].includes(order.orderStatus);
  const windowDays = await returnWindowDays();
  data.returnWindowDays = windowDays;
  data.canReturn =
    order.orderStatus === ORDER_STATUS.DELIVERED && Boolean(order.deliveredAt) && Date.now() - new Date(order.deliveredAt).getTime() < windowDays * 86400000;
  data.canRetryPayment =
    order.orderStatus === ORDER_STATUS.PENDING_PAYMENT && order.stockReserved && order.reservationExpiresAt > new Date();
  if (req.user.role === 'admin') data.allowedTransitions = ORDER_TRANSITIONS[order.orderStatus] || [];
  res.json({ success: true, data });
});

/* PUT /api/orders/:id/cancel */
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');
  const updated = await orderService.cancelOrder(order, { by: req.user._id, reason: req.body.reason || 'Cancelled by customer' });
  res.json({ success: true, message: 'Order cancelled', data: updated });
});

/* POST /api/orders/:id/return */
const requestReturn = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.orderStatus !== ORDER_STATUS.DELIVERED) throw ApiError.badRequest('Only delivered orders can be returned');
  const windowDays = await returnWindowDays();
  if (!order.deliveredAt || Date.now() - order.deliveredAt.getTime() > windowDays * 86400000) {
    throw ApiError.badRequest(`Returns are accepted within ${windowDays} days of delivery`);
  }
  order.orderStatus = ORDER_STATUS.RETURN_REQUESTED;
  order.statusHistory.push({ status: ORDER_STATUS.RETURN_REQUESTED, note: req.body.reason, by: req.user._id });
  await order.save();
  await notify(order.user, {
    type: 'order',
    title: 'Return requested',
    message: `We've received your return request for ${order.orderNumber}. Our team will arrange a pickup within 2 business days.`,
    link: `/orders/${order._id}`,
  });
  await notifyAdmins({ type: 'order', title: `Return requested · ${order.orderNumber}`, message: req.body.reason, link: `/admin/refunds` });
  res.json({ success: true, message: 'Return requested', data: order });
});

/* ─── Admin ────────────────────────────────────────────── */

/* GET /api/admin/orders */
const adminListOrders = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = parsePagination(q, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (q.status && q.status !== 'all') filter.orderStatus = q.status;
  else filter.orderStatus = { $ne: ORDER_STATUS.PENDING_PAYMENT };
  if (q.paymentStatus && q.paymentStatus !== 'all') filter.paymentStatus = q.paymentStatus;
  if (q.user) filter.user = q.user;
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = q.from;
    if (q.to) filter.createdAt.$lte = new Date(new Date(q.to).setHours(23, 59, 59, 999));
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ orderNumber: rx }, { 'contact.email': rx }, { 'contact.name': rx }, { 'shippingAddress.phone': rx }, { trackingNumber: rx }];
  }

  const [items, total, statusCounts] = await Promise.all([
    Order.find(filter)
      .select('orderNumber user contact items total orderStatus paymentStatus createdAt shippingAddress.city refundStatus stockConflict')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
  ]);
  res.json({
    success: true,
    data: { ...paginated(items, total, page, limit), statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.count])) },
  });
});

/* PUT /api/admin/orders/:id/status */
const adminUpdateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  const from = order.orderStatus;
  const updated = await orderService.updateOrderStatus(order, { ...req.body, by: req.user._id });
  await logActivity(req, { action: 'order.status_changed', entity: 'order', entityId: order._id, description: `${order.orderNumber}: ${from} → ${updated.orderStatus}${req.body.trackingNumber ? ` (tracking ${req.body.trackingNumber})` : ''}` });
  res.json({ success: true, message: `Order marked ${updated.orderStatus.replace(/_/g, ' ').toLowerCase()}`, data: updated });
});

/* POST /api/admin/orders/:id/refund — retry/record a refund for a cancelled or returned paid order */
const adminRefund = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentStatus !== PAYMENT_STATUS.PAID) throw ApiError.badRequest('Only paid orders can be refunded');
  if (![ORDER_STATUS.CANCELLED, ORDER_STATUS.RETURNED].includes(order.orderStatus)) {
    throw ApiError.badRequest('Cancel the order or mark it returned before refunding');
  }
  if (req.body.manual) {
    // Admin confirms a refund processed outside Razorpay (e.g. bank transfer).
    order.paymentStatus = PAYMENT_STATUS.REFUNDED;
    order.refundStatus = 'processed';
    order.refundAmount = order.total;
    order.refundedAt = new Date();
    if (order.payment) await Payment.updateOne({ _id: order.payment }, { status: PAYMENT_STATUS.REFUNDED, refundedAt: new Date() });
  } else {
    const result = await orderService.refundOrder(order, { note: 'Refund issued by store' });
    if (!result.ok) {
      await order.save();
      throw ApiError.badRequest(result.reason);
    }
  }
  order.statusHistory.push({ status: order.orderStatus, note: 'Refund processed', by: req.user._id });
  await order.save();
  await logActivity(req, { action: req.body.manual ? 'refund.manual' : 'refund.processed', entity: 'order', entityId: order._id, description: `Refunded ₹${order.total} for ${order.orderNumber}${req.body.manual ? ' (recorded manually)' : ' via Razorpay'}` });
  await notify(order.user, { type: 'payment', title: 'Refund processed', message: `Your refund for ${order.orderNumber} has been processed.`, link: `/orders/${order._id}` });
  res.json({ success: true, message: 'Refund processed', data: order });
});

/* PUT /api/admin/orders/:id/notes */
const adminUpdateNotes = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { adminNotes: String(req.body.adminNotes || '').slice(0, 2000) },
    { returnDocument: 'after' },
  );
  if (!order) throw ApiError.notFound('Order not found');
  res.json({ success: true, message: 'Notes saved', data: order });
});

module.exports = { myOrders, getOrder, cancelMyOrder, requestReturn, adminListOrders, adminUpdateStatus, adminRefund, adminUpdateNotes };
