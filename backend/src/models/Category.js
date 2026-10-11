const mongoose = require('mongoose');
const { toSlug } = require('../utils/helpers');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    image: { url: String, publicId: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

categorySchema.pre('validate', function setSlug() {
  this.slug = toSlug(this.slug || this.name);
});

module.exports = mongoose.model('Category', categorySchema);
