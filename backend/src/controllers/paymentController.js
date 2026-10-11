const crypto = require('crypto');
const { Payment, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { safeEqual, parsePagination, paginated } = require('../utils/helpers');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../utils/constants');
const orderService = require('../services/orderService');
const logger = require('../utils/logger');

const requireRazorpay = () => {
  const rzp = getRazorpay();
  if (!rzp) {
    throw ApiError.unavailable('Online payments are not configured yet. Please try again later.', { code: 'PAYMENTS_DISABLED' });
  }
  return rzp;
};

const checkoutPayload = (order, payment, user) => ({
  keyId: env.razorpay.keyId,
  razorpayOrderId: payment.razorpayOrderId,
  amount: payment.amount,
  currency: payment.currency,
  orderId: order._id,
  orderNumber: order.orderNumber,
  total: order.total,
  expiresAt: order.reservationExpiresAt,
  prefill: { name: order.contact?.name || user.name, email: order.contact?.email || user.email, contact: order.contact?.phone || user.phone || '' },
});

/**
 * POST /api/payments/create-order (alias: POST /api/orders)
 * Re-prices the server cart, reserves stock, creates a pending order and a Razorpay order
 * for the server-computed amount.
 */
const createPaymentOrder = asyncHandler(async (req, res) => {
  const rzp = requireRazorpay();
  const order = await orderService.createCheckoutOrder(req.user, req.body);

  let rzpOrder;
  try {
    rzpOrder = await rzp.orders.create({
      amount: Math.round(order.total * 100),
      currency: env.store.currency,
      receipt: order.orderNumber,
      notes: { orderId: String(order._id), userId: String(req.user._id) },
    });
  } catch (err) {
    logger.error('Razorpay order creation failed:', err?.error?.description || err.message);
    await orderService.expireOrder(order, 'Payment gateway unavailable');
    throw new ApiError(502, 'We could not reach the payment gateway. Please try again in a moment.', { code: 'GATEWAY_ERROR' });
  }

  const payment = await Payment.create({
    order: order._id,
    user: req.user._id,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    status: PAYMENT_STATUS.PENDING,
    events: [{ event: 'created' }],
  });
  order.payment = payment._id;
  order.paymentStatus = PAYMENT_STATUS.PENDING;
  await order.save();

  res.status(201).json({ success: true, data: checkoutPayload(order, payment, req.user) });
});

/* POST /api/payments/retry/:orderId — reopen checkout for a still-reserved unpaid order */
const retryPayment = asyncHandler(async (req, res) => {
  requireRazorpay();
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.paymentStatus === PAYMENT_STATUS.PAID) throw ApiError.badRequest('This order is already paid');
  if (order.orderStatus !== ORDER_STATUS.PENDING_PAYMENT || !order.stockReserved || order.reservationExpiresAt <= new Date()) {
    throw ApiError.badRequest('This checkout has expired. Please place the order again from your cart.', { code: 'CHECKOUT_EXPIRED' });
  }
  const payment = await Payment.findById(order.payment);
  if (!payment) throw ApiError.badRequest('This checkout has expired. Please place the order again from your cart.');
  res.json({ success: true, data: checkoutPayload(order, payment, req.user) });
});

/**
 * POST /api/payments/verify
 * Verifies the Razorpay signature server-side (HMAC-SHA256 of "order_id|payment_id" with the
 * key secret), cross-checks the payment with Razorpay's API, then marks the order paid.
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const rzp = requireRazorpay();
  const { razorpay_order_id: rzpOrderId, razorpay_payment_id: rzpPaymentId, razorpay_signature: signature } = req.body;

  const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');

  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${rzpOrderId}|${rzpPaymentId}`).digest('hex');
  if (!safeEqual(expected, signature)) {
    await Payment.updateOne({ _id: payment._id }, { $push: { events: { event: 'signature_mismatch' } } });
    throw ApiError.badRequest('Payment verification failed. If money was debited, it will be refunded automatically.', {
      code: 'SIGNATURE_INVALID',
    });
  }

  // Defence in depth: confirm with Razorpay that this payment belongs to the order and the amount matches.
  let method;
  try {
    let remote = await rzp.payments.fetch(rzpPaymentId);
    if (remote.order_id !== rzpOrderId || Number(remote.amount) !== payment.amount) {
      throw ApiError.badRequest('Payment details do not match this order', { code: 'PAYMENT_MISMATCH' });
    }
    if (remote.status === 'authorized') remote = await rzp.payments.capture(rzpPaymentId, payment.amount, payment.currency);
    if (remote.status !== 'captured') throw ApiError.badRequest('Payment has not been completed', { code: 'PAYMENT_INCOMPLETE' });
    method = remote.method;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Razorpay payment fetch failed:', err?.error?.description || err.message);
    throw new ApiError(502, 'We could not confirm your payment yet. It will update automatically within a few minutes.', {
      code: 'GATEWAY_ERROR',
    });
  }

  payment.razorpayPaymentId = rzpPaymentId;
  payment.razorpaySignature = signature;
  await payment.save();

  const { order } = await orderService.markOrderPaid(payment.order, payment, { via: 'signature', method });
  res.json({ success: true, message: 'Payment successful', data: { orderId: order._id, orderNumber: order.orderNumber } });
});

/** POST /api/payments/failed — client-reported failure. Can only ever mark FAILED, never PAID. */
const reportFailure = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ razorpayOrderId: req.body.razorpay_order_id, user: req.user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  await orderService.markPaymentFailed(payment.order, payment._id, req.body.reason || 'Payment failed at checkout');
  res.json({ success: true, data: { orderId: payment.order } });
});

/* GET /api/payments/config — public, non-secret checkout config */
const config = (req, res) => {
  res.json({ success: true, data: { enabled: env.features.payments(), keyId: env.razorpay.keyId || null, currency: env.store.currency } });
};

/* GET /api/admin/payments */
const adminListPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.search) {
    const s = String(req.query.search).trim();
    filter.$or = [{ razorpayOrderId: s }, { razorpayPaymentId: s }];
  }
  const [items, total, summary] = await Promise.all([
    Payment.find(filter)
      .populate('user', 'name email')
      .populate('order', 'orderNumber total orderStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
  ]);
  res.json({
    success: true,
    data: { ...paginated(items, total, page, limit), summary: summary.map((s) => ({ status: s._id, count: s.count, amount: s.amount / 100 })) },
  });
});

module.exports = { createPaymentOrder, retryPayment, verifyPayment, reportFailure, config, adminListPayments };
