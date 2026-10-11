/**
 * Server-side source of truth for every price, discount, shipping and tax figure.
 * Nothing price-related that the client sends is ever trusted.
 */
const mongoose = require('mongoose');
const { Product, Coupon, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/helpers');
const { getSettings } = require('./settingsService');
const { PAYMENT_STATUS } = require('../utils/constants');

const MAX_QTY_PER_LINE = 20;

/**
 * Loads current product data for raw line items and builds priced lines.
 * @param {Array<{product: string, quantity: number, color?: string, size?: string, _id?: any}>} rawItems
 * @param {{ strict?: boolean }} opts strict=true throws on any unavailable item (checkout); otherwise flags it (cart view)
 */
async function priceLines(rawItems, { strict = false } = {}) {
  const ids = [...new Set(rawItems.map((i) => String(i.product?._id || i.product)))].filter((id) => mongoose.isValidObjectId(id));
  const products = await Product.find({ _id: { $in: ids } })
    .select('name slug sku images price mrp discount stock lowStockThreshold isActive colors sizes category')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = [];
  const problems = [];
  for (const item of rawItems) {
    const p = byId.get(String(item.product?._id || item.product));
    const qty = Math.min(MAX_QTY_PER_LINE, Math.max(1, parseInt(item.quantity, 10) || 1));
    let issue = null;
    if (!p || !p.isActive) issue = 'This product is no longer available';
    else if (p.stock <= 0) issue = 'Out of stock';
    else if (p.stock < qty) issue = `Only ${p.stock} left in stock`;
    else if (item.color && p.colors?.length && !p.colors.some((c) => c.name === item.color)) issue = 'Selected colour is unavailable';
    else if (item.size && p.sizes?.length && !p.sizes.includes(item.size)) issue = 'Selected size is unavailable';

    if (issue) problems.push({ itemId: item._id, product: p?._id, name: p?.name || 'Unavailable product', issue });

    lines.push({
      _id: item._id,
      product: p
        ? {
            _id: p._id,
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            image: p.images?.[0]?.url || null,
            price: p.price,
            mrp: p.mrp,
            discount: p.discount,
            stock: p.stock,
            colors: p.colors,
            sizes: p.sizes,
            category: p.category,
            stockStatus: p.stock <= 0 ? 'out_of_stock' : p.stock <= p.lowStockThreshold ? 'low_stock' : 'in_stock',
          }
        : null,
      quantity: qty,
      color: item.color || '',
      size: item.size || '',
      savedForLater: Boolean(item.savedForLater),
      unitPrice: p ? p.price : 0,
      lineTotal: p ? round2(p.price * qty) : 0,
      available: !issue,
      issue,
    });
  }

  if (strict && problems.length) {
    throw ApiError.conflict('Some items in your cart need attention before checkout', { code: 'CART_INVALID', details: problems });
  }
  return { lines, problems };
}

/** Counts a user's completed (paid) redemptions of a coupon. */
async function userCouponUses(couponId, userId, excludeOrderId) {
  if (!userId) return 0;
  // Pending checkouts don't count: a user has at most one (older ones are cancelled when a
  // new checkout starts), and counting it would strip the coupon from their own retry.
  const filter = { user: userId, 'coupon.couponId': couponId, paymentStatus: PAYMENT_STATUS.PAID };
  if (excludeOrderId) filter._id = { $ne: excludeOrderId };
  return Order.countDocuments(filter);
}

/**
 * Validates a coupon against an order subtotal for a user and returns the discount.
 * Throws a 400 ApiError with a customer-friendly reason when invalid.
 */
async function evaluateCoupon(code, { subtotal, userId }) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) throw ApiError.badRequest('Enter a coupon code', { code: 'COUPON_INVALID' });
  const coupon = await Coupon.findOne({ code: normalized });
  const now = new Date();
  if (!coupon || !coupon.isActive) throw ApiError.badRequest('This coupon code is not valid', { code: 'COUPON_INVALID' });
  if (coupon.startDate && coupon.startDate > now) throw ApiError.badRequest('This coupon is not active yet', { code: 'COUPON_INVALID' });
  if (coupon.expiryDate < now) throw ApiError.badRequest('This coupon has expired', { code: 'COUPON_EXPIRED' });
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    throw ApiError.badRequest('This coupon has reached its usage limit', { code: 'COUPON_EXHAUSTED' });
  }
  if (subtotal < coupon.minimumOrderAmount) {
    throw ApiError.badRequest(`Add items worth ₹${round2(coupon.minimumOrderAmount - subtotal)} more to use this coupon`, {
      code: 'COUPON_MINIMUM',
    });
  }
  if (coupon.perUserLimit && userId) {
    const uses = await userCouponUses(coupon._id, userId);
    if (uses >= coupon.perUserLimit) throw ApiError.badRequest('You have already used this coupon', { code: 'COUPON_USED' });
  }

  let discount = coupon.discountType === 'percentage' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue;
  if (coupon.maximumDiscount) discount = Math.min(discount, coupon.maximumDiscount);
  discount = round2(Math.min(discount, subtotal));
  return { coupon, discount };
}

/**
 * Computes order totals. Prices are GST-inclusive (standard Indian retail practice), so
 * `tax` is the GST component contained in the discounted amount, not an extra charge.
 */
async function computeTotals(lines, { couponCode, userId, couponOptional = true } = {}) {
  const settings = await getSettings();
  const active = lines.filter((l) => !l.savedForLater && l.available);
  const subtotal = round2(active.reduce((s, l) => s + l.lineTotal, 0));
  const mrpTotal = round2(active.reduce((s, l) => s + (l.product?.mrp || l.unitPrice) * l.quantity, 0));

  let discount = 0;
  let coupon = null;
  let couponError = null;
  if (couponCode && subtotal > 0) {
    try {
      const res = await evaluateCoupon(couponCode, { subtotal, userId });
      discount = res.discount;
      coupon = res.coupon;
    } catch (err) {
      if (!couponOptional) throw err;
      couponError = err.message;
    }
  }

  const afterDiscount = round2(subtotal - discount);
  const shippingFee = subtotal === 0 || afterDiscount >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
  const tax = round2((afterDiscount * settings.taxRate) / (100 + settings.taxRate));
  const total = round2(afterDiscount + shippingFee);

  return {
    itemCount: active.reduce((s, l) => s + l.quantity, 0),
    mrpTotal,
    savings: round2(mrpTotal - subtotal + discount),
    subtotal,
    discount,
    shippingFee,
    tax,
    taxRate: settings.taxRate,
    taxInclusive: true,
    total,
    freeShippingThreshold: settings.freeShippingThreshold,
    amountToFreeShipping: shippingFee > 0 ? round2(settings.freeShippingThreshold - afterDiscount) : 0,
    coupon: coupon
      ? {
          _id: coupon._id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          description: coupon.description,
        }
      : null,
    couponError,
  };
}

module.exports = { priceLines, computeTotals, evaluateCoupon, MAX_QTY_PER_LINE };
