import { z } from 'zod';

/* Client-side validation mirrors the API's rules for instant feedback.
   The server re-validates everything — these are for UX only. */

const email = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');
const phone = z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, 'Enter a valid 10-digit phone number');
const optionalPhone = z.union([z.literal(''), phone]).optional();
export const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'Too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80),
    email,
    phone: optionalPhone,
    password,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    terms: z.literal(true, { message: 'Please accept the terms to continue' }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({ password, confirmPassword: z.string().min(1, 'Confirm your password') })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password'), newPassword: password, confirmPassword: z.string().min(1, 'Confirm your new password') })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Choose a different password', path: ['newPassword'] });

export const profileSchema = z.object({ name: z.string().trim().min(2, 'Enter your full name').max(80), phone: optionalPhone });

export const addressSchema = z.object({
  label: z.string().trim().max(30).optional(),
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  phone,
  email: z.union([z.literal(''), email]).optional(),
  address: z.string().trim().min(5, 'Enter the street address').max(200),
  apartment: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'Select a state'),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode'),
  country: z.string().trim().min(2).default('India'),
  isDefault: z.boolean().optional(),
});

export const contactInfoSchema = z.object({ name: z.string().trim().min(2, 'Enter your name'), email, phone });

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(80),
  email,
  phone: optionalPhone,
  subject: z.string().trim().min(3, 'Please add a subject').max(150),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(3000),
});

export const reviewSchema = z.object({
  orderId: z.string().min(1, 'Select the order'),
  rating: z.number().int().min(1, 'Choose a star rating').max(5),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().min(10, 'Please write at least 10 characters').max(2000),
});

const list = z.array(z.string().trim().min(1)).default([]);
export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(120),
    slug: z.string().trim().max(140).optional(),
    sku: z.string().trim().min(2, 'SKU is required').max(40),
    brand: z.string().trim().max(60).optional(),
    category: z.string().min(1, 'Choose a category'),
    shortDescription: z.string().trim().max(300).optional(),
    description: z.string().trim().min(10, 'Add a description (10+ characters)').max(5000),
    price: z.coerce.number({ message: 'Enter a price' }).min(1, 'Price must be at least ₹1'),
    mrp: z.coerce.number({ message: 'Enter the MRP' }).min(1),
    stock: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    lowStockThreshold: z.coerce.number().int().min(0).default(5),
    capacity: z.string().trim().max(40).optional(),
    material: z.string().trim().max(120).optional(),
    shippingInfo: z.string().trim().max(1000).optional(),
    returnInfo: z.string().trim().max(1000).optional(),
    colors: z.array(z.object({ name: z.string().trim().min(1, 'Name required'), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use #RRGGBB') })).default([]),
    sizes: list,
    features: list,
    careInstructions: list,
    tags: list,
    specifications: z.array(z.object({ key: z.string().trim().min(1, 'Required'), value: z.string().trim().min(1, 'Required') })).default([]),
    isFeatured: z.boolean().default(false),
    isBestSeller: z.boolean().default(false),
    isNewArrival: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.mrp >= d.price, { message: 'MRP must be at least the selling price', path: ['mrp'] });

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(60),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, '3–30 letters, numbers, - or _'),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(['percentage', 'fixed']),
    discountValue: z.coerce.number().positive('Must be greater than 0'),
    minimumOrderAmount: z.coerce.number().min(0).default(0),
    maximumDiscount: z.union([z.literal(''), z.coerce.number().min(0)]).optional(),
    expiryDate: z.string().min(1, 'Choose an expiry date'),
    usageLimit: z.union([z.literal(''), z.coerce.number().int().min(0)]).optional(),
    perUserLimit: z.coerce.number().int().min(0).default(1),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.discountType !== 'percentage' || d.discountValue <= 100, { message: 'Percentage cannot exceed 100', path: ['discountValue'] });

export const bannerSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(120),
  subtitle: z.string().trim().max(240).optional(),
  eyebrow: z.string().trim().max(60).optional(),
  ctaText: z.string().trim().max(40).optional(),
  ctaLink: z.union([z.literal(''), z.string().trim().regex(/^(\/|https:\/\/)/, 'Start with / or https://')]).optional(),
  placement: z.enum(['hero', 'promo', 'announcement']),
  theme: z.enum(['light', 'dark', 'accent']),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

const httpsUrl = z.union([z.literal(''), z.string().trim().regex(/^https:\/\//, 'Must start with https://')]).optional();
export const teamSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  position: z.string().trim().min(2, 'Position is required').max(80),
  bio: z.string().trim().max(600).optional(),
  linkedin: httpsUrl,
  instagram: httpsUrl,
  twitter: httpsUrl,
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  supportEmail: email,
  supportPhone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  announcement: z.string().trim().max(200).optional(),
  shippingFee: z.coerce.number().min(0),
  freeShippingThreshold: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(50),
  reviewsRequireApproval: z.boolean(),
  newsletterEnabled: z.boolean(),
  returnWindowDays: z.coerce.number().int().min(0).max(60),
  returnPolicy: z.string().trim().max(1000).optional(),
  instagram: httpsUrl,
  facebook: httpsUrl,
  twitter: httpsUrl,
  youtube: httpsUrl,
});
