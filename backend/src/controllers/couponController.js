const { Coupon, Cart } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { parsePagination, paginated, escapeRegex } = require('../utils/helpers');
const { priceLines, computeTotals, evaluateCoupon } = require('../services/pricingService');

/* POST /api/coupons/validate { code } — validates against the user's live server cart. */
const validateCoupon = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  const { lines } = await priceLines(cart?.items || []);
  const { subtotal } = await computeTotals(lines, {});
  if (subtotal <= 0) throw ApiError.badRequest('Add items to your cart before applying a coupon');
  const { coupon, discount } = await evaluateCoupon(req.body.code, { subtotal, userId: req.user._id });
  res.json({
    success: true,
    message: `${coupon.code} is valid`,
    data: { code: coupon.code, description: coupon.description, discountType: coupon.discountType, discountValue: coupon.discountValue, discount },
  });
});

/* GET /api/coupons/public — active coupons to advertise in the cart */
const publicCoupons = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await Coupon.find({ isActive: true, startDate: { $lte: now }, expiryDate: { $gt: now } })
    .select('code description discountType discountValue minimumOrderAmount maximumDiscount expiryDate')
    .sort({ minimumOrderAmount: 1 })
    .limit(5)
    .lean();
  res.json({ success: true, data: items });
});

/* ─── Admin ────────────────────────────────────────────── */
const listCoupons = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.search) filter.code = new RegExp(escapeRegex(req.query.search), 'i');
  const [items, total] = await Promise.all([Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Coupon.countDocuments(filter)]);
  const now = new Date();
  const withState = items.map((c) => ({
    ...c,
    state: !c.isActive ? 'inactive' : c.expiryDate < now ? 'expired' : c.usageLimit && c.usedCount >= c.usageLimit ? 'exhausted' : c.startDate > now ? 'scheduled' : 'active',
  }));
  res.json({ success: true, data: paginated(withState, total, page, limit) });
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  await logActivity(req, { action: 'coupon.created', entity: 'coupon', entityId: coupon._id, description: `Created coupon ${coupon.code}` });
  res.status(201).json({ success: true, message: 'Coupon created', data: coupon });
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  Object.assign(coupon, req.body);
  await coupon.save();
  await logActivity(req, { action: 'coupon.updated', entity: 'coupon', entityId: coupon._id, description: `Updated coupon ${coupon.code}` });
  res.json({ success: true, message: 'Coupon updated', data: coupon });
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw ApiError.notFound('Coupon not found');
  await Cart.updateMany({ couponCode: coupon.code }, { couponCode: null });
  await logActivity(req, { action: 'coupon.deleted', entity: 'coupon', entityId: coupon._id, description: `Deleted coupon ${coupon.code}` });
  res.json({ success: true, message: 'Coupon deleted' });
});

module.exports = { validateCoupon, publicCoupons, listCoupons, createCoupon, updateCoupon, deleteCoupon };
