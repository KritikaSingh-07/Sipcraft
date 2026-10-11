const router = require('express').Router();
const c = require('../controllers/productController');
const r = require('../controllers/reviewController');
const validate = require('../middlewares/validate');
const { protect, requireAdmin } = require('../middlewares/auth');
const { upload } = require('../services/uploadService');
const { idParams, z, objectId } = require('../validators/common');
const { product, review } = require('../validators/schemas');

/* Public catalogue */
router.get('/', validate({ query: product.query }), c.listProducts);
router.get('/suggestions', c.suggestions);

/* Admin catalogue management (declared before /:slug so "admin" isn't treated as a slug) */
router.get('/admin/list', requireAdmin, validate({ query: product.adminQuery }), c.adminListProducts);
router.get('/admin/:id', requireAdmin, validate({ params: idParams }), c.adminGetProduct);
router.post('/', requireAdmin, validate({ body: product.create }), c.createProduct);
router.post('/bulk', requireAdmin, validate({ body: product.bulk }), c.bulkAction);
router.put('/:id', requireAdmin, validate({ params: idParams, body: product.update }), c.updateProduct);
router.delete('/:id', requireAdmin, validate({ params: idParams }), c.deleteProduct);
router.post('/:id/images', requireAdmin, validate({ params: idParams }), upload.array('images', 8), c.uploadProductImages);
router.put('/:id/images/reorder', requireAdmin, validate({ params: idParams, body: product.reorderImages }), c.reorderProductImages);
router.delete(
  '/:id/images/:imageId',
  requireAdmin,
  validate({ params: z.object({ id: objectId, imageId: objectId }) }),
  c.deleteProductImage,
);

/* Reviews nested under products */
router.get('/:productId/reviews', validate({ params: review.productParams, query: review.query }), r.listProductReviews);
router.get('/:productId/reviews/eligibility', protect, validate({ params: review.productParams }), r.reviewEligibility);
router.post('/:productId/reviews', protect, validate({ params: review.productParams, body: review.create }), r.createReview);

router.get('/:slug', validate({ params: z.object({ slug: z.string().trim().min(1).max(160) }) }), c.getProduct);

module.exports = router;
