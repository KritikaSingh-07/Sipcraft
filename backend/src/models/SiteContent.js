const mongoose = require('mongoose');

/**
 * Admin-editable page content, one document per page key (home | about | services).
 * The shape of `data` is validated per key by Zod before saving (see validators/content.js).
 */
const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, enum: ['home', 'about', 'services'] },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
