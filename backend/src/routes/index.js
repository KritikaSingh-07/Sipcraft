const router = require('express').Router();
const validate = require('../middlewares/validate');
const { protect, requireAdmin } = require('../middlewares/auth');
const { contactLimiter } = require('../middlewares/rateLimiters');
const { upload } = require('../services/uploadService');
const schemas = require('../validators/schemas');
const contact = require('../controllers/contactController');
const content = require('../controllers/contentController');
const uploads = require('../controllers/uploadController');
const { categoryRouter, cartRouter, wishlistRouter, couponRouter, reviewRouter } = require('./catalogRoutes');
const { orderRouter, paymentRouter } = require('./orderRoutes');

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/categories', categoryRouter);
router.use('/cart', cartRouter);
router.use('/wishlist', wishlistRouter);
router.use('/coupons', couponRouter);
router.use('/reviews', reviewRouter);
router.use('/orders', orderRouter);
router.use('/payments', paymentRouter);
router.use('/admin', require('./adminRoutes'));

router.post('/contact', contactLimiter, validate({ body: schemas.contactMessage }), contact.submitContact);
router.post('/newsletter', contactLimiter, validate({ body: schemas.newsletter }), contact.subscribe);

router.get('/banners', content.listActiveBanners);
router.get('/team', content.listTeam);
router.get('/settings', content.publicSettings);
router.get('/content/:key', require('../controllers/adminExtrasController').getContent);

router.post('/uploads/review/images', protect, upload.array('images', 4), uploads.reviewUpload);
router.post('/uploads/:folder', requireAdmin, upload.array('images', 8), uploads.adminUpload);
router.delete('/uploads', requireAdmin, uploads.adminDeleteUpload);

module.exports = router;
