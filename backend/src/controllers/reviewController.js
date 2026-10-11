const mongoose = require('mongoose');
const { Review, Product, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { parsePagination, paginated, escapeRegex, round2 } = require('../utils/helpers');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { getSettings } = require('../services/settingsService');
const { notifyAdmins } = require('../services/notificationService');

const REVIEWABLE_STATUSES = [ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURN_REQUESTED];

/** Recomputes a product's average rating and review count from approved reviews. */
async function recalcProductRating(productId) {
  const [agg] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne({ _id: productId }, { rating: agg ? round2(agg.avg) : 0, reviewCount: agg?.count || 0 });
}

/* GET /api/products/:productId/reviews */
const listProductReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 6, maxLimit: 30 });
  const filter = { product: req.params.productId, status: 'approved' };
  if (req.query.rating) filter.rating = req.query.rating;
  const sort = { highest: { rating: -1, createdAt: -1 }, lowest: { rating: 1, createdAt: -1 } }[req.query.sort] || { createdAt: -1 };
  const [items, total] = await Promise.all([
    Review.find(filter).select('-reports -reportCount').populate('user', 'name avatar').sort(sort).skip(skip).limit(limit).lean(),
    Review.countDocuments(filter),
  ]);
  // Only expose first name + initial publicly.
  const safe = items.map((r) => ({
    ...r,
    user: r.user ? { _id: r.user._id, name: r.user.name.split(' ').map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' '), avatar: r.user.avatar } : null,
  }));
  res.json({ success: true, data: paginated(safe, total, page, limit) });
});

/* GET /api/products/:productId/reviews/eligibility — delivered orders the user may still review */
const reviewEligibility = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    paymentStatus: PAYMENT_STATUS.PAID,
    orderStatus: { $in: REVIEWABLE_STATUSES },
    'items.product': req.params.productId,
  })
    .select('orderNumber createdAt deliveredAt')
    .sort({ createdAt: -1 })
    .lean();
  const reviewed = await Review.find({ user: req.user._id, product: req.params.productId }).distinct('order');
  const reviewedSet = new Set(reviewed.map(String));
  const eligible = orders.filter((o) => !reviewedSet.has(String(o._id)));
  const hasPurchased = await Order.exists({ user: req.user._id, paymentStatus: PAYMENT_STATUS.PAID, 'items.product': req.params.productId });
  res.json({ success: true, data: { eligibleOrders: eligible, hasPurchased: Boolean(hasPurchased), alreadyReviewed: reviewed.length > 0 } });
});

/* POST /api/products/:productId/reviews */
const createReview = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { orderId, rating, title, comment, images } = req.body;

  const order = await Order.findOne({
    _id: orderId,
    user: req.user._id,
    paymentStatus: PAYMENT_STATUS.PAID,
    'items.product': productId,
  });
  if (!order) throw ApiError.forbidden('You can only review products you have purchased', { code: 'NOT_PURCHASED' });
  if (!REVIEWABLE_STATUSES.includes(order.orderStatus)) {
    throw ApiError.badRequest('You can review this product once your order has been delivered', { code: 'NOT_DELIVERED' });
  }
  if (await Review.exists({ user: req.user._id, product: productId, order: orderId })) {
    throw ApiError.conflict('You have already reviewed this product for this order', { code: 'DUPLICATE_REVIEW' });
  }

  const settings = await getSettings();
  const review = await Review.create({
    user: req.user._id,
    product: productId,
    order: orderId,
    rating,
    title,
    comment,
    images,
    status: settings.reviewsRequireApproval ? 'pending' : 'approved',
  });
  await Order.updateOne({ _id: orderId, 'items.product': productId }, { $set: { 'items.$[i].reviewed': true } }, { arrayFilters: [{ 'i.product': productId }] });
  await recalcProductRating(productId);

  res.status(201).json({
    success: true,
    message: review.status === 'pending' ? 'Thanks! Your review will appear once approved.' : 'Thanks for your review!',
    data: review,
  });
});

/* PUT /api/reviews/:id (author only) */
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) throw ApiError.notFound('Review not found');
  Object.assign(review, req.body);
  const settings = await getSettings();
  if (settings.reviewsRequireApproval && review.status === 'approved') review.status = 'pending';
  await review.save();
  await recalcProductRating(review.product);
  res.json({ success: true, message: 'Review updated', data: review });
});

/* DELETE /api/reviews/:id (author or admin) */
const deleteReview = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== 'admin') filter.user = req.user._id;
  const review = await Review.findOneAndDelete(filter);
  if (!review) throw ApiError.notFound('Review not found');
  if (req.user.role === 'admin' && String(review.user) !== String(req.user._id)) {
    await logActivity(req, { action: 'review.deleted', entity: 'review', entityId: review._id, description: `Deleted a ${review.rating}★ review: “${(review.title || review.comment).slice(0, 60)}”` });
  }
  await Order.updateOne({ _id: review.order }, { $set: { 'items.$[i].reviewed': false } }, { arrayFilters: [{ 'i.product': review.product }] });
  await recalcProductRating(review.product);
  res.json({ success: true, message: 'Review deleted' });
});

/* GET /api/reviews/mine */
const myReviews = asyncHandler(async (req, res) => {
  const items = await Review.find({ user: req.user._id }).populate('product', 'name slug images').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: items });
});

/* GET /api/reviews/featured — top-rated recent reviews for the homepage */
const featuredReviews = asyncHandler(async (req, res) => {
  const items = await Review.find({ status: 'approved', rating: { $gte: 4 } })
    .select('-reports -reportCount')
    .populate('user', 'name avatar')
    .populate('product', 'name slug images')
    .sort({ rating: -1, createdAt: -1 })
    .limit(9)
    .lean();
  res.json({
    success: true,
    data: items.map((r) => ({
      ...r,
      user: r.user ? { name: r.user.name.split(' ').map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' '), avatar: r.user.avatar } : null,
      product: r.product ? { name: r.product.name, slug: r.product.slug, image: r.product.images?.[0]?.url } : null,
    })),
  });
});

/* ─── Admin ────────────────────────────────────────────── */
const adminListReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status === 'reported') filter.reportCount = { $gt: 0 };
  else if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ title: rx }, { comment: rx }];
  }
  const [items, total, counts] = await Promise.all([
    Review.find(filter)
      .populate('user', 'name email')
      .populate('product', 'name slug images')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const reported = await Review.countDocuments({ reportCount: { $gt: 0 } });
  res.json({ success: true, data: { ...paginated(items, total, page, limit), counts: { ...Object.fromEntries(counts.map((c) => [c._id, c.count])), reported } } });
});

/* POST /api/reviews/:id/report — any signed-in shopper can flag a review once */
const reportReview = asyncHandler(async (req, res) => {
  const review = await Review.findOne({ _id: req.params.id, status: 'approved' });
  if (!review) throw ApiError.notFound('Review not found');
  if (String(review.user) === String(req.user._id)) throw ApiError.badRequest('You can’t report your own review');
  if (review.reports.some((r) => String(r.user) === String(req.user._id))) throw ApiError.conflict('You’ve already reported this review');
  review.reports.push({ user: req.user._id, reason: req.body.reason });
  review.reportCount = review.reports.length;
  await review.save();
  if (review.reportCount === 1) {
    await notifyAdmins({ type: 'review', title: 'Review reported', message: `A ${review.rating}★ review was reported: ${req.body.reason}`, link: '/admin/reviews?status=reported' });
  }
  res.json({ success: true, message: 'Thanks — our team will take a look.' });
});

const adminModerateReview = asyncHandler(async (req, res) => {
  // Approving (or hiding) a reported review resolves its reports.
  const review = await Review.findByIdAndUpdate(req.params.id, { status: req.body.status, ...(req.body.status !== 'pending' ? { reports: [], reportCount: 0 } : {}) }, { returnDocument: 'after' });
  if (!review) throw ApiError.notFound('Review not found');
  await recalcProductRating(review.product);
  await logActivity(req, { action: `review.${req.body.status}`, entity: 'review', entityId: review._id, description: `Marked a ${review.rating}★ review as ${req.body.status}` });
  res.json({ success: true, message: `Review ${req.body.status}`, data: review });
});

module.exports = {
  recalcProductRating,
  listProductReviews,
  reviewEligibility,
  createReview,
  updateReview,
  deleteReview,
  myReviews,
  featuredReviews,
  adminListReviews,
  adminModerateReview,
  reportReview,
};
