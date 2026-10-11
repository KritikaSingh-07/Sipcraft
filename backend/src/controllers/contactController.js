const { ContactMessage, NewsletterSubscriber } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const { env } = require('../config/env');
const { queueEmail } = require('../services/emailService');
const { notifyAdmins } = require('../services/notificationService');
const { parsePagination, paginated, escapeRegex } = require('../utils/helpers');

/* POST /api/contact */
const submitContact = asyncHandler(async (req, res) => {
  const msg = await ContactMessage.create({ ...req.body, ipAddress: req.ip });
  queueEmail(env.smtp.adminNotify, 'contactNotification', { msg: msg.toObject() });
  queueEmail(msg.email, 'contactAcknowledgement', { msg: msg.toObject() });
  await notifyAdmins({ type: 'account', title: 'New contact message', message: `${msg.name}: ${msg.subject}`, link: '/admin/messages' });
  res.status(201).json({ success: true, message: 'Thanks for reaching out — we’ll get back to you within one business day.' });
});

/* POST /api/newsletter */
const subscribe = asyncHandler(async (req, res) => {
  await NewsletterSubscriber.updateOne({ email: req.body.email }, { $set: { isActive: true } }, { upsert: true });
  res.status(201).json({ success: true, message: 'You’re on the list! Watch your inbox for early drops.' });
});

/* ─── Admin ────────────────────────────────────────────── */
const listMessages = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20 });
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { subject: rx }];
  }
  const [items, total, unread] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.countDocuments({ status: 'new' }),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, page, limit), unread } });
});

const updateMessage = asyncHandler(async (req, res) => {
  const status = ['new', 'read', 'replied', 'resolved', 'archived'].includes(req.body.status) ? req.body.status : null;
  if (!status) throw ApiError.badRequest('Invalid status');
  const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
  if (!msg) throw ApiError.notFound('Message not found');
  res.json({ success: true, message: 'Message updated', data: msg });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const msg = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!msg) throw ApiError.notFound('Message not found');
  await logActivity(req, { action: 'message.deleted', entity: 'message', entityId: msg._id, description: `Deleted message from ${msg.email}: ${msg.subject}` });
  res.json({ success: true, message: 'Message deleted' });
});

const listSubscribers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50 });
  const [items, total] = await Promise.all([
    NewsletterSubscriber.find({ isActive: true }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    NewsletterSubscriber.countDocuments({ isActive: true }),
  ]);
  res.json({ success: true, data: paginated(items, total, page, limit) });
});

module.exports = { submitContact, subscribe, listMessages, updateMessage, deleteMessage, listSubscribers };
