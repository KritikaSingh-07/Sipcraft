const mongoose = require('mongoose');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');

/** Snapshot of a purchased product — immune to later product edits. */
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    slug: String,
    sku: String,
    image: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    price: { type: Number, required: true }, // price at purchase
    mrp: Number,
    quantity: { type: Number, required: true, min: 1 },
    color: String,
    size: String,
    lineTotal: { type: Number, required: true },
    reviewed: { type: Boolean, default: false },
  },
  { _id: true },
);

const addressSnapshot = new mongoose.Schema(
  {
    fullName: String,
    phone: String,
    email: String,
    address: String,
    apartment: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },
  { _id: false },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: String,
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => Array.isArray(v) && v.length > 0 },
    shippingAddress: { type: addressSnapshot, required: true },
    contact: { email: String, phone: String, name: String },

    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    coupon: {
      code: String,
      discountType: String,
      discountValue: Number,
      couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    },

    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paymentMethod: { type: String, default: 'razorpay' },
    paymentStatus: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.CREATED, index: true },
    orderStatus: { type: String, enum: Object.values(ORDER_STATUS), default: ORDER_STATUS.PENDING_PAYMENT, index: true },

    trackingNumber: String,
    carrier: String,
    statusHistory: { type: [statusHistorySchema], default: [] },

    // Inventory reservation while payment is pending.
    stockReserved: { type: Boolean, default: false },
    reservationExpiresAt: Date,
    stockConflict: { type: Boolean, default: false },

    paidAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    refundStatus: { type: String, enum: ['none', 'pending', 'processed', 'failed'], default: 'none' },
    refundAmount: Number,
    refundedAt: Date,
    adminNotes: String,
  },
  { timestamps: true },
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, reservationExpiresAt: 1 });

module.exports = mongoose.model('Order', orderSchema);
