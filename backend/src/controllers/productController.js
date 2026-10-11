const mongoose = require('mongoose');
const { Product, Category, Review, Cart, Wishlist } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { escapeRegex, parsePagination, paginated } = require('../utils/helpers');
const { uploadBuffer, deleteImage } = require('../services/uploadService');

const PUBLIC_FIELDS =
  'name slug sku brand shortDescription category price mrp discount stock lowStockThreshold images colors sizes capacity material tags isFeatured isBestSeller isNewArrival rating reviewCount soldCount createdAt';

const SORTS = {
  newest: { createdAt: -1 },
  'price-low': { price: 1, _id: 1 },
  'price-high': { price: -1, _id: 1 },
  rating: { rating: -1, reviewCount: -1 },
  popularity: { soldCount: -1, rating: -1 },
  name: { name: 1 },
  relevance: { isFeatured: -1, soldCount: -1 },
};

const withStockStatus = (p) => ({
  ...p,
  stockStatus: p.stock <= 0 ? 'out_of_stock' : p.stock <= (p.lowStockThreshold ?? 5) ? 'low_stock' : 'in_stock',
});

/** Builds a Mongo filter for the public catalogue from validated query params. */
async function buildPublicFilter(q) {
  const inactiveCats = await Category.find({ isActive: false }).distinct('_id');
  const filter = { isActive: true };
  if (inactiveCats.length) filter.category = { $nin: inactiveCats };

  if (q.category) {
    const slugs = q.category.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const cats = await Category.find({ slug: { $in: slugs }, isActive: true }).distinct('_id');
    filter.category = { $in: cats };
  }

  const term = (q.search || q.q || '').trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const matchingCats = await Category.find({ name: rx, isActive: true }).distinct('_id');
    filter.$or = [{ name: rx }, { sku: rx }, { tags: rx }, { description: rx }, { shortDescription: rx }, { material: rx }];
    if (matchingCats.length) filter.$or.push({ category: { $in: matchingCats } });
  }

  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }
  if (q.rating) filter.rating = { $gte: q.rating };
  if (q.availability === 'in_stock') filter.stock = { $gt: 0 };
  if (q.availability === 'out_of_stock') filter.stock = { $lte: 0 };
  if (q.featured) filter.isFeatured = true;
  if (q.bestSeller) filter.isBestSeller = true;
  if (q.newArrival) filter.isNewArrival = true;
  if (q.tag) filter.tags = q.tag.toLowerCase();
  if (q.ids) {
    const ids = q.ids.split(',').filter((id) => mongoose.isValidObjectId(id)).slice(0, 50);
    filter._id = { $in: ids };
  }
  if (q.exclude) filter._id = { ...(filter._id || {}), $ne: q.exclude };
  return filter;
}

/* GET /api/products */
const listProducts = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = parsePagination(q, { defaultLimit: 12, maxLimit: 48 });
  const filter = await buildPublicFilter(q);
  const sort = SORTS[q.sort || (q.search || q.q ? 'relevance' : 'newest')] || SORTS.newest;

  const [items, total, priceRange] = await Promise.all([
    Product.find(filter).select(PUBLIC_FIELDS).populate('category', 'name slug').sort(sort).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
    Product.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } }]),
  ]);

  // Preserve the requested order for "recently viewed" lookups.
  let ordered = items;
  if (q.ids) {
    const order = q.ids.split(',');
    ordered = [...items].sort((a, b) => order.indexOf(String(a._id)) - order.indexOf(String(b._id)));
  }

  res.json({
    success: true,
    data: { ...paginated(ordered.map(withStockStatus), total, page, limit), priceRange: { min: priceRange[0]?.min || 0, max: priceRange[0]?.max || 0 } },
  });
});

/* GET /api/products/suggestions?q= — lightweight autocomplete */
const suggestions = asyncHandler(async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 60);
  if (term.length < 2) return res.json({ success: true, data: { products: [], categories: [] } });
  const rx = new RegExp(escapeRegex(term), 'i');
  const [products, categories] = await Promise.all([
    Product.find({ isActive: true, $or: [{ name: rx }, { sku: rx }, { tags: rx }] })
      .select('name slug price mrp images rating')
      .sort({ soldCount: -1 })
      .limit(6)
      .lean(),
    Category.find({ isActive: true, name: rx }).select('name slug').limit(3).lean(),
  ]);
  res.json({
    success: true,
    data: { products: products.map((p) => ({ ...p, image: p.images?.[0]?.url, images: undefined })), categories },
  });
});

/* GET /api/products/:slug */
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate('category', 'name slug isActive').lean();
  if (!product || product.category?.isActive === false) throw ApiError.notFound('We couldn’t find that product');

  const [distribution, related] = await Promise.all([
    Review.aggregate([
      { $match: { product: product._id, status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
    Product.find({ isActive: true, category: product.category._id, _id: { $ne: product._id } })
      .select(PUBLIC_FIELDS)
      .populate('category', 'name slug')
      .sort({ soldCount: -1 })
      .limit(8)
      .lean(),
  ]);

  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: distribution.find((d) => d._id === r)?.count || 0 }));
  res.json({ success: true, data: { product: withStockStatus(product), ratingDistribution, related: related.map(withStockStatus) } });
});

/* ─── Admin ────────────────────────────────────────────── */

const ADMIN_SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  'price-low': { price: 1 },
  'price-high': { price: -1 },
  'stock-low': { stock: 1 },
  'best-selling': { soldCount: -1 },
};

/* GET /api/products/admin/list */
const adminListProducts = asyncHandler(async (req, res) => {
  const q = req.query;
  const { page, limit, skip } = parsePagination(q, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { tags: rx }];
  }
  if (q.category) filter.category = q.category;
  if (q.status === 'archived') filter.isArchived = true;
  else filter.isArchived = { $ne: true };
  if (q.status === 'active') filter.isActive = true;
  if (q.status === 'inactive') filter.isActive = false;
  if (q.stock === 'out_of_stock') filter.stock = { $lte: 0 };
  if (q.stock === 'low_stock') filter.$expr = { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] };
  if (q.stock === 'in_stock') filter.$expr = { $gt: ['$stock', '$lowStockThreshold'] };

  const [items, total, counts] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(ADMIN_SORTS[q.sort] || ADMIN_SORTS.newest).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
    Product.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
          archived: { $sum: { $cond: ['$isArchived', 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }, 1, 0] } },
        },
      },
    ]),
  ]);
  res.json({ success: true, data: { ...paginated(items.map(withStockStatus), total, page, limit), counts: counts[0] || {} } });
});

/* GET /api/products/admin/:id */
const adminGetProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('category', 'name slug').lean();
  if (!product) throw ApiError.notFound('Product not found');
  res.json({ success: true, data: withStockStatus(product) });
});

async function assertCategory(id) {
  if (id && !(await Category.exists({ _id: id }))) throw ApiError.badRequest('Selected category does not exist');
}

/* POST /api/products */
const createProduct = asyncHandler(async (req, res) => {
  await assertCategory(req.body.category);
  const product = await Product.create(req.body);
  await logActivity(req, { action: 'product.created', entity: 'product', entityId: product._id, description: `Created ${product.name} (${product.sku})` });
  res.status(201).json({ success: true, message: 'Product created', data: product });
});

/* PUT /api/products/:id */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  await assertCategory(req.body.category);

  // Remove Cloudinary assets for images dropped in this update.
  if (req.body.images) {
    const keep = new Set(req.body.images.map((i) => i.publicId).filter(Boolean));
    const removed = product.images.filter((i) => i.publicId && !keep.has(i.publicId));
    await Promise.all(removed.map((i) => deleteImage(i.publicId)));
  }
  const changed = Object.keys(req.body).filter((k) => JSON.stringify(product[k]) !== JSON.stringify(req.body[k]));
  const priceChange = req.body.price !== undefined && req.body.price !== product.price ? ` price ₹${product.price}→₹${req.body.price}` : '';
  const stockChange = req.body.stock !== undefined && req.body.stock !== product.stock ? ` stock ${product.stock}→${req.body.stock}` : '';
  Object.assign(product, req.body);
  await product.save();
  await logActivity(req, { action: 'product.updated', entity: 'product', entityId: product._id, description: `Updated ${product.name}${priceChange}${stockChange}`, metadata: { fields: changed } });
  res.json({ success: true, message: 'Product updated', data: product });
});

async function removeProducts(ids) {
  const products = await Product.find({ _id: { $in: ids } }).select('images');
  await Promise.all(products.flatMap((p) => p.images.map((i) => deleteImage(i.publicId))));
  await Promise.all([
    Product.deleteMany({ _id: { $in: ids } }),
    Review.deleteMany({ product: { $in: ids } }),
    Cart.updateMany({}, { $pull: { items: { product: { $in: ids } } } }),
    Wishlist.updateMany({}, { $pull: { products: { $in: ids } } }),
  ]);
  return products.length;
}

/* DELETE /api/products/:id — order history keeps its own snapshot, so deleting is safe. */
const deleteProduct = asyncHandler(async (req, res) => {
  const existing = await Product.findById(req.params.id).select('name sku').lean();
  const n = await removeProducts([req.params.id]);
  if (!n) throw ApiError.notFound('Product not found');
  await logActivity(req, { action: 'product.deleted', entity: 'product', entityId: req.params.id, description: `Deleted ${existing?.name} (${existing?.sku})` });
  res.json({ success: true, message: 'Product deleted' });
});

/* POST /api/products/bulk */
const bulkAction = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;
  const updates = {
    activate: { isActive: true },
    deactivate: { isActive: false },
    feature: { isFeatured: true },
    unfeature: { isFeatured: false },
    bestseller: { isBestSeller: true },
    unbestseller: { isBestSeller: false },
    archive: { isArchived: true, isActive: false, isFeatured: false, isBestSeller: false },
    unarchive: { isArchived: false },
  };
  let affected;
  if (action === 'delete') affected = await removeProducts(ids);
  else affected = (await Product.updateMany({ _id: { $in: ids } }, updates[action])).modifiedCount;
  await logActivity(req, { action: `product.bulk_${action}`, entity: 'product', description: `Bulk ${action} on ${ids.length} product(s)`, metadata: { ids } });
  res.json({ success: true, message: `${affected} product${affected === 1 ? '' : 's'} updated`, data: { affected } });
});

/* POST /api/products/:id/images (multipart "images") */
const uploadProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  if (!req.files?.length) throw ApiError.badRequest('Choose at least one image');
  if (product.images.length + req.files.length > 12) throw ApiError.badRequest('A product can have at most 12 images');
  const uploaded = [];
  for (const file of req.files) uploaded.push(await uploadBuffer(file, 'products'));
  product.images.push(...uploaded.map((u) => ({ ...u, alt: product.name })));
  await product.save();
  res.status(201).json({ success: true, message: 'Images uploaded', data: product.images });
});

/* DELETE /api/products/:id/images/:imageId */
const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const img = product.images.id(req.params.imageId);
  if (!img) throw ApiError.notFound('Image not found');
  await deleteImage(img.publicId);
  img.deleteOne();
  await product.save();
  res.json({ success: true, message: 'Image removed', data: product.images });
});

/* PUT /api/products/:id/images/reorder { order: [imageId,...] } */
const reorderProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound('Product not found');
  const { order } = req.body;
  if (order.length !== product.images.length || !order.every((id) => product.images.id(id))) {
    throw ApiError.badRequest('Image order must include every image exactly once');
  }
  product.images = order.map((id) => product.images.id(id).toObject());
  await product.save();
  res.json({ success: true, message: 'Image order saved', data: product.images });
});

module.exports = {
  listProducts,
  suggestions,
  getProduct,
  adminListProducts,
  adminGetProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkAction,
  uploadProductImages,
  deleteProductImage,
  reorderProductImages,
  withStockStatus,
  PUBLIC_FIELDS,
};
