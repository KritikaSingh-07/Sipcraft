const { Category, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { deleteImage } = require('../services/uploadService');

/* GET /api/categories — active categories with product counts (admins can pass ?all=true) */
const listCategories = asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === 'true' && req.user?.role === 'admin';
  const categories = await Category.find(includeInactive ? {} : { isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([
    { $match: includeInactive ? {} : { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({ success: true, data: categories.map((c) => ({ ...c, productCount: byId.get(String(c._id)) || 0 })) });
});

/* GET /api/categories/:slug */
const getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!category) throw ApiError.notFound('Category not found');
  res.json({ success: true, data: category });
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  await logActivity(req, { action: 'category.created', entity: 'category', entityId: category._id, description: `Created category ${category.name}` });
  res.status(201).json({ success: true, message: 'Category created', data: category });
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  const oldImage = category.image?.publicId;
  Object.assign(category, req.body);
  await category.save();
  await logActivity(req, { action: 'category.updated', entity: 'category', entityId: category._id, description: `Updated category ${category.name}${req.body.isActive !== undefined ? (req.body.isActive ? ' (enabled)' : ' (disabled)') : ''}` });
  if (oldImage && req.body.image !== undefined && req.body.image?.publicId !== oldImage) await deleteImage(oldImage);
  res.json({ success: true, message: 'Category updated', data: category });
});

/* DELETE /api/categories/:id — blocked while products still use the category. */
const deleteCategory = asyncHandler(async (req, res) => {
  const inUse = await Product.countDocuments({ category: req.params.id });
  if (inUse) {
    throw ApiError.conflict(`This category has ${inUse} product${inUse === 1 ? '' : 's'}. Move or delete them first, or disable the category instead.`, {
      code: 'CATEGORY_IN_USE',
    });
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) throw ApiError.notFound('Category not found');
  await deleteImage(category.image?.publicId);
  await logActivity(req, { action: 'category.deleted', entity: 'category', entityId: category._id, description: `Deleted category ${category.name}` });
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
