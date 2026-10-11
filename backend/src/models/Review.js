const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 2000 },
    images: [{ url: String, publicId: String, _id: false }],
    status: { type: String, enum: ['pending', 'approved', 'hidden'], default: 'approved', index: true },
    isVerifiedPurchase: { type: Boolean, default: true },
    reports: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reason: { type: String, maxlength: 300 }, at: { type: Date, default: Date.now }, _id: false }],
    reportCount: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

// One review per product per order.
reviewSchema.index({ user: 1, product: 1, order: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
