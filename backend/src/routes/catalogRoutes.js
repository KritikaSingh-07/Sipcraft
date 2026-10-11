/* Categories, cart, wishlist, coupons, reviews — smaller resource routers. */
const express = require('express');
const validate = require('../middlewares/validate');
const { protect, optionalAuth, requireAdmin } = require('../middlewares/auth');
const { idParams, z, objectId } = require('../validators/common');
const schemas = require('../validators/schemas');
const category = require('../controllers/categoryController');
const cart = require('../controllers/cartController');
const wishlist = require('../controllers/wishlistController');
const coupon = require('../controllers/couponController');
const review = require('../controllers/reviewController');

/* /api/categories */
const categoryRouter = express.Router();
categoryRouter.get('/', optionalAuth, category.listCategories);
categoryRouter.get('/:slug', category.getCategory);
categoryRouter.post('/', requireAdmin, validate({ body: schemas.category.create }), category.createCategory);
categoryRouter.put('/:id', requireAdmin, validate({ params: idParams, body: schemas.category.update }), category.updateCategory);
categoryRouter.delete('/:id', requireAdmin, validate({ params: idParams }), category.deleteCategory);

/* /api/cart */
const cartRouter = express.Router();
cartRouter.post('/quote', validate({ body: schemas.cart.quote }), cart.quote); // guest pricing, no auth
cartRouter.use(protect);
cartRouter.get('/', cart.getCart);
cartRouter.post('/', validate({ body: schemas.cart.add }), cart.addItem);
cartRouter.post('/merge', validate({ body: schemas.cart.merge }), cart.mergeCart);
cartRouter.post('/coupon', validate({ body: schemas.cart.coupon }), cart.applyCoupon);
cartRouter.delete('/coupon', cart.removeCoupon);
cartRouter.put('/:itemId', validate({ params: schemas.cart.itemParams, body: schemas.cart.update }), cart.updateItem);
cartRouter.delete('/:itemId', validate({ params: schemas.cart.itemParams }), cart.removeItem);
cartRouter.delete('/', cart.clearCart);

/* /api/wishlist */
const wishlistRouter = express.Router();
const productParam = z.object({ productId: objectId });
wishlistRouter.use(protect);
wishlistRouter.get('/', wishlist.getWishlist);
wishlistRouter.post('/merge', validate({ body: z.object({ productIds: z.array(objectId).max(100) }) }), wishlist.mergeWishlist);
wishlistRouter.post('/:productId', validate({ params: productParam }), wishlist.addToWishlist);
wishlistRouter.delete('/:productId', validate({ params: productParam }), wishlist.removeFromWishlist);

/* /api/coupons */
const couponRouter = express.Router();
couponRouter.get('/public', coupon.publicCoupons);
couponRouter.post('/validate', protect, validate({ body: schemas.coupon.validate }), coupon.validateCoupon);
couponRouter.get('/', requireAdmin, coupon.listCoupons);
couponRouter.post('/', requireAdmin, validate({ body: schemas.coupon.create }), coupon.createCoupon);
couponRouter.put('/:id', requireAdmin, validate({ params: idParams, body: schemas.coupon.update }), coupon.updateCoupon);
couponRouter.delete('/:id', requireAdmin, validate({ params: idParams }), coupon.deleteCoupon);

/* /api/reviews */
const reviewRouter = express.Router();
reviewRouter.get('/featured', review.featuredReviews);
reviewRouter.get('/mine', protect, review.myReviews);
reviewRouter.post('/:id/report', protect, validate({ params: idParams, body: schemas.review.report }), review.reportReview);
reviewRouter.put('/:id', protect, validate({ params: idParams, body: schemas.review.update }), review.updateReview);
reviewRouter.delete('/:id', protect, validate({ params: idParams }), review.deleteReview);

module.exports = { categoryRouter, cartRouter, wishlistRouter, couponRouter, reviewRouter };
