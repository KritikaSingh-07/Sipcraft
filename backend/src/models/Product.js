const mongoose = require('mongoose');
const { toSlug } = require('../utils/helpers');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    alt: { type: String, trim: true, maxlength: 160 },
  },
  { _id: true },
);

const colorSchema = new mongoose.Schema(
  { name: { type: String, required: true, trim: true, maxlength: 40 }, hex: { type: String, trim: true, maxlength: 9 } },
  { _id: false },
);

const specSchema = new mongoose.Schema(
  { key: { type: String, required: true, trim: true, maxlength: 60 }, value: { type: String, required: true, trim: true, maxlength: 200 } },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
    brand: { type: String, trim: true, default: 'Sipcraft', maxlength: 60 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },

    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    soldCount: { type: Number, default: 0, min: 0 },

    images: { type: [imageSchema], default: [] },
    colors: { type: [colorSchema], default: [] },
    sizes: { type: [String], default: [] },
    capacity: { type: String, trim: true, maxlength: 40 },
    material: { type: String, trim: true, maxlength: 120 },
    features: { type: [String], default: [] },
    specifications: { type: [specSchema], default: [] },
    careInstructions: { type: [String], default: [] },
    shippingInfo: { type: String, trim: true, maxlength: 1000 },
    returnInfo: { type: String, trim: true, maxlength: 1000 },
    tags: { type: [String], default: [], index: true },

    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // Archived products are retired: hidden from the store and from the default admin list.
    isArchived: { type: Boolean, default: false, index: true },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

productSchema.index({ name: 'text', description: 'text', sku: 'text', tags: 'text' }, { weights: { name: 10, sku: 8, tags: 5, description: 1 } });
productSchema.index({ isActive: 1, category: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, soldCount: -1 });
productSchema.index({ isActive: 1, rating: -1 });

productSchema.virtual('stockStatus').get(function stockStatus() {
  if (this.stock <= 0) return 'out_of_stock';
  if (this.stock <= this.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

productSchema.pre('validate', function derive() {
  this.slug = toSlug(this.slug || this.name);
  if (this.mrp < this.price) this.mrp = this.price;
  this.discount = this.mrp > 0 ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;
  if (this.isArchived) this.isActive = false;
  if (this.tags) this.tags = [...new Set(this.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean))];
});

module.exports = mongoose.model('Product', productSchema);
