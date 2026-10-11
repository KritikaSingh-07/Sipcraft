const { Cart, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceLines, computeTotals, evaluateCoupon, MAX_QTY_PER_LINE } = require('../services/pricingService');

const getOrCreateCart = async (userId) => (await Cart.findOne({ user: userId })) || Cart.create({ user: userId, items: [] });

const sameLine = (i, productId, color = '', size = '') =>
  String(i.product) === String(productId) && (i.color || '') === (color || '') && (i.size || '') === (size || '');

/** Serialises a cart with live prices, availability and totals computed on the server. */
async function serialize(cart, userId) {
  const { lines } = await priceLines(cart.items);
  const totals = await computeTotals(lines, { couponCode: cart.couponCode, userId });
  if (cart.couponCode && totals.couponError) {
    cart.couponCode = null;
    await cart.save();
  }
  return {
    _id: cart._id,
    items: lines.filter((l) => !l.savedForLater),
    savedForLater: lines.filter((l) => l.savedForLater),
    couponCode: totals.coupon?.code || null,
    couponError: totals.couponError,
    totals,
  };
}

/** Validates a product + variant and returns the product. */
async function loadPurchasable(productId, color, size) {
  const product = await Product.findOne({ _id: productId, isActive: true }).select('name stock colors sizes').lean();
  if (!product) throw ApiError.notFound('This product is no longer available');
  if (product.colors?.length && !color) throw ApiError.badRequest('Please select a colour');
  if (color && !product.colors?.some((c) => c.name === color)) throw ApiError.badRequest('Selected colour is unavailable');
  if (product.sizes?.length && !size) throw ApiError.badRequest('Please select a size');
  if (size && !product.sizes?.includes(size)) throw ApiError.badRequest('Selected size is unavailable');
  if (product.stock <= 0) throw ApiError.badRequest(`${product.name} is out of stock`, { code: 'OUT_OF_STOCK' });
  return product;
}

/* GET /api/cart */
const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  res.json({ success: true, data: await serialize(cart, req.user._id) });
});

/* POST /api/cart { productId, quantity, color, size } */
const addItem = asyncHandler(async (req, res) => {
  const { productId, quantity, color = '', size = '' } = req.body;
  const product = await loadPurchasable(productId, color, size);
  const cart = await getOrCreateCart(req.user._id);

  const existing = cart.items.find((i) => sameLine(i, productId, color, size));
  const desired = (existing && !existing.savedForLater ? existing.quantity : 0) + quantity;
  const qty = Math.min(desired, product.stock, MAX_QTY_PER_LINE);
  if (existing) {
    existing.quantity = qty;
    existing.savedForLater = false;
  } else {
    if (cart.items.length >= 50) throw ApiError.badRequest('Your cart is full');
    cart.items.push({ product: productId, quantity: qty, color, size });
  }
  await cart.save();

  const capped = qty < desired;
  res.status(201).json({
    success: true,
    message: capped ? `Only ${qty} available — quantity adjusted` : `${product.name} added to cart`,
    data: await serialize(cart, req.user._id),
  });
});

/* PUT /api/cart/:itemId { quantity?, savedForLater?, color?, size? } */
const updateItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('Item not found in your cart');

  const color = req.body.color ?? item.color;
  const size = req.body.size ?? item.size;
  if (req.body.color !== undefined || req.body.size !== undefined) {
    await loadPurchasable(item.product, color, size);
    const dup = cart.items.find((i) => i._id.toString() !== item._id.toString() && sameLine(i, item.product, color, size));
    if (dup) {
      dup.quantity = Math.min(MAX_QTY_PER_LINE, dup.quantity + item.quantity);
      item.deleteOne();
    } else {
      item.color = color;
      item.size = size;
    }
  }

  if (req.body.quantity !== undefined) {
    const product = await Product.findById(item.product).select('stock name').lean();
    if (product && req.body.quantity > product.stock) {
      throw ApiError.badRequest(product.stock > 0 ? `Only ${product.stock} of ${product.name} in stock` : `${product.name} is out of stock`, {
        code: 'INSUFFICIENT_STOCK',
      });
    }
    item.quantity = req.body.quantity;
  }
  if (req.body.savedForLater !== undefined) item.savedForLater = req.body.savedForLater;
  await cart.save();

  const message = req.body.savedForLater === true ? 'Saved for later' : req.body.savedForLater === false ? 'Moved to cart' : 'Cart updated';
  res.json({ success: true, message, data: await serialize(cart, req.user._id) });
});

/* DELETE /api/cart/:itemId */
const removeItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw ApiError.notFound('Item not found in your cart');
  item.deleteOne();
  await cart.save();
  res.json({ success: true, message: 'Removed from cart', data: await serialize(cart, req.user._id) });
});

/* DELETE /api/cart */
const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = cart.items.filter((i) => i.savedForLater);
  cart.couponCode = null;
  await cart.save();
  res.json({ success: true, message: 'Cart cleared', data: await serialize(cart, req.user._id) });
});

/**
 * POST /api/cart/merge { items: [...] }
 * Merges a guest (localStorage) cart into the server cart after login: matching lines take
 * the larger quantity (not the sum, to avoid doubling if the guest cart was a copy), new
 * lines are added, everything is capped at available stock. Invalid lines are skipped.
 */
const mergeCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const products = await Product.find({ _id: { $in: req.body.items.map((i) => i.productId) }, isActive: true })
    .select('stock colors sizes')
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  let skipped = 0;

  for (const g of req.body.items) {
    const p = byId.get(String(g.productId));
    const color = g.color || '';
    const size = g.size || '';
    const validVariant =
      p && (!p.colors?.length || p.colors.some((c) => c.name === color)) && (!p.sizes?.length || p.sizes.includes(size));
    if (!p || p.stock <= 0 || !validVariant) {
      skipped += 1;
      continue;
    }
    const existing = cart.items.find((i) => sameLine(i, g.productId, color, size));
    if (existing) {
      existing.quantity = Math.min(Math.max(existing.quantity, g.quantity), p.stock, MAX_QTY_PER_LINE);
      existing.savedForLater = false;
    } else if (cart.items.length < 50) {
      cart.items.push({ product: g.productId, quantity: Math.min(g.quantity, p.stock, MAX_QTY_PER_LINE), color, size });
    }
  }
  await cart.save();
  res.json({
    success: true,
    message: skipped ? `${skipped} unavailable item${skipped === 1 ? ' was' : 's were'} not added` : 'Cart synced',
    data: await serialize(cart, req.user._id),
  });
});

/* POST /api/cart/coupon { code } */
const applyCoupon = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const { lines } = await priceLines(cart.items);
  const totals = await computeTotals(lines, { userId: req.user._id });
  if (totals.subtotal <= 0) throw ApiError.badRequest('Add items to your cart before applying a coupon');
  const { coupon, discount } = await evaluateCoupon(req.body.code, { subtotal: totals.subtotal, userId: req.user._id });
  cart.couponCode = coupon.code;
  await cart.save();
  res.json({ success: true, message: `${coupon.code} applied — you save ₹${discount.toLocaleString('en-IN')}`, data: await serialize(cart, req.user._id) });
});

/* DELETE /api/cart/coupon */
const removeCoupon = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.couponCode = null;
  await cart.save();
  res.json({ success: true, message: 'Coupon removed', data: await serialize(cart, req.user._id) });
});

/**
 * POST /api/cart/quote — prices a guest cart (no auth). Lets guests see accurate,
 * server-computed totals before they sign in. Nothing is persisted.
 */
const quote = asyncHandler(async (req, res) => {
  const raw = req.body.items.map((i) => ({ product: i.productId, quantity: i.quantity, color: i.color, size: i.size, savedForLater: i.savedForLater }));
  const { lines } = await priceLines(raw);
  const totals = await computeTotals(lines, {});
  res.json({ success: true, data: { items: lines, totals } });
});

module.exports = { getCart, addItem, updateItem, removeItem, clearCart, mergeCart, applyCoupon, removeCoupon, quote };
