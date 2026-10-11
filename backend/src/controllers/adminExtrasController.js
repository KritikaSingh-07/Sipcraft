/* Admin features: activity log, refunds, page content, customer notifications, search, message replies. */
const { AdminActivity, Order, Product, User, Notification, ContactMessage, SiteContent } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { parsePagination, paginated, escapeRegex } = require('../utils/helpers');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const orderService = require('../services/orderService');
const { notify } = require('../services/notificationService');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../services/activityService');
const { contentSchemas, CONTENT_DEFAULTS } = require('../validators/content');

/* ─── Activity log ─────────────────────────────────────── */
const listActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30, maxLimit: 100 });
  const filter = {};
  if (req.query.entity && req.query.entity !== 'all') filter.entity = String(req.query.entity);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search)), 'i');
    filter.$or = [{ description: rx }, { action: rx }];
  }
  const [items, total, entities] = await Promise.all([
    AdminActivity.find(filter).populate('admin', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminActivity.countDocuments(filter),
    AdminActivity.distinct('entity'),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, page, limit), entities } });
});

/* ─── Refunds & returns ────────────────────────────────── */
const REFUND_FILTERS = {
  requested: { orderStatus: ORDER_STATUS.RETURN_REQUESTED },
  pending: { refundStatus: { $in: ['pending', 'failed'] } },
  processed: { refundStatus: 'processed' },
  all: { $or: [{ orderStatus: ORDER_STATUS.RETURN_REQUESTED }, { refundStatus: { $ne: 'none' } }] },
};

const listRefunds = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = REFUND_FILTERS[req.query.status] || REFUND_FILTERS.all;
  const [items, total, summary] = await Promise.all([
    Order.find(filter)
      .select('orderNumber contact total orderStatus paymentStatus refundStatus refundAmount refundedAt statusHistory createdAt updatedAt')
      .populate('payment', 'razorpayPaymentId refundId')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
    Promise.all([
      Order.countDocuments(REFUND_FILTERS.requested),
      Order.countDocuments(REFUND_FILTERS.pending),
      Order.aggregate([{ $match: REFUND_FILTERS.processed }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: { $ifNull: ['$refundAmount', '$total'] } } } }]),
    ]),
  ]);
  const withReason = items.map((o) => ({
    ...o,
    returnReason: [...(o.statusHistory || [])].reverse().find((h) => h.status === ORDER_STATUS.RETURN_REQUESTED)?.note,
    statusHistory: undefined,
  }));
  res.json({
    success: true,
    data: {
      ...paginated(withReason, total, page, limit),
      summary: { requested: summary[0], pending: summary[1], processedCount: summary[2][0]?.n || 0, processedAmount: summary[2][0]?.amount || 0 },
    },
  });
});

/** Approve: a return request becomes RETURNED (restock + Razorpay refund); a failed/pending refund is retried. */
const approveRefund = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  let message;
  if (order.orderStatus === ORDER_STATUS.RETURN_REQUESTED) {
    await orderService.updateOrderStatus(order, { status: ORDER_STATUS.RETURNED, note: req.body.note || 'Return approved', by: req.user._id });
    message = order.refundStatus === 'processed' ? 'Return approved and refund issued' : 'Return approved — refund needs attention';
  } else if (order.paymentStatus === PAYMENT_STATUS.PAID && ['pending', 'failed'].includes(order.refundStatus)) {
    const result = await orderService.refundOrder(order, { note: 'Refund approved by store' });
    order.statusHistory.push({ status: order.orderStatus, note: result.ok ? 'Refund processed' : `Refund attempt failed: ${result.reason}`, by: req.user._id });
    await order.save();
    if (!result.ok) throw ApiError.badRequest(result.reason);
    await notify(order.user, { type: 'payment', title: 'Refund processed', message: `Your refund for ${order.orderNumber} has been processed.`, link: `/orders/${order._id}` });
    message = 'Refund processed';
  } else {
    throw ApiError.badRequest('There is nothing to refund on this order');
  }
  await logActivity(req, { action: 'refund.approved', entity: 'order', entityId: order._id, description: `${message} for ${order.orderNumber} (₹${order.total})`, metadata: { refundStatus: order.refundStatus } });
  res.json({ success: true, message, data: order });
});

/** Reject a return request: the order goes back to DELIVERED and the customer is told why. */
const rejectRefund = asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (reason.length < 5) throw ApiError.badRequest('Please give the customer a reason (5+ characters)');
  const order = await Order.findById(req.params.id);
  if (!order) throw ApiError.notFound('Order not found');
  if (order.orderStatus !== ORDER_STATUS.RETURN_REQUESTED) throw ApiError.badRequest('Only pending return requests can be rejected');
  order.orderStatus = ORDER_STATUS.DELIVERED;
  order.statusHistory.push({ status: ORDER_STATUS.DELIVERED, note: `Return request declined: ${reason}`, by: req.user._id });
  await order.save();
  await notify(order.user, { type: 'order', title: `Return request declined · ${order.orderNumber}`, message: reason, link: `/orders/${order._id}` });
  await logActivity(req, { action: 'refund.rejected', entity: 'order', entityId: order._id, description: `Rejected return for ${order.orderNumber}: ${reason}` });
  res.json({ success: true, message: 'Return request declined', data: order });
});

/* ─── Page content (homepage / about / services) ───────── */
async function readContent(key) {
  const doc = await SiteContent.findOne({ key }).lean();
  const defaults = CONTENT_DEFAULTS[key];
  if (!doc) return defaults;
  // Shallow-merge so newly added fields get their defaults.
  return { ...defaults, ...doc.data, ...(defaults.sections ? { sections: { ...defaults.sections, ...(doc.data.sections || {}) } } : {}) };
}

const getContent = asyncHandler(async (req, res) => {
  const { key } = req.params;
  if (!CONTENT_DEFAULTS[key]) throw ApiError.notFound('Unknown content section');
  res.json({ success: true, data: await readContent(key) });
});

const updateContent = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const schema = contentSchemas[key];
  if (!schema) throw ApiError.notFound('Unknown content section');
  const data = schema.parse(req.body);
  await SiteContent.findOneAndUpdate({ key }, { data, updatedBy: req.user._id }, { upsert: true, returnDocument: 'after' });
  await logActivity(req, { action: 'content.updated', entity: 'content', entityId: key, description: `Updated ${key} page content` });
  res.json({ success: true, message: 'Content published', data: await readContent(key) });
});

const resetContent = asyncHandler(async (req, res) => {
  const { key } = req.params;
  if (!CONTENT_DEFAULTS[key]) throw ApiError.notFound('Unknown content section');
  await SiteContent.deleteOne({ key });
  await logActivity(req, { action: 'content.reset', entity: 'content', entityId: key, description: `Reset ${key} page content to defaults` });
  res.json({ success: true, message: 'Content reset to defaults', data: CONTENT_DEFAULTS[key] });
});

/* ─── Customer notifications ───────────────────────────── */
const sendNotification = asyncHandler(async (req, res) => {
  const { audience, userId, email, title, message, link, type } = req.body;
  let recipients;
  if (audience === 'all') {
    recipients = await User.find({ role: 'user', isActive: true }).select('_id').lean();
  } else {
    const user = await User.findOne(userId ? { _id: userId } : { email }).select('_id name').lean();
    if (!user) throw ApiError.notFound('No customer found with that email');
    recipients = [user];
  }
  if (!recipients.length) throw ApiError.badRequest('There are no customers to notify');
  await Notification.insertMany(recipients.map((u) => ({ user: u._id, type, title, message, link: link || undefined })));
  await logActivity(req, {
    action: 'notification.sent',
    entity: 'notification',
    description: `Sent “${title}” to ${audience === 'all' ? `all customers (${recipients.length})` : email || userId}`,
  });
  res.status(201).json({ success: true, message: `Notification sent to ${recipients.length} customer${recipients.length === 1 ? '' : 's'}`, data: { count: recipients.length } });
});

const sentNotifications = asyncHandler(async (req, res) => {
  const items = await AdminActivity.find({ action: 'notification.sent' }).populate('admin', 'name').sort({ createdAt: -1 }).limit(20).lean();
  res.json({ success: true, data: items });
});

/* ─── Global admin search ──────────────────────────────── */
const search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  if (q.length < 2) return res.json({ success: true, data: { products: [], orders: [], customers: [] } });
  const rx = new RegExp(escapeRegex(q), 'i');
  const [products, orders, customers] = await Promise.all([
    Product.find({ $or: [{ name: rx }, { sku: rx }] }).select('name sku images stock').limit(5).lean(),
    Order.find({ $or: [{ orderNumber: rx }, { 'contact.email': rx }, { 'contact.name': rx }], orderStatus: { $ne: ORDER_STATUS.PENDING_PAYMENT } })
      .select('orderNumber contact total orderStatus')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    User.find({ $or: [{ name: rx }, { email: rx }, { phone: rx }] }).select('name email role').limit(5).lean(),
  ]);
  res.json({ success: true, data: { products, orders, customers } });
});

/* ─── Reply to a contact message by email ──────────────── */
const replyToMessage = asyncHandler(async (req, res) => {
  const body = String(req.body.message || '').trim();
  if (body.length < 2) throw ApiError.badRequest('Write a reply first');
  const msg = await ContactMessage.findById(req.params.id);
  if (!msg) throw ApiError.notFound('Message not found');
  const sent = await sendEmail(msg.email, 'contactReply', { msg: msg.toObject(), reply: body });
  if (!sent) throw new ApiError(502, 'The email could not be sent. Check the SMTP settings and try again.');
  msg.replies.push({ message: body, by: req.user._id });
  msg.status = 'replied';
  await msg.save();
  await logActivity(req, { action: 'message.replied', entity: 'message', entityId: msg._id, description: `Replied to ${msg.email}: ${msg.subject}` });
  res.json({ success: true, message: 'Reply sent', data: msg });
});

module.exports = { listActivity, listRefunds, approveRefund, rejectRefund, getContent, updateContent, resetContent, sendNotification, sentNotifications, search, replyToMessage, readContent };
