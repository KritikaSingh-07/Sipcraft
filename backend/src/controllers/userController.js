const { Address, Order, Wishlist, Notification, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadBuffer, deleteImage } = require('../services/uploadService');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../utils/constants');
const { parsePagination, paginated } = require('../utils/helpers');

/* PUT /api/users/me */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  await req.user.save({ validateModifiedOnly: true });
  res.json({ success: true, message: 'Profile updated', data: { user: req.user.toSafeObject() } });
});

/* POST /api/users/me/avatar (multipart "avatar") */
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const image = await uploadBuffer(req.file, 'avatars');
  const old = req.user.avatar?.publicId;
  req.user.avatar = image;
  await req.user.save({ validateModifiedOnly: true });
  if (old) await deleteImage(old);
  res.json({ success: true, message: 'Profile photo updated', data: { user: req.user.toSafeObject() } });
});

/* DELETE /api/users/me/avatar */
const removeAvatar = asyncHandler(async (req, res) => {
  const old = req.user.avatar?.publicId;
  req.user.avatar = undefined;
  await req.user.save({ validateModifiedOnly: true });
  if (old) await deleteImage(old);
  res.json({ success: true, message: 'Profile photo removed', data: { user: req.user.toSafeObject() } });
});

/* GET /api/users/me/dashboard */
const dashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const visible = { user: userId, orderStatus: { $ne: ORDER_STATUS.PENDING_PAYMENT } };
  const [totalOrders, pendingOrders, deliveredOrders, wishlist, recentOrders, unread, spent] = await Promise.all([
    Order.countDocuments(visible),
    Order.countDocuments({
      user: userId,
      orderStatus: { $in: [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY] },
    }),
    Order.countDocuments({ user: userId, orderStatus: ORDER_STATUS.DELIVERED }),
    Wishlist.findOne({ user: userId }).select('products').lean(),
    Order.find(visible).sort({ createdAt: -1 }).limit(4).select('orderNumber items total orderStatus paymentStatus createdAt').lean(),
    Notification.countDocuments({ user: userId, isRead: false }),
    Order.aggregate([{ $match: { user: userId, paymentStatus: PAYMENT_STATUS.PAID } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
  ]);

  // Recommendations: best sellers from categories the customer has bought from, excluding owned items.
  const purchased = await Order.distinct('items.product', { user: userId, paymentStatus: PAYMENT_STATUS.PAID });
  const categories = await Order.distinct('items.category', { user: userId, paymentStatus: PAYMENT_STATUS.PAID });
  const filter = { isActive: true, _id: { $nin: purchased } };
  if (categories.length) filter.category = { $in: categories };
  let recommended = await Product.find(filter).sort({ soldCount: -1, rating: -1 }).limit(4).populate('category', 'name slug').lean();
  if (recommended.length < 4) {
    const more = await Product.find({ isActive: true, _id: { $nin: [...purchased, ...recommended.map((p) => p._id)] } })
      .sort({ isBestSeller: -1, soldCount: -1 })
      .limit(4 - recommended.length)
      .populate('category', 'name slug')
      .lean();
    recommended = recommended.concat(more);
  }

  res.json({
    success: true,
    data: {
      stats: {
        totalOrders,
        pendingOrders,
        deliveredOrders,
        wishlistCount: wishlist?.products?.length || 0,
        unreadNotifications: unread,
        totalSpent: spent[0]?.total || 0,
      },
      recentOrders,
      recommended,
    },
  });
});

/* ─── Addresses ────────────────────────────────────────── */
const listAddresses = asyncHandler(async (req, res) => {
  const items = await Address.find({ user: req.user._id }).sort({ isDefault: -1, updatedAt: -1 }).lean();
  res.json({ success: true, data: items });
});

const MAX_ADDRESSES = 10;

const createAddress = asyncHandler(async (req, res) => {
  const count = await Address.countDocuments({ user: req.user._id });
  if (count >= MAX_ADDRESSES) throw ApiError.badRequest(`You can save up to ${MAX_ADDRESSES} addresses`);
  const isDefault = req.body.isDefault || count === 0;
  if (isDefault) await Address.updateMany({ user: req.user._id }, { isDefault: false });
  const address = await Address.create({ ...req.body, isDefault, user: req.user._id });
  res.status(201).json({ success: true, message: 'Address saved', data: address });
});

const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) throw ApiError.notFound('Address not found');
  if (req.body.isDefault) await Address.updateMany({ user: req.user._id, _id: { $ne: address._id } }, { isDefault: false });
  // Un-defaulting is done by choosing another default, so there is always exactly one.
  const { isDefault, ...rest } = req.body;
  Object.assign(address, rest);
  if (isDefault) address.isDefault = true;
  await address.save();
  res.json({ success: true, message: 'Address updated', data: address });
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.user._id });
  if (!address) throw ApiError.notFound('Address not found');
  await Address.updateMany({ user: req.user._id }, { isDefault: false });
  address.isDefault = true;
  await address.save();
  res.json({ success: true, message: 'Default address updated', data: address });
});

const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!address) throw ApiError.notFound('Address not found');
  if (address.isDefault) {
    const next = await Address.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }
  res.json({ success: true, message: 'Address deleted' });
});

/* ─── Notifications ────────────────────────────────────── */
const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, page, limit), unread } });
});

const unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.json({ success: true, data: { unread } });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { isRead: true }, { returnDocument: 'after' });
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: n });
});

const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!n) throw ApiError.notFound('Notification not found');
  res.json({ success: true, message: 'Notification removed' });
});

module.exports = {
  updateProfile,
  uploadAvatar,
  removeAvatar,
  dashboard,
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
