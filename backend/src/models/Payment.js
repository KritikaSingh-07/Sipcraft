const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../utils/constants');

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, index: true, sparse: true },
    razorpaySignature: { type: String, select: false },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.CREATED, index: true },
    method: String,
    failureReason: String,
    verifiedVia: { type: String, enum: ['signature', 'webhook', null], default: null },
    refundId: String,
    refundedAt: Date,
    events: [{ event: String, at: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true },
);

module.exports = mongoose.model('Payment', paymentSchema);
