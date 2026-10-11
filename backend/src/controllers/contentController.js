/* Banners, team members and store settings. */
const { Banner, TeamMember, Setting } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { deleteImage } = require('../services/uploadService');
const { getSettings, invalidateSettings } = require('../services/settingsService');
const { env } = require('../config/env');

/* ─── Banners ──────────────────────────────────────────── */
const listActiveBanners = asyncHandler(async (req, res) => {
  const now = new Date();
  const filter = {
    isActive: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  };
  if (req.query.placement) filter.placement = String(req.query.placement);
  const items = await Banner.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();
  res.json({ success: true, data: items });
});

const adminListBanners = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Banner.find().sort({ placement: 1, sortOrder: 1 }).lean() });
});

const createBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.create(req.body);
  await logActivity(req, { action: 'banner.created', entity: 'banner', entityId: banner._id, description: `Created banner “${banner.title}”` });
  res.status(201).json({ success: true, message: 'Banner created', data: banner });
});

const updateBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw ApiError.notFound('Banner not found');
  const old = banner.image?.publicId;
  Object.assign(banner, req.body);
  await banner.save();
  await logActivity(req, { action: 'banner.updated', entity: 'banner', entityId: banner._id, description: `Updated banner “${banner.title}”${req.body.isActive !== undefined ? (req.body.isActive ? ' (published)' : ' (hidden)') : ''}` });
  if (old && req.body.image !== undefined && req.body.image?.publicId !== old) await deleteImage(old);
  res.json({ success: true, message: 'Banner updated', data: banner });
});

const deleteBanner = asyncHandler(async (req, res) => {
  const banner = await Banner.findByIdAndDelete(req.params.id);
  if (!banner) throw ApiError.notFound('Banner not found');
  await logActivity(req, { action: 'banner.deleted', entity: 'banner', entityId: banner._id, description: `Deleted banner “${banner.title}”` });
  await deleteImage(banner.image?.publicId);
  res.json({ success: true, message: 'Banner deleted' });
});

/* ─── Team ─────────────────────────────────────────────── */
const listTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await TeamMember.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean() });
});

const adminListTeam = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await TeamMember.find().sort({ sortOrder: 1, createdAt: 1 }).lean() });
});

const createTeamMember = asyncHandler(async (req, res) => {
  const member = await TeamMember.create(req.body);
  await logActivity(req, { action: 'team.created', entity: 'team', entityId: member._id, description: `Added ${member.name} to the team page` });
  res.status(201).json({ success: true, message: 'Team member added', data: member });
});

const updateTeamMember = asyncHandler(async (req, res) => {
  const member = await TeamMember.findById(req.params.id);
  if (!member) throw ApiError.notFound('Team member not found');
  const old = member.image?.publicId;
  Object.assign(member, req.body);
  await member.save();
  await logActivity(req, { action: 'team.updated', entity: 'team', entityId: member._id, description: `Updated team member ${member.name}` });
  if (old && req.body.image !== undefined && req.body.image?.publicId !== old) await deleteImage(old);
  res.json({ success: true, message: 'Team member updated', data: member });
});

const deleteTeamMember = asyncHandler(async (req, res) => {
  const member = await TeamMember.findByIdAndDelete(req.params.id);
  if (!member) throw ApiError.notFound('Team member not found');
  await logActivity(req, { action: 'team.deleted', entity: 'team', entityId: member._id, description: `Removed ${member.name} from the team page` });
  await deleteImage(member.image?.publicId);
  res.json({ success: true, message: 'Team member removed' });
});

/* ─── Settings ─────────────────────────────────────────── */
const publicSettings = asyncHandler(async (req, res) => {
  const s = await getSettings();
  res.json({
    success: true,
    data: {
      storeName: s.storeName,
      supportEmail: s.supportEmail,
      supportPhone: s.supportPhone,
      address: s.address,
      announcement: s.announcement,
      shippingFee: s.shippingFee,
      freeShippingThreshold: s.freeShippingThreshold,
      taxRate: s.taxRate,
      currency: s.currency,
      socials: s.socials || {},
      returnPolicy: s.returnPolicy,
      returnWindowDays: s.returnWindowDays ?? 7,
      newsletterEnabled: s.newsletterEnabled !== false,
      paymentsEnabled: env.features.payments(),
      uploadsEnabled: true,
      uploadStorage: env.features.uploads() ? 'cloudinary' : 'local',
    },
  });
});

const adminGetSettings = asyncHandler(async (req, res) => {
  const s = await getSettings({ fresh: true });
  res.json({
    success: true,
    data: {
      ...s,
      integrations: { payments: env.features.payments(), uploads: env.features.uploads() ? 'cloudinary' : 'local', smtp: env.features.smtp(), webhook: Boolean(env.razorpay.webhookSecret) },
    },
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  await Setting.updateOne({ key: 'store' }, { $set: req.body }, { upsert: true });
  invalidateSettings();
  await logActivity(req, { action: 'settings.updated', entity: 'settings', description: `Updated store settings: ${Object.keys(req.body).join(', ')}` });
  res.json({ success: true, message: 'Settings saved', data: await getSettings({ fresh: true }) });
});

module.exports = {
  listActiveBanners,
  adminListBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  listTeam,
  adminListTeam,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  publicSettings,
  adminGetSettings,
  updateSettings,
};
