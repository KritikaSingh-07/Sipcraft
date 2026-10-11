const express = require('express');
const validate = require('../middlewares/validate');
const { protect } = require('../middlewares/auth');
const { paymentLimiter } = require('../middlewares/rateLimiters');
const { idParams, z, objectId } = require('../validators/common');
const schemas = require('../validators/schemas');
const order = require('../controllers/orderController');
const payment = require('../controllers/paymentController');

/* /api/orders */
const orderRouter = express.Router();
orderRouter.use(protect);
// Creating an order starts a payment: identical to POST /api/payments/create-order.
orderRouter.post('/', paymentLimiter, validate({ body: schemas.payment.createOrder }), payment.createPaymentOrder);
orderRouter.get('/', validate({ query: schemas.order.userQuery }), order.myOrders);
orderRouter.get('/:id', validate({ params: idParams }), order.getOrder);
orderRouter.put('/:id/cancel', validate({ params: idParams, body: schemas.order.cancel }), order.cancelMyOrder);
orderRouter.post('/:id/return', validate({ params: idParams, body: schemas.order.return }), order.requestReturn);

/* /api/payments (the webhook is mounted separately in app.js with a raw body parser) */
const paymentRouter = express.Router();
paymentRouter.get('/config', payment.config);
paymentRouter.post('/create-order', protect, paymentLimiter, validate({ body: schemas.payment.createOrder }), payment.createPaymentOrder);
paymentRouter.post('/verify', protect, paymentLimiter, validate({ body: schemas.payment.verify }), payment.verifyPayment);
paymentRouter.post('/failed', protect, validate({ body: schemas.payment.failed }), payment.reportFailure);
paymentRouter.post('/retry/:orderId', protect, paymentLimiter, validate({ params: z.object({ orderId: objectId }) }), payment.retryPayment);

module.exports = { orderRouter, paymentRouter };
