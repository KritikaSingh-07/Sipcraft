const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { uploadBuffer, deleteImage } = require('../services/uploadService');

const ADMIN_FOLDERS = new Set(['products', 'categories', 'banners', 'team']);

/* POST /api/uploads/:folder (admin) — multipart "images"; returns [{ url, publicId }] */
const adminUpload = asyncHandler(async (req, res) => {
  const { folder } = req.params;
  if (!ADMIN_FOLDERS.has(folder)) throw ApiError.badRequest('Invalid upload folder');
  if (!req.files?.length) throw ApiError.badRequest('Choose at least one image');
  const images = [];
  for (const file of req.files) images.push(await uploadBuffer(file, folder));
  res.status(201).json({ success: true, message: `${images.length} image${images.length === 1 ? '' : 's'} uploaded`, data: images });
});

/* POST /api/uploads/review/images (customer) — up to 4 review photos */
const reviewUpload = asyncHandler(async (req, res) => {
  if (!req.files?.length) throw ApiError.badRequest('Choose at least one image');
  const images = [];
  for (const file of req.files.slice(0, 4)) images.push(await uploadBuffer(file, `reviews/${req.user._id}`));
  res.status(201).json({ success: true, data: images });
});

/* DELETE /api/uploads (admin) { publicId } — removes an orphaned upload (e.g. a cancelled form) */
const adminDeleteUpload = asyncHandler(async (req, res) => {
  const publicId = String(req.body.publicId || '');
  if (!/^(local:)?[\w\-/.]+$/.test(publicId) || publicId.includes('..')) throw ApiError.badRequest('Invalid image id');
  await deleteImage(publicId);
  res.json({ success: true, message: 'Image deleted' });
});

module.exports = { adminUpload, reviewUpload, adminDeleteUpload };
