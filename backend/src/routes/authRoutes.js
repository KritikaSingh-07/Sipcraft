const router = require('express').Router();
const c = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { requireCsrfHeader } = require('../middlewares/csrf');
const rl = require('../middlewares/rateLimiters');
const { auth } = require('../validators/schemas');

router.post('/register', rl.registerLimiter, validate({ body: auth.register }), c.register);
router.post('/login', rl.loginLimiter, validate({ body: auth.login }), c.login);
// Cookie-authenticated endpoints require the custom CSRF header.
router.post('/refresh', rl.refreshLimiter, requireCsrfHeader, c.refresh);
router.post('/logout', requireCsrfHeader, c.logout);
router.post('/logout-all', protect, requireCsrfHeader, c.logoutAll);
router.get('/me', protect, c.me);
router.get('/sessions', protect, c.sessions);
router.post('/forgot-password', rl.forgotPasswordLimiter, validate({ body: auth.forgotPassword }), c.forgotPassword);
router.post('/reset-password', rl.resetPasswordLimiter, validate({ body: auth.resetPassword }), c.resetPassword);
router.post('/change-password', protect, rl.resetPasswordLimiter, validate({ body: auth.changePassword }), c.changePassword);

module.exports = router;
