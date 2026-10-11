const { z } = require('zod');
const mongoose = require('mongoose');

const objectId = z.string().trim().refine((v) => mongoose.isValidObjectId(v), { message: 'Invalid id' });
const idParams = z.object({ id: objectId });

const trimmed = (max) => z.string().trim().max(max);
const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined));

const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Enter a valid email address' }));
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{10,15}$/, 'Enter a valid phone number');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const booleanish = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
const numberish = z.coerce.number();

const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

// Cloudinary (https://) or a site-relative path for bundled seed media (/media/...). Protocol-relative "//" is rejected.
const imageRef = z.object({
  url: z
    .string()
    .trim()
    .max(1000)
    .regex(/^(https:\/\/|\/(?!\/))/, 'Image URL must be https:// or a site path'),
  publicId: z.string().trim().max(300).nullish(),
  alt: z.string().trim().max(160).optional(),
});

module.exports = { z, objectId, idParams, trimmed, optionalText, email, phone, password, booleanish, numberish, pageQuery, imageRef };
