/* Smaller content models grouped together; each is still its own Mongoose model. */
const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({ url: String, publicId: String }, { _id: false });

const ContactMessage = mongoose.model(
  'ContactMessage',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
      phone: { type: String, trim: true, maxlength: 20 },
      subject: { type: String, required: true, trim: true, maxlength: 150 },
      message: { type: String, required: true, trim: true, maxlength: 3000 },
      status: { type: String, enum: ['new', 'read', 'replied', 'resolved', 'archived'], default: 'new', index: true },
      replies: [{ message: { type: String, maxlength: 5000 }, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, _id: false }],
      ipAddress: String,
    },
    { timestamps: true },
  ),
);

const Notification = mongoose.model(
  'Notification',
  new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      type: { type: String, enum: ['order', 'payment', 'account', 'promo', 'review'], default: 'order' },
      title: { type: String, required: true, maxlength: 120 },
      message: { type: String, required: true, maxlength: 500 },
      link: String,
      isRead: { type: Boolean, default: false, index: true },
    },
    { timestamps: true },
  ),
);

const Banner = mongoose.model(
  'Banner',
  new mongoose.Schema(
    {
      title: { type: String, required: true, trim: true, maxlength: 120 },
      subtitle: { type: String, trim: true, maxlength: 240 },
      eyebrow: { type: String, trim: true, maxlength: 60 },
      image: imageSchema,
      ctaText: { type: String, trim: true, maxlength: 40 },
      ctaLink: { type: String, trim: true, maxlength: 300 },
      placement: { type: String, enum: ['hero', 'promo', 'announcement'], default: 'promo', index: true },
      theme: { type: String, enum: ['light', 'dark', 'accent'], default: 'dark' },
      isActive: { type: Boolean, default: true },
      sortOrder: { type: Number, default: 0 },
      startsAt: Date,
      endsAt: Date,
    },
    { timestamps: true },
  ),
);

const TeamMember = mongoose.model(
  'TeamMember',
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 80 },
      position: { type: String, required: true, trim: true, maxlength: 80 },
      bio: { type: String, trim: true, maxlength: 600 },
      department: { type: String, trim: true, maxlength: 40 },
      location: { type: String, trim: true, maxlength: 60 },
      funFact: { type: String, trim: true, maxlength: 200 },
      favourite: { type: String, trim: true, maxlength: 80 },
      image: imageSchema,
      socials: { linkedin: String, instagram: String, twitter: String, email: String },
      sortOrder: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const NewsletterSubscriber = mongoose.model(
  'NewsletterSubscriber',
  new mongoose.Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const Setting = mongoose.model(
  'Setting',
  new mongoose.Schema(
    {
      key: { type: String, default: 'store', unique: true },
      storeName: { type: String, default: 'Sipcraft' },
      supportEmail: { type: String, default: 'care@sipcraft.in' },
      supportPhone: { type: String, default: '+91 80 4718 2200' },
      address: { type: String, default: '3rd Floor, 12 Lavelle Road, Bengaluru, Karnataka 560001' },
      announcement: { type: String, default: 'Free shipping on orders above ₹999 · Use WELCOME10 for 10% off your first order' },
      shippingFee: { type: Number, min: 0 },
      freeShippingThreshold: { type: Number, min: 0 },
      taxRate: { type: Number, min: 0, max: 50 },
      reviewsRequireApproval: { type: Boolean, default: false },
      returnPolicy: { type: String, default: 'Easy 7-day returns on unused products in original packaging. Refunds are credited to the original payment method within 5–7 business days of pickup.' },
      returnWindowDays: { type: Number, default: 7, min: 0, max: 60 },
      newsletterEnabled: { type: Boolean, default: true },
      socials: { instagram: String, facebook: String, twitter: String, youtube: String },
    },
    { timestamps: true },
  ),
);

module.exports = { ContactMessage, Notification, Banner, TeamMember, NewsletterSubscriber, Setting };
