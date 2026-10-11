const crypto = require('crypto');
const { Payment, Order } = require('../models');
const { env } = require('../config/env');
const { safeEqual } = require('../utils/helpers');
const { PAYMENT_STATUS } = require('../utils/constants');
const orderService = require('../services/orderService');
const logger = require('../utils/logger');

/**
 * POST /api/payments/webhook — Razorpay server-to-server events.
 * Mounted with express.raw() so the signature is verified against the exact bytes received.
 */
const webhook = async (req, res) => {
  try {
    const signature = req.get('x-razorpay-signature');
    if (!env.razorpay.webhookSecret || !signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ success: false });
    const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(req.body).digest('hex');
    if (!safeEqual(expected, signature)) return res.status(400).json({ success: false, message: 'Invalid signature' });

    const event = JSON.parse(req.body.toString('utf8'));
    const entity = event.payload?.payment?.entity;
    const rzpOrderId = entity?.order_id || event.payload?.order?.entity?.id;
    const payment = rzpOrderId ? await Payment.findOne({ razorpayOrderId: rzpOrderId }) : null;

    if (payment) {
      await Payment.updateOne({ _id: payment._id }, { $push: { events: { event: `webhook:${event.event}` } } });
      switch (event.event) {
        case 'payment.captured':
        case 'order.paid': {
          if (entity && Number(entity.amount) !== payment.amount) {
            logger.warn(`Webhook amount mismatch for ${rzpOrderId}`);
            break;
          }
          if (entity?.id) payment.razorpayPaymentId = entity.id;
          await payment.save();
          await orderService.markOrderPaid(payment.order, payment, { via: 'webhook', method: entity?.method });
          break;
        }
        case 'payment.failed':
          await orderService.markPaymentFailed(payment.order, payment._id, entity?.error_description || 'Payment failed');
          break;
        case 'refund.processed': {
          await Payment.updateOne({ _id: payment._id }, { status: PAYMENT_STATUS.REFUNDED, refundedAt: new Date(), refundId: event.payload?.refund?.entity?.id });
          await Order.updateOne(
            { _id: payment.order },
            { paymentStatus: PAYMENT_STATUS.REFUNDED, refundStatus: 'processed', refundedAt: new Date() },
          );
          break;
        }
        default:
          break;
      }
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('Webhook processing error:', err.message);
    // 500 makes Razorpay retry later.
    return res.status(500).json({ success: false });
  }
};

module.exports = { razorpayWebhook: webhook };
