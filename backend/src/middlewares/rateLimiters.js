const { rateLimit } = require('express-rate-limit');
const { env } = require('../config/env');

const handler = (req, res, next, options) =>
  res.status(options.statusCode).json({ success: false, code: 'RATE_LIMITED', message: options.message });

const make = (windowMs, limit, message, extra = {}) =>
  rateLimit({
    windowMs,
    // Development gets 10x headroom (hot reloads, local testing); tests are effectively unlimited.
    limit: env.isTest ? 10_000 : env.isProd ? limit : limit * 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message,
    handler,
    ...extra,
  });

// Generous: a single page view makes ~10 API calls, and many shoppers can share one IP (mobile carrier NAT).
const apiLimiter = make(15 * 60 * 1000, 1500, 'Too many requests. Please slow down and try again shortly.');

const loginLimiter = make(15 * 60 * 1000, 10, 'Too many login attempts. Please try again in 15 minutes.', {
  skipSuccessfulRequests: true,
});
const registerLimiter = make(60 * 60 * 1000, 10, 'Too many accounts created from this network. Please try again later.');
const forgotPasswordLimiter = make(60 * 60 * 1000, 5, 'Too many password reset requests. Please try again later.');
const resetPasswordLimiter = make(15 * 60 * 1000, 10, 'Too many password reset attempts. Please try again later.');
const refreshLimiter = make(15 * 60 * 1000, 120, 'Too many session refresh requests. Please try again later.');
const contactLimiter = make(60 * 60 * 1000, 8, 'Too many messages sent. Please try again later.');
const paymentLimiter = make(15 * 60 * 1000, 40, 'Too many payment attempts. Please try again later.');

module.exports = {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  refreshLimiter,
  contactLimiter,
  paymentLimiter,
};
