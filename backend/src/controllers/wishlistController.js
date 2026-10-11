const { Wishlist, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { PUBLIC_FIELDS, withStockStatus } = require('./productController');

async function serialize(userId) {
  const wl = await Wishlist.findOne({ user: userId })
    .populate({ path: 'products', select: `${PUBLIC_FIELDS} isActive`, populate: { path: 'category', select: 'name slug' } })
    .lean();
  const products = (wl?.products || []).filter((p) => p && p.isActive).map(withStockStatus);
  return { items: products, productIds: products.map((p) => p._id) };
}

/* GET /api/wishlist */
const getWishlist = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await serialize(req.user._id) });
});

/* POST /api/wishlist/:productId */
const addToWishlist = asyncHandler(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId, isActive: true }))) throw ApiError.notFound('Product not found');
  await Wishlist.updateOne({ user: req.user._id }, { $addToSet: { products: req.params.productId } }, { upsert: true });
  res.status(201).json({ success: true, message: 'Saved to wishlist', data: await serialize(req.user._id) });
});

/* DELETE /api/wishlist/:productId */
const removeFromWishlist = asyncHandler(async (req, res) => {
  await Wishlist.updateOne({ user: req.user._id }, { $pull: { products: req.params.productId } });
  res.json({ success: true, message: 'Removed from wishlist', data: await serialize(req.user._id) });
});

/* POST /api/wishlist/merge { productIds } — merges a guest wishlist after login */
const mergeWishlist = asyncHandler(async (req, res) => {
  const valid = await Product.find({ _id: { $in: req.body.productIds }, isActive: true }).distinct('_id');
  if (valid.length) {
    await Wishlist.updateOne({ user: req.user._id }, { $addToSet: { products: { $each: valid } } }, { upsert: true });
  }
  res.json({ success: true, data: await serialize(req.user._id) });
});

module.exports = { getWishlist, addToWishlist, removeFromWishlist, mergeWishlist };
