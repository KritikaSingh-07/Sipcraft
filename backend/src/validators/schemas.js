const { z, objectId, trimmed, optionalText, email, phone, password, booleanish, pageQuery, imageRef } = require('./common');

/* ─── Auth ─────────────────────────────────────────────── */
const auth = {
  register: z
    .object({
      name: trimmed(80).min(2, 'Name must be at least 2 characters'),
      email,
      phone: phone.optional().or(z.literal('').transform(() => undefined)),
      password,
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] }),
  login: z.object({ email, password: z.string().min(1, 'Password is required').max(128) }),
  forgotPassword: z.object({ email }),
  resetPassword: z
    .object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid or expired reset link'), password, confirmPassword: z.string() })
    .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] }),
  changePassword: z
    .object({ currentPassword: z.string().min(1).max(128), newPassword: password, confirmPassword: z.string() })
    .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
    .refine((d) => d.newPassword !== d.currentPassword, { message: 'New password must be different', path: ['newPassword'] }),
};

/* ─── User ─────────────────────────────────────────────── */
const user = {
  updateProfile: z.object({
    name: trimmed(80).min(2).optional(),
    phone: phone.optional().or(z.literal('').transform(() => '')),
  }),
};

const address = z.object({
  label: optionalText(30),
  fullName: trimmed(80).min(2, 'Full name is required'),
  phone,
  email: email.optional().or(z.literal('').transform(() => undefined)),
  address: trimmed(200).min(5, 'Address is required'),
  apartment: optionalText(120),
  city: trimmed(80).min(2, 'City is required'),
  state: trimmed(80).min(2, 'State is required'),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
  country: trimmed(60).min(2).default('India'),
  isDefault: z.boolean().optional(),
});

/* ─── Catalog ──────────────────────────────────────────── */
const productQuery = z.object({
  ...pageQuery,
  search: optionalText(100),
  q: optionalText(100),
  category: optionalText(200), // slug or comma-separated slugs
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  availability: z.enum(['in_stock', 'out_of_stock', 'all']).optional(),
  sort: z.enum(['newest', 'price-low', 'price-high', 'rating', 'popularity', 'relevance', 'name']).optional(),
  featured: booleanish.optional(),
  bestSeller: booleanish.optional(),
  newArrival: booleanish.optional(),
  tag: optionalText(40),
  ids: optionalText(1300), // comma separated ids (recently viewed)
  exclude: objectId.optional(),
});

const productBody = z.object({
  name: trimmed(120).min(2),
  slug: optionalText(140),
  sku: trimmed(40).min(2),
  brand: optionalText(60),
  description: trimmed(5000).min(10),
  shortDescription: optionalText(300),
  category: objectId,
  price: z.coerce.number().min(1),
  mrp: z.coerce.number().min(1),
  stock: z.coerce.number().int().min(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  images: z.array(imageRef).max(12).default([]),
  colors: z.array(z.object({ name: trimmed(40).min(1), hex: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/).optional() })).max(12).default([]),
  sizes: z.array(trimmed(30).min(1)).max(10).default([]),
  capacity: optionalText(40),
  material: optionalText(120),
  features: z.array(trimmed(200).min(1)).max(20).default([]),
  specifications: z.array(z.object({ key: trimmed(60).min(1), value: trimmed(200).min(1) })).max(30).default([]),
  careInstructions: z.array(trimmed(200).min(1)).max(15).default([]),
  shippingInfo: optionalText(1000),
  returnInfo: optionalText(1000),
  tags: z.array(trimmed(40).min(1)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isArchived: z.boolean().optional(),
});

const product = {
  query: productQuery,
  create: productBody.refine((d) => d.mrp >= d.price, { message: 'MRP must be greater than or equal to price', path: ['mrp'] }),
  update: productBody.partial().refine((d) => d.mrp === undefined || d.price === undefined || d.mrp >= d.price, {
    message: 'MRP must be greater than or equal to price',
    path: ['mrp'],
  }),
  bulk: z.object({
    ids: z.array(objectId).min(1).max(100),
    action: z.enum(['activate', 'deactivate', 'delete', 'feature', 'unfeature', 'bestseller', 'unbestseller', 'archive', 'unarchive']),
  }),
  reorderImages: z.object({ order: z.array(z.string().min(1)).min(1).max(12) }),
  adminQuery: z.object({
    ...pageQuery,
    search: optionalText(100),
    category: objectId.optional(),
    status: z.enum(['active', 'inactive', 'archived', 'all']).optional(),
    stock: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'all']).optional(),
    sort: z.enum(['newest', 'oldest', 'name', 'price-low', 'price-high', 'stock-low', 'best-selling']).optional(),
  }),
};

const category = {
  create: z.object({
    name: trimmed(60).min(2),
    slug: optionalText(80),
    description: optionalText(500),
    image: imageRef.optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
  }),
};
category.update = category.create.partial();

/* ─── Cart / wishlist ──────────────────────────────────── */
const cartLine = z.object({
  productId: objectId,
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  color: optionalText(40),
  size: optionalText(30),
});
const cart = {
  add: cartLine,
  update: z
    .object({ quantity: z.coerce.number().int().min(1).max(20).optional(), savedForLater: z.boolean().optional(), color: optionalText(40), size: optionalText(30) })
    .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' }),
  merge: z.object({ items: z.array(cartLine).max(50) }),
  quote: z.object({ items: z.array(cartLine.extend({ savedForLater: z.boolean().optional() })).max(50) }),
  coupon: z.object({ code: trimmed(30).min(1, 'Enter a coupon code') }),
  itemParams: z.object({ itemId: objectId }),
};

/* ─── Checkout / payments / orders ─────────────────────── */
const contact = z.object({ name: trimmed(80).min(2), email, phone });
const checkout = z
  .object({
    addressId: objectId.optional(),
    address: address.omit({ isDefault: true, label: true }).optional(),
    contact,
    couponCode: optionalText(30),
  })
  .refine((d) => d.addressId || d.address, { message: 'Select or enter a shipping address', path: ['addressId'] });

const payment = {
  createOrder: checkout,
  verify: z.object({
    razorpay_order_id: z.string().trim().min(5).max(64),
    razorpay_payment_id: z.string().trim().min(5).max(64),
    razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/, 'Invalid signature'),
  }),
  failed: z.object({
    razorpay_order_id: z.string().trim().min(5).max(64),
    reason: optionalText(300),
  }),
};

const order = {
  cancel: z.object({ reason: optionalText(300) }),
  return: z.object({ reason: trimmed(300).min(5, 'Tell us briefly why you are returning the order') }),
  adminQuery: z.object({
    ...pageQuery,
    search: optionalText(100),
    status: optionalText(40),
    paymentStatus: optionalText(20),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    user: objectId.optional(),
  }),
  updateStatus: z.object({
    status: z.enum(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED']),
    note: optionalText(300),
    trackingNumber: optionalText(60),
    carrier: optionalText(60),
  }),
  userQuery: z.object({ ...pageQuery, status: optionalText(40) }),
};

/* ─── Reviews ──────────────────────────────────────────── */
const review = {
  create: z.object({
    orderId: objectId,
    rating: z.coerce.number().int().min(1).max(5),
    title: optionalText(120),
    comment: trimmed(2000).min(10, 'Please write at least 10 characters'),
    images: z.array(imageRef).max(4).default([]),
  }),
  update: z.object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    title: optionalText(120),
    comment: trimmed(2000).min(10).optional(),
  }),
  query: z.object({ ...pageQuery, sort: z.enum(['newest', 'highest', 'lowest']).optional(), rating: z.coerce.number().int().min(1).max(5).optional() }),
  adminQuery: z.object({ ...pageQuery, status: z.enum(['pending', 'approved', 'hidden', 'reported', 'all']).optional(), search: optionalText(100) }),
  report: z.object({ reason: trimmed(300).min(3, 'Tell us what is wrong with this review') }),
  moderate: z.object({ status: z.enum(['pending', 'approved', 'hidden']) }),
  productParams: z.object({ productId: objectId }),
};

/* ─── Coupons ──────────────────────────────────────────── */
const couponBody = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3–30 letters, numbers, - or _'),
  description: optionalText(200),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.coerce.number().positive(),
  minimumOrderAmount: z.coerce.number().min(0).default(0),
  maximumDiscount: z.coerce.number().min(0).nullable().optional(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date(),
  usageLimit: z.coerce.number().int().min(0).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(0).default(1),
  isActive: z.boolean().default(true),
});
const coupon = {
  create: couponBody.refine((d) => d.discountType !== 'percentage' || d.discountValue <= 100, {
    message: 'Percentage cannot exceed 100',
    path: ['discountValue'],
  }),
  update: couponBody.partial(),
  validate: z.object({ code: trimmed(30).min(1, 'Enter a coupon code') }),
};

/* ─── Content ──────────────────────────────────────────── */
const contactMessage = z.object({
  name: trimmed(80).min(2, 'Please enter your name'),
  email,
  phone: phone.optional().or(z.literal('').transform(() => undefined)),
  subject: trimmed(150).min(3, 'Please add a subject'),
  message: trimmed(3000).min(10, 'Message must be at least 10 characters'),
});

const banner = z.object({
  title: trimmed(120).min(2),
  subtitle: optionalText(240),
  eyebrow: optionalText(60),
  image: imageRef.optional().nullable(),
  ctaText: optionalText(40),
  ctaLink: z.string().trim().max(300).regex(/^(\/|https:\/\/)/, 'Link must start with / or https://').optional().or(z.literal('').transform(() => undefined)),
  placement: z.enum(['hero', 'promo', 'announcement']).default('promo'),
  theme: z.enum(['light', 'dark', 'accent']).default('dark'),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

const url = z.string().trim().max(300).regex(/^https:\/\//, 'Must be an https:// link').optional().or(z.literal('').transform(() => undefined));
const teamMember = z.object({
  name: trimmed(80).min(2),
  position: trimmed(80).min(2),
  bio: optionalText(600),
  department: optionalText(40),
  location: optionalText(60),
  funFact: optionalText(200),
  favourite: optionalText(80),
  image: imageRef.optional().nullable(),
  socials: z.object({ linkedin: url, instagram: url, twitter: url, email: email.optional().or(z.literal('').transform(() => undefined)) }).default({}),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

const settings = z.object({
  storeName: trimmed(60).min(2).optional(),
  supportEmail: email.optional(),
  supportPhone: optionalText(30),
  address: optionalText(300),
  announcement: optionalText(200),
  shippingFee: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(50).optional(),
  reviewsRequireApproval: z.boolean().optional(),
  returnPolicy: optionalText(1000),
  returnWindowDays: z.coerce.number().int().min(0).max(60).optional(),
  newsletterEnabled: z.boolean().optional(),
  socials: z.object({ instagram: url, facebook: url, twitter: url, youtube: url }).optional(),
});

const adminUser = {
  query: z.object({ ...pageQuery, search: optionalText(100), status: z.enum(['active', 'inactive', 'all']).optional(), role: z.enum(['user', 'admin', 'all']).optional() }),
  update: z.object({ isActive: z.boolean().optional(), role: z.enum(['user', 'admin']).optional() }),
};

const newsletter = z.object({ email });

const adminNotification = z
  .object({
    audience: z.enum(['user', 'all']),
    email: email.optional(),
    userId: objectId.optional(),
    type: z.enum(['order', 'payment', 'account', 'promo', 'review']).default('promo'),
    title: trimmed(120).min(2, 'Add a title'),
    message: trimmed(500).min(2, 'Add a message'),
    link: z.string().trim().max(300).regex(/^\/(?!\/)/, 'Use a site path such as /products').optional().or(z.literal('').transform(() => undefined)),
  })
  .refine((d) => d.audience === 'all' || d.email || d.userId, { message: 'Enter the customer email', path: ['email'] });

module.exports = {
  auth,
  user,
  address,
  product,
  category,
  cart,
  checkout,
  payment,
  order,
  review,
  coupon,
  contactMessage,
  banner,
  teamMember,
  settings,
  adminUser,
  newsletter,
  adminNotification,
};
