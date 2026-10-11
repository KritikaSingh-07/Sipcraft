const crypto = require('crypto');
const mongoose = require('mongoose');
const { Order, Cart, Address, Coupon, Payment, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { env } = require('../config/env');
const { getRazorpay } = require('../config/razorpay');
const { ORDER_STATUS, PAYMENT_STATUS, ORDER_TRANSITIONS, USER_CANCELLABLE } = require('../utils/constants');
const { priceLines, computeTotals } = require('./pricingService');
const inventory = require('./inventoryService');
const { notify, notifyAdmins } = require('./notificationService');
const { queueEmail } = require('./emailService');
const logger = require('../utils/logger');

const STATUS_LABEL = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
};

function generateOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `SC${ymd}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** Cancels the user's earlier unpaid checkouts so abandoned attempts don't hold stock. */
async function cancelStalePendingOrders(userId) {
  const stale = await Order.find({ user: userId, orderStatus: ORDER_STATUS.PENDING_PAYMENT, paymentStatus: { $ne: PAYMENT_STATUS.PAID } });
  for (const o of stale) await expireOrder(o, 'Superseded by a newer checkout');
}

/**
 * Builds a pending order from the user's server-side cart:
 * re-prices every line from MongoDB, re-validates the coupon, reserves stock atomically.
 */
async function createCheckoutOrder(user, { addressId, address, contact, couponCode }) {
  const cart = await Cart.findOne({ user: user._id });
  const rawItems = (cart?.items || []).filter((i) => !i.savedForLater);
  if (!rawItems.length) throw ApiError.badRequest('Your cart is empty', { code: 'CART_EMPTY' });

  let shipping;
  if (addressId) {
    const saved = await Address.findOne({ _id: addressId, user: user._id }).lean();
    if (!saved) throw ApiError.badRequest('Please select a valid shipping address');
    shipping = saved;
  } else if (address) {
    shipping = address;
  } else {
    throw ApiError.badRequest('A shipping address is required');
  }

  // Release any earlier unpaid checkout first so its stock and coupon are available again.
  await cancelStalePendingOrders(user._id);

  const { lines } = await priceLines(rawItems, { strict: true });
  const code = couponCode || cart.couponCode || null;
  const totals = await computeTotals(lines, { couponCode: code, userId: user._id, couponOptional: !couponCode });
  if (totals.total <= 0) throw ApiError.badRequest('Order total must be greater than zero');

  const items = lines.map((l) => ({
    product: l.product._id,
    name: l.product.name,
    slug: l.product.slug,
    sku: l.product.sku,
    image: l.product.image,
    category: l.product.category,
    price: l.unitPrice,
    mrp: l.product.mrp,
    quantity: l.quantity,
    color: l.color,
    size: l.size,
    lineTotal: l.lineTotal,
  }));

  await inventory.reserveStock(items);

  try {
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: user._id,
      items,
      shippingAddress: {
        fullName: shipping.fullName,
        phone: shipping.phone,
        email: shipping.email || contact?.email || user.email,
        address: shipping.address,
        apartment: shipping.apartment,
        city: shipping.city,
        state: shipping.state,
        pincode: shipping.pincode,
        country: shipping.country || 'India',
      },
      contact: {
        name: contact?.name || shipping.fullName || user.name,
        email: contact?.email || user.email,
        phone: contact?.phone || shipping.phone || user.phone,
      },
      subtotal: totals.subtotal,
      discount: totals.discount,
      shippingFee: totals.shippingFee,
      tax: totals.tax,
      total: totals.total,
      coupon: totals.coupon
        ? {
            code: totals.coupon.code,
            discountType: totals.coupon.discountType,
            discountValue: totals.coupon.discountValue,
            couponId: totals.coupon._id,
          }
        : undefined,
      paymentStatus: PAYMENT_STATUS.CREATED,
      orderStatus: ORDER_STATUS.PENDING_PAYMENT,
      stockReserved: true,
      reservationExpiresAt: new Date(Date.now() + env.store.paymentHoldMinutes * 60 * 1000),
      statusHistory: [{ status: ORDER_STATUS.PENDING_PAYMENT, note: 'Awaiting payment' }],
    });
    return order;
  } catch (err) {
    await inventory.releaseStock(items);
    throw err;
  }
}

/** Removes purchased lines (product+colour+size) from the user's cart. */
async function clearPurchasedFromCart(order) {
  const cart = await Cart.findOne({ user: order.user });
  if (!cart) return;
  const keys = new Set(order.items.map((i) => `${i.product}|${i.color || ''}|${i.size || ''}`));
  cart.items = cart.items.filter((i) => i.savedForLater || !keys.has(`${i.product}|${i.color || ''}|${i.size || ''}`));
  if (order.coupon?.code && cart.couponCode === order.coupon.code) cart.couponCode = null;
  await cart.save();
}

/**
 * Idempotently marks an order as paid after the payment has been verified server-side
 * (signature or webhook). Safe to call concurrently from /verify and the webhook:
 * the conditional update guarantees side-effects run exactly once.
 */
async function markOrderPaid(orderId, payment, { via, method } = {}) {
  const now = new Date();
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $nin: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } },
    {
      $set: {
        paymentStatus: PAYMENT_STATUS.PAID,
        orderStatus: ORDER_STATUS.PLACED,
        paidAt: now,
        payment: payment._id,
        cancelledAt: null,
        cancelReason: null,
      },
      $push: { statusHistory: { status: ORDER_STATUS.PLACED, note: 'Payment received', at: now } },
    },
    { returnDocument: 'after' },
  );

  await Payment.updateOne(
    { _id: payment._id, status: { $ne: PAYMENT_STATUS.PAID } },
    {
      $set: { status: PAYMENT_STATUS.PAID, razorpayPaymentId: payment.razorpayPaymentId, verifiedVia: via, ...(method ? { method } : {}) },
      $push: { events: { event: `paid:${via}` } },
    },
  );

  if (!order) return { order: await Order.findById(orderId), alreadyPaid: true };

  // If the hold expired (stock was released) before payment landed, re-reserve now.
  if (!order.stockReserved) {
    const ok = await inventory.tryReserveStock(order.items);
    if (!ok) {
      order.stockConflict = true;
      order.adminNotes = `${order.adminNotes ? `${order.adminNotes}\n` : ''}Payment captured after reservation expired and stock was insufficient. Restock or refund.`;
      logger.warn(`Order ${order.orderNumber}: paid after hold expired with insufficient stock`);
    }
  }
  order.stockReserved = false;
  order.reservationExpiresAt = undefined;
  await order.save();

  await inventory.recordSale(order.items);
  if (order.coupon?.couponId) await Coupon.updateOne({ _id: order.coupon.couponId }, { $inc: { usedCount: 1 } });
  await clearPurchasedFromCart(order);

  const fresh = await Payment.findById(payment._id);
  const user = await User.findById(order.user).lean();
  await notify(order.user, {
    type: 'payment',
    title: 'Payment successful',
    message: `We received ₹${order.total.toLocaleString('en-IN')} for order ${order.orderNumber}.`,
    link: `/orders/${order._id}`,
  });
  await notifyAdmins({
    type: 'order',
    title: `New order · ${order.orderNumber}`,
    message: `${order.contact?.name || 'A customer'} paid ₹${order.total.toLocaleString('en-IN')} for ${order.items.length} item${order.items.length === 1 ? '' : 's'}.`,
    link: `/admin/orders/${order._id}`,
  });
  const to = order.contact?.email || user?.email;
  queueEmail(to, 'orderConfirmation', { order: order.toObject() });
  queueEmail(to, 'paymentConfirmation', { order: order.toObject(), payment: fresh?.toObject() || payment });

  return { order, alreadyPaid: false };
}

async function markPaymentFailed(orderId, paymentId, reason) {
  await Payment.updateOne(
    { _id: paymentId, status: { $nin: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } },
    { $set: { status: PAYMENT_STATUS.FAILED, failureReason: reason?.slice(0, 300) }, $push: { events: { event: 'failed' } } },
  );
  // The order stays PENDING_PAYMENT with stock held so the customer can retry within the
  // hold window. The expiry job releases the stock if no payment arrives.
  await Order.updateOne(
    { _id: orderId, paymentStatus: { $nin: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } },
    { $set: { paymentStatus: PAYMENT_STATUS.FAILED } },
  );
}

/** Cancels an unpaid order and releases its stock reservation (atomic, idempotent). */
async function expireOrder(order, reason = 'Payment not completed in time') {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: ORDER_STATUS.PENDING_PAYMENT, paymentStatus: { $ne: PAYMENT_STATUS.PAID }, stockReserved: true },
    {
      $set: { orderStatus: ORDER_STATUS.CANCELLED, stockReserved: false, cancelledAt: new Date(), cancelReason: reason },
      $push: { statusHistory: { status: ORDER_STATUS.CANCELLED, note: reason } },
    },
    { returnDocument: 'after' },
  );
  if (updated) {
    await inventory.releaseStock(updated.items);
    if (updated.paymentStatus === PAYMENT_STATUS.CREATED) {
      await Order.updateOne({ _id: updated._id }, { paymentStatus: PAYMENT_STATUS.FAILED });
    }
  }
  return updated;
}

/** Attempts a full Razorpay refund for a paid order. */
async function refundOrder(order, { note } = {}) {
  const payment = order.payment ? await Payment.findById(order.payment) : null;
  const rzp = getRazorpay();
  if (!payment?.razorpayPaymentId || !rzp) {
    order.refundStatus = 'pending';
    return { ok: false, reason: 'Refund must be processed manually' };
  }
  try {
    const refund = await rzp.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round(order.total * 100),
      notes: { orderNumber: order.orderNumber, reason: note || 'Order cancelled' },
    });
    payment.status = PAYMENT_STATUS.REFUNDED;
    payment.refundId = refund.id;
    payment.refundedAt = new Date();
    payment.events.push({ event: 'refunded' });
    await payment.save();
    order.paymentStatus = PAYMENT_STATUS.REFUNDED;
    order.refundStatus = 'processed';
    order.refundAmount = order.total;
    order.refundedAt = new Date();
    return { ok: true };
  } catch (err) {
    logger.error(`Refund failed for ${order.orderNumber}:`, err?.error?.description || err.message);
    order.refundStatus = 'failed';
    return { ok: false, reason: 'Refund could not be processed automatically' };
  }
}

async function cancelOrder(order, { by, reason, isAdmin = false }) {
  if (order.orderStatus === ORDER_STATUS.CANCELLED) throw ApiError.badRequest('This order is already cancelled');
  if (!isAdmin && !USER_CANCELLABLE.includes(order.orderStatus)) {
    throw ApiError.badRequest('This order can no longer be cancelled. Please request a return after delivery.');
  }
  if (isAdmin && !ORDER_TRANSITIONS[order.orderStatus]?.includes(ORDER_STATUS.CANCELLED)) {
    throw ApiError.badRequest(`An order that is ${order.orderStatus.replace(/_/g, ' ').toLowerCase()} cannot be cancelled`);
  }

  if (order.orderStatus === ORDER_STATUS.PENDING_PAYMENT) {
    const res = await expireOrder(order, reason || 'Cancelled by customer');
    if (!res) throw ApiError.conflict('Order status changed. Please refresh and try again.');
    return res;
  }

  const wasPaid = order.paymentStatus === PAYMENT_STATUS.PAID;
  order.orderStatus = ORDER_STATUS.CANCELLED;
  order.cancelledAt = new Date();
  order.cancelReason = reason || (isAdmin ? 'Cancelled by store' : 'Cancelled by customer');
  order.statusHistory.push({ status: ORDER_STATUS.CANCELLED, note: order.cancelReason, by });
  if (wasPaid) {
    await inventory.reverseSale(order.items);
    await refundOrder(order, { note: order.cancelReason });
  }
  await order.save();

  await notify(order.user, {
    type: 'order',
    title: 'Order cancelled',
    message: `Order ${order.orderNumber} has been cancelled.${wasPaid ? ' Your refund is being processed.' : ''}`,
    link: `/orders/${order._id}`,
  });
  queueEmail(order.contact?.email, 'orderCancelled', { order: order.toObject() });
  return order;
}

/** Admin-driven fulfilment status update with transition validation + customer notifications. */
async function updateOrderStatus(order, { status, note, trackingNumber, carrier, by }) {
  if (status === order.orderStatus) throw ApiError.badRequest(`Order is already ${STATUS_LABEL[status]?.toLowerCase() || status}`);
  if (status === ORDER_STATUS.CANCELLED) return cancelOrder(order, { by, reason: note, isAdmin: true });
  if (order.paymentStatus !== PAYMENT_STATUS.PAID && order.paymentStatus !== PAYMENT_STATUS.REFUNDED) {
    throw ApiError.badRequest('Only paid orders can be moved through fulfilment');
  }
  const allowed = ORDER_TRANSITIONS[order.orderStatus] || [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${order.orderStatus} to ${status}`, { code: 'INVALID_TRANSITION' });
  }

  order.orderStatus = status;
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (carrier !== undefined) order.carrier = carrier;
  if (status === ORDER_STATUS.DELIVERED) order.deliveredAt = new Date();
  if (status === ORDER_STATUS.RETURNED) {
    await inventory.reverseSale(order.items);
    if (order.paymentStatus === PAYMENT_STATUS.PAID) await refundOrder(order, { note: 'Order returned' });
  }
  order.statusHistory.push({ status, note, by });
  await order.save();

  const messages = {
    CONFIRMED: 'Your order has been confirmed.',
    PROCESSING: 'Your order is being packed.',
    SHIPPED: 'Your order has been shipped.',
    OUT_FOR_DELIVERY: 'Your order is out for delivery.',
    DELIVERED: 'Your order has been delivered.',
    RETURN_REQUESTED: 'Your return request has been received.',
    RETURNED: 'Your return has been processed.',
  };
  await notify(order.user, {
    type: 'order',
    title: `${STATUS_LABEL[status]} · ${order.orderNumber}`,
    message: messages[status] || `Order status updated to ${STATUS_LABEL[status]}.`,
    link: `/orders/${order._id}`,
  });
  if (status === ORDER_STATUS.SHIPPED) queueEmail(order.contact?.email, 'orderShipped', { order: order.toObject() });
  if (status === ORDER_STATUS.DELIVERED) queueEmail(order.contact?.email, 'orderDelivered', { order: order.toObject() });
  return order;
}

/**
 * Background job: cancel unpaid orders whose hold expired and release their stock.
 * Before cancelling, checks Razorpay for a captured payment that a lost webhook may have missed.
 */
async function releaseExpiredReservations() {
  const expired = await Order.find({
    orderStatus: ORDER_STATUS.PENDING_PAYMENT,
    stockReserved: true,
    reservationExpiresAt: { $lte: new Date() },
  }).limit(100);

  const rzp = getRazorpay();
  for (const order of expired) {
    try {
      if (rzp) {
        const payment = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
        if (payment) {
          const res = await rzp.orders.fetchPayments(payment.razorpayOrderId);
          const captured = res?.items?.find((p) => p.status === 'captured');
          if (captured) {
            payment.razorpayPaymentId = captured.id;
            await payment.save();
            await markOrderPaid(order._id, payment, { via: 'webhook', method: captured.method });
            continue;
          }
        }
      }
      await expireOrder(order);
    } catch (err) {
      logger.error(`Failed to process expired order ${order.orderNumber}:`, err.message);
    }
  }
  return expired.length;
}

const isValidId = (id) => mongoose.isValidObjectId(id);

module.exports = {
  STATUS_LABEL,
  createCheckoutOrder,
  markOrderPaid,
  markPaymentFailed,
  expireOrder,
  cancelOrder,
  updateOrderStatus,
  refundOrder,
  releaseExpiredReservations,
  clearPurchasedFromCart,
  isValidId,
};
