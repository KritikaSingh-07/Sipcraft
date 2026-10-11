/* /api/admin — every route requires an authenticated admin (enforced server-side). */
const router = require('express').Router();
const validate = require('../middlewares/validate');
const { requireAdmin } = require('../middlewares/auth');
const { idParams, z } = require('../validators/common');
const schemas = require('../validators/schemas');
const analytics = require('../controllers/analyticsController');
const admin = require('../controllers/adminController');
const order = require('../controllers/orderController');
const payment = require('../controllers/paymentController');
const review = require('../controllers/reviewController');
const contact = require('../controllers/contactController');
const content = require('../controllers/contentController');
const extras = require('../controllers/adminExtrasController');
const product = require('../controllers/productController');
const coupon = require('../controllers/couponController');

const contentKey = z.object({ key: z.enum(['home', 'about', 'services']) });

router.use(requireAdmin);

router.get('/dashboard', analytics.dashboard);
router.get('/analytics', analytics.analytics);

router.get('/customers', validate({ query: schemas.adminUser.query }), admin.listCustomers);
router.get('/customers/:id', validate({ params: idParams }), admin.getCustomer);
router.patch('/customers/:id', validate({ params: idParams, body: schemas.adminUser.update }), admin.updateCustomer);

router.get('/orders', validate({ query: schemas.order.adminQuery }), order.adminListOrders);
router.get('/orders/:id', validate({ params: idParams }), order.getOrder);
router.put('/orders/:id/status', validate({ params: idParams, body: schemas.order.updateStatus }), order.adminUpdateStatus);
router.post('/orders/:id/refund', validate({ params: idParams, body: z.object({ manual: z.boolean().optional() }) }), order.adminRefund);
router.put('/orders/:id/notes', validate({ params: idParams, body: z.object({ adminNotes: z.string().max(2000) }) }), order.adminUpdateNotes);

router.get('/payments', payment.adminListPayments);

router.get('/reviews', validate({ query: schemas.review.adminQuery }), review.adminListReviews);
router.patch('/reviews/:id', validate({ params: idParams, body: schemas.review.moderate }), review.adminModerateReview);
router.delete('/reviews/:id', validate({ params: idParams }), review.deleteReview);

router.get('/messages', contact.listMessages);
router.patch('/messages/:id', validate({ params: idParams }), contact.updateMessage);
router.delete('/messages/:id', validate({ params: idParams }), contact.deleteMessage);
router.get('/subscribers', contact.listSubscribers);

router.get('/banners', content.adminListBanners);
router.post('/banners', validate({ body: schemas.banner }), content.createBanner);
router.put('/banners/:id', validate({ params: idParams, body: schemas.banner.partial() }), content.updateBanner);
router.delete('/banners/:id', validate({ params: idParams }), content.deleteBanner);

router.get('/team', content.adminListTeam);
router.post('/team', validate({ body: schemas.teamMember }), content.createTeamMember);
router.put('/team/:id', validate({ params: idParams, body: schemas.teamMember.partial() }), content.updateTeamMember);
router.delete('/team/:id', validate({ params: idParams }), content.deleteTeamMember);

router.get('/settings', content.adminGetSettings);
router.put('/settings', validate({ body: schemas.settings }), content.updateSettings);

/* Activity log, refunds, content, notifications, search */
router.get('/activity', extras.listActivity);
router.get('/refunds', extras.listRefunds);
router.post('/refunds/:id/approve', validate({ params: idParams, body: z.object({ note: z.string().trim().max(300).optional() }) }), extras.approveRefund);
router.post('/refunds/:id/reject', validate({ params: idParams, body: z.object({ reason: z.string().trim().min(5).max(300) }) }), extras.rejectRefund);
router.get('/content/:key', validate({ params: contentKey }), extras.getContent);
router.put('/content/:key', validate({ params: contentKey }), extras.updateContent);
router.delete('/content/:key', validate({ params: contentKey }), extras.resetContent);
router.post('/notifications', validate({ body: schemas.adminNotification }), extras.sendNotification);
router.get('/notifications/sent', extras.sentNotifications);
router.get('/search', extras.search);
router.post('/messages/:id/reply', validate({ params: idParams, body: z.object({ message: z.string().trim().min(2).max(5000) }) }), extras.replyToMessage);

/* REST aliases matching the documented /api/admin/* surface (same handlers as above / catalogue routes) */
router.get('/products', validate({ query: schemas.product.adminQuery }), product.adminListProducts);
router.get('/products/:id', validate({ params: idParams }), product.adminGetProduct);
router.post('/products', validate({ body: schemas.product.create }), product.createProduct);
router.put('/products/:id', validate({ params: idParams, body: schemas.product.update }), product.updateProduct);
router.delete('/products/:id', validate({ params: idParams }), product.deleteProduct);
router.get('/users', validate({ query: schemas.adminUser.query }), admin.listCustomers);
router.get('/users/:id', validate({ params: idParams }), admin.getCustomer);
router.put('/users/:id/status', validate({ params: idParams, body: schemas.adminUser.update }), admin.updateCustomer);
router.put('/reviews/:id', validate({ params: idParams, body: schemas.review.moderate }), review.adminModerateReview);
router.get('/coupons', coupon.listCoupons);
router.post('/coupons', validate({ body: schemas.coupon.create }), coupon.createCoupon);
router.put('/coupons/:id', validate({ params: idParams, body: schemas.coupon.update }), coupon.updateCoupon);
router.delete('/coupons/:id', validate({ params: idParams }), coupon.deleteCoupon);
router.get('/contact-messages', contact.listMessages);

module.exports = router;
