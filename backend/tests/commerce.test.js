const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request, setup, teardown, ORIGIN } = require('./helpers');

let app;
let rzp;
let agent;
let userToken;
let adminToken;
let aurora;
let address;

const as = (token) => ({
  get: (url) => agent.get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => agent.post(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN).send(body),
  put: (url, body) => agent.put(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN).send(body),
  patch: (url, body) => agent.patch(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN).send(body),
  del: (url) => agent.delete(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
});

const contact = { name: 'Flow Tester', email: 'flow@example.com', phone: '9876501234' };

describe('Complete purchase flow', () => {
  before(async () => {
    ({ app, rzp } = await setup());
    agent = request(app);
    const reg = await agent
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'Flow Tester', email: 'flow@example.com', phone: '9876501234', password: 'FlowTest123', confirmPassword: 'FlowTest123' });
    userToken = reg.body.data.accessToken;
    const adm = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'admin@sipcraft.test', password: 'AdminPass123' });
    adminToken = adm.body.data.accessToken;
  });
  after(teardown);

  it('browses, searches and filters products with URL-style params', async () => {
    const all = await agent.get('/api/products?limit=50');
    assert.equal(all.status, 200);
    assert.ok(all.body.data.items.length >= 12);
    const search = await agent.get('/api/products?search=aurora');
    assert.ok(search.body.data.items.some((p) => p.slug === 'aurora-stainless-steel-tumbler'));
    const filtered = await agent.get('/api/products?category=tumblers&sort=price-low&minPrice=1000&availability=in_stock');
    const prices = filtered.body.data.items.map((p) => p.price);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
    assert.ok(filtered.body.data.items.every((p) => p.price >= 1000 && p.stock > 0));
    const bySku = await agent.get('/api/products?search=SC-SIP-HYD');
    assert.equal(bySku.body.data.items[0].name, 'Hydra Travel Sipper');
    const byCategoryName = await agent.get('/api/products?search=gift%20sets');
    assert.ok(byCategoryName.body.data.items.length >= 2);
  });

  it('views a product with rating distribution and related items', async () => {
    const res = await agent.get('/api/products/aurora-stainless-steel-tumbler');
    assert.equal(res.status, 200);
    aurora = res.body.data.product;
    assert.equal(res.body.data.ratingDistribution.length, 5);
    assert.ok(Array.isArray(res.body.data.related));
    assert.equal((await agent.get('/api/products/does-not-exist')).status, 404);
  });

  it('adds to wishlist', async () => {
    const u = as(userToken);
    const res = await u.post(`/api/wishlist/${aurora._id}`);
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items[0].slug, aurora.slug);
  });

  it('adds to cart with variant validation and server-side pricing', async () => {
    const u = as(userToken);
    const noVariant = await u.post('/api/cart', { productId: aurora._id, quantity: 1 });
    assert.equal(noVariant.status, 400, 'colour/size required');
    const res = await u.post('/api/cart', { productId: aurora._id, quantity: 1, color: 'Sage', size: '1.2 L', price: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.items[0].unitPrice, aurora.price, 'client-sent price is ignored');
    const itemId = res.body.data.items[0]._id;

    const upd = await u.put(`/api/cart/${itemId}`, { quantity: 2 });
    assert.equal(upd.body.data.items[0].quantity, 2);
    assert.equal(upd.body.data.totals.subtotal, aurora.price * 2);

    const tooMany = await u.put(`/api/cart/${itemId}`, { quantity: 25 });
    assert.equal(tooMany.status, 400, 'per-line maximum enforced');
    const thermo = (await agent.get('/api/products/thermomax-travel-mug')).body.data.product;
    const capped = await u.post('/api/cart', { productId: thermo._id, quantity: 9, color: 'Cream' });
    const line = capped.body.data.items.find((i) => i.product._id === thermo._id);
    assert.equal(line.quantity, thermo.stock, 'quantity capped at available stock');
    assert.equal((await u.put(`/api/cart/${line._id}`, { quantity: thermo.stock + 1 })).status, 400, 'cannot exceed stock');
    await u.del(`/api/cart/${line._id}`);
  });

  it('merges a guest cart after login', async () => {
    const u = as(userToken);
    const products = [(await agent.get('/api/products/halo-straw-and-brush-set')).body.data.product];
    const res = await u.post('/api/cart/merge', { items: [{ productId: products[0]._id, quantity: 2 }, { productId: aurora._id, quantity: 1, color: 'Sage', size: '1.2 L' }] });
    assert.equal(res.status, 200);
    const sage = res.body.data.items.find((i) => i.product._id === aurora._id);
    assert.equal(sage.quantity, 2, 'merge keeps the larger quantity, does not double');
    assert.ok(res.body.data.items.some((i) => i.product._id === products[0]._id));
    const halo = res.body.data.items.find((i) => i.product._id === products[0]._id);
    await u.del(`/api/cart/${halo._id}`);
  });

  it('validates and applies coupons server-side', async () => {
    const u = as(userToken);
    assert.equal((await u.post('/api/coupons/validate', { code: 'NOPE' })).status, 400);
    const v = await u.post('/api/coupons/validate', { code: 'welcome10' });
    assert.equal(v.status, 200);
    const applied = await u.post('/api/cart/coupon', { code: 'WELCOME10' });
    assert.equal(applied.status, 200);
    const t = applied.body.data.totals;
    assert.equal(t.discount, Math.min(300, Math.round(t.subtotal * 0.1 * 100) / 100));
    assert.equal(t.total, t.subtotal - t.discount + t.shippingFee);
  });

  it('manages addresses (add, edit, default, delete)', async () => {
    const u = as(userToken);
    const base = { fullName: 'Flow Tester', phone: '9876501234', address: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', country: 'India' };
    const bad = await u.post('/api/users/me/addresses', { ...base, pincode: '12' });
    assert.equal(bad.status, 400);
    const a1 = await u.post('/api/users/me/addresses', base);
    assert.equal(a1.body.data.isDefault, true, 'first address becomes default');
    const a2 = await u.post('/api/users/me/addresses', { ...base, address: '7 Residency Road', label: 'Work' });
    await u.patch(`/api/users/me/addresses/${a2.body.data._id}/default`);
    const list = await u.get('/api/users/me/addresses');
    assert.equal(list.body.data[0]._id, a2.body.data._id);
    const edited = await u.put(`/api/users/me/addresses/${a2.body.data._id}`, { apartment: 'Flat 4B' });
    assert.equal(edited.body.data.apartment, 'Flat 4B');
    await u.del(`/api/users/me/addresses/${a1.body.data._id}`);
    address = a2.body.data;
  });

  it('creates a Razorpay order with a server-computed amount and reserves stock', async () => {
    const { Product } = require('../src/models');
    const before = (await Product.findById(aurora._id)).stock;
    const u = as(userToken);
    const cart = (await u.get('/api/cart')).body.data;
    const res = await u.post('/api/payments/create-order', { addressId: address._id, contact, couponCode: 'WELCOME10', total: 1 });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.amount, Math.round(cart.totals.total * 100), 'amount computed on the server, client total ignored');
    assert.equal((await u.get('/api/cart')).body.data.couponCode, 'WELCOME10', 'coupon stays on the cart during checkout');
    assert.equal((await Product.findById(aurora._id)).stock, before - 2, 'stock reserved');
    global.__checkout = res.body.data;
  });

  it('never marks an order paid with an invalid signature', async () => {
    const u = as(userToken);
    const { razorpayOrderId } = global.__checkout;
    const paid = rzp.pay(razorpayOrderId);
    const forged = await u.post('/api/payments/verify', { ...paid, razorpay_signature: crypto.randomBytes(32).toString('hex') });
    assert.equal(forged.status, 400);
    const order = (await u.get(`/api/orders/${global.__checkout.orderId}`)).body.data;
    assert.notEqual(order.paymentStatus, 'PAID');
    global.__paid = paid;
  });

  it('verifies payment, marks the order paid, clears the cart and notifies the user', async () => {
    const { Product } = require('../src/models');
    const u = as(userToken);
    const res = await u.post('/api/payments/verify', global.__paid);
    assert.equal(res.status, 200);
    const order = (await u.get(`/api/orders/${global.__checkout.orderId}`)).body.data;
    assert.equal(order.paymentStatus, 'PAID');
    assert.equal(order.orderStatus, 'PLACED');
    assert.equal(order.items[0].price, aurora.price, 'price snapshot');
    assert.equal(order.coupon.code, 'WELCOME10');
    const cart = (await u.get('/api/cart')).body.data;
    assert.equal(cart.items.length, 0, 'purchased items removed from cart');
    const p = await Product.findById(aurora._id);
    assert.equal(p.soldCount, aurora.soldCount + 2);
    const notes = (await u.get('/api/users/me/notifications')).body.data;
    assert.ok(notes.items.some((n) => n.title === 'Payment successful'));

    // Idempotent: repeating verify or a late webhook does not double-count.
    assert.equal((await u.post('/api/payments/verify', global.__paid)).status, 200);
    assert.equal((await Product.findById(aurora._id)).soldCount, aurora.soldCount + 2);

    const list = (await u.get('/api/orders')).body.data;
    assert.equal(list.items[0]._id, global.__checkout.orderId);
  });

  it('prevents another user from reading this order', async () => {
    const reg = await agent
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ name: 'Other Person', email: 'other@example.com', password: 'Other12345', confirmPassword: 'Other12345' });
    const res = await as(reg.body.data.accessToken).get(`/api/orders/${global.__checkout.orderId}`);
    assert.equal(res.status, 404);
    global.__otherToken = reg.body.data.accessToken;
  });

  it('admin moves the order through fulfilment and the user sees the timeline', async () => {
    const a = as(adminToken);
    const id = global.__checkout.orderId;
    const list = await a.get('/api/admin/orders?search=' + encodeURIComponent('flow@example.com'));
    assert.ok(list.body.data.items.some((o) => o._id === id));
    assert.equal((await a.put(`/api/admin/orders/${id}/status`, { status: 'DELIVERED' })).status, 400, 'cannot skip to delivered');
    for (const status of ['CONFIRMED', 'PROCESSING']) assert.equal((await a.put(`/api/admin/orders/${id}/status`, { status })).status, 200);
    const shipped = await a.put(`/api/admin/orders/${id}/status`, { status: 'SHIPPED', trackingNumber: 'DLV123456', carrier: 'Delhivery' });
    assert.equal(shipped.body.data.trackingNumber, 'DLV123456');

    const u = as(userToken);
    const order = (await u.get(`/api/orders/${id}`)).body.data;
    assert.equal(order.orderStatus, 'SHIPPED');
    assert.deepEqual(
      order.statusHistory.map((h) => h.status),
      ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED'],
    );
    assert.equal((await u.put(`/api/orders/${id}/cancel`, {})).status, 400, 'shipped orders cannot be cancelled by the customer');
  });

  it('only allows reviews of delivered purchases, once per order item', async () => {
    const u = as(userToken);
    const a = as(adminToken);
    const id = global.__checkout.orderId;
    const review = { orderId: id, rating: 5, title: 'Love it', comment: 'Keeps my water cold the whole day. Fantastic build quality.' };
    assert.equal((await u.post(`/api/products/${aurora._id}/reviews`, review)).status, 400, 'not delivered yet');
    const other = await as(global.__otherToken).post(`/api/products/${aurora._id}/reviews`, review);
    assert.equal(other.status, 403, 'non-purchaser blocked');

    await a.put(`/api/admin/orders/${id}/status`, { status: 'OUT_FOR_DELIVERY' });
    await a.put(`/api/admin/orders/${id}/status`, { status: 'DELIVERED' });
    const elig = await u.get(`/api/products/${aurora._id}/reviews/eligibility`);
    assert.equal(elig.body.data.eligibleOrders.length, 1);

    const ok = await u.post(`/api/products/${aurora._id}/reviews`, review);
    assert.equal(ok.status, 201);
    assert.equal((await u.post(`/api/products/${aurora._id}/reviews`, review)).status, 409, 'duplicate blocked');
    const p = (await agent.get(`/api/products/${aurora.slug}`)).body.data.product;
    assert.ok(p.reviewCount >= 1);

    const hidden = await a.patch(`/api/admin/reviews/${ok.body.data._id}`, { status: 'hidden' });
    assert.equal(hidden.status, 200);
    const list = (await agent.get(`/api/products/${aurora._id}/reviews`)).body.data.items;
    assert.ok(!list.some((r) => r._id === ok.body.data._id), 'hidden reviews are not public');
  });

  it('releases reserved stock when payment fails and the hold expires', async () => {
    const { Product, Order } = require('../src/models');
    const { releaseExpiredReservations } = require('../src/services/orderService');
    const u = as(userToken);
    const hydra = (await agent.get('/api/products/hydra-travel-sipper')).body.data.product;
    await u.post('/api/cart', { productId: hydra._id, quantity: 3, color: 'Ocean', size: '750 ml' });
    const start = (await Product.findById(hydra._id)).stock;
    const co = await u.post('/api/payments/create-order', { addressId: address._id, contact });
    assert.equal(co.status, 201);
    assert.equal((await Product.findById(hydra._id)).stock, start - 3);

    const fail = await u.post('/api/payments/failed', { razorpay_order_id: co.body.data.razorpayOrderId, reason: 'Card declined' });
    assert.equal(fail.status, 200);
    let order = await Order.findById(co.body.data.orderId);
    assert.equal(order.paymentStatus, 'FAILED');
    assert.equal((await u.post(`/api/payments/retry/${order._id}`)).status, 200, 'retry allowed within the hold');

    await Order.updateOne({ _id: order._id }, { reservationExpiresAt: new Date(Date.now() - 1000) });
    await releaseExpiredReservations();
    order = await Order.findById(order._id);
    assert.equal(order.orderStatus, 'CANCELLED');
    assert.equal((await Product.findById(hydra._id)).stock, start, 'stock restored');
    const cart = (await u.get('/api/cart')).body.data;
    assert.equal(cart.items.length, 1, 'cart kept for another attempt');
    await u.del('/api/cart');
  });

  it('handles the last-unit race: only one of two concurrent checkouts reserves it', async () => {
    const { Product } = require('../src/models');
    const solstice = (await agent.get('/api/products/solstice-coffee-tumbler')).body.data.product;
    await Product.updateOne({ _id: solstice._id }, { stock: 1 });
    const u1 = as(userToken);
    const u2 = as(global.__otherToken);
    await u1.post('/api/cart', { productId: solstice._id, quantity: 1, color: 'Latte' });
    await u2.post('/api/cart', { productId: solstice._id, quantity: 1, color: 'Latte' });
    const addr = { fullName: 'Other Person', phone: '9876501299', address: '1 Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', country: 'India' };
    const [r1, r2] = await Promise.all([
      u1.post('/api/payments/create-order', { addressId: address._id, contact }),
      u2.post('/api/payments/create-order', { address: addr, contact: { name: 'Other Person', email: 'other@example.com', phone: '9876501299' } }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    assert.deepEqual(statuses, [201, 409]);
    assert.equal((await Product.findById(solstice._id)).stock, 0);
  });

  it('confirms payment via a signed webhook and rejects unsigned webhooks', async () => {
    const { Order } = require('../src/models');
    const winner = await Order.findOne({ orderStatus: 'PENDING_PAYMENT', stockReserved: true }).populate('payment');
    const paid = rzp.pay(winner.payment.razorpayOrderId);
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: paid.razorpay_payment_id, order_id: paid.razorpay_order_id, amount: winner.payment.amount, method: 'card' } } },
    });
    const bad = await agent.post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', 'deadbeef').send(body);
    assert.equal(bad.status, 400);
    const sig = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    const ok = await agent.post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', sig).send(body);
    assert.equal(ok.status, 200);
    const updated = await Order.findById(winner._id);
    assert.equal(updated.paymentStatus, 'PAID');
    assert.equal(updated.orderStatus, 'PLACED');
  });

  it('cancelling a paid order restocks and refunds', async () => {
    const { Order, Product } = require('../src/models');
    const order = await Order.findOne({ paymentStatus: 'PAID', orderStatus: 'PLACED', 'contact.email': { $in: ['flow@example.com', 'other@example.com'] } });
    const productId = order.items[0].product;
    const before = (await Product.findById(productId)).stock;
    const token = order.contact.email === 'flow@example.com' ? userToken : global.__otherToken;
    const res = await as(token).put(`/api/orders/${order._id}/cancel`, { reason: 'Ordered by mistake' });
    assert.equal(res.status, 200);
    const after = await Order.findById(order._id);
    assert.equal(after.orderStatus, 'CANCELLED');
    assert.equal(after.paymentStatus, 'REFUNDED');
    assert.equal((await Product.findById(productId)).stock, before + order.items[0].quantity);
  });

  it('serves admin dashboard and analytics from aggregations', async () => {
    const a = as(adminToken);
    const dash = await a.get('/api/admin/dashboard');
    assert.equal(dash.status, 200);
    const s = dash.body.data.stats;
    assert.ok(s.totalRevenue > 0 && s.totalOrders > 0 && s.customers >= 5 && s.products >= 12);
    assert.equal(dash.body.data.charts.revenue.length, 30);
    const an = await a.get('/api/admin/analytics?range=12m');
    assert.equal(an.status, 200);
    assert.equal(an.body.data.series.length, 12);
    assert.ok(an.body.data.topProducts.length > 0);
    assert.ok(an.body.data.categorySales.length > 0);
    const { Order } = require('../src/models');
    const [agg] = await Order.aggregate([{ $match: { paymentStatus: 'PAID' } }, { $group: { _id: null, t: { $sum: '$total' } } }]);
    assert.equal(s.totalRevenue, Math.round(agg.t * 100) / 100, 'revenue matches the database');
  });

  it('admin product CRUD, bulk actions and validation', async () => {
    const a = as(adminToken);
    const cats = (await agent.get('/api/categories')).body.data;
    const body = {
      name: 'Test Pebble Bottle',
      sku: 'SC-TST-001',
      description: 'A test product used by the automated suite.',
      category: cats[0]._id,
      price: 500,
      mrp: 400,
      stock: 10,
    };
    assert.equal((await a.post('/api/products', body)).status, 400, 'MRP below price rejected');
    const created = await a.post('/api/products', { ...body, mrp: 700 });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.slug, 'test-pebble-bottle');
    assert.equal(created.body.data.discount, 29);
    const upd = await a.put(`/api/products/${created.body.data._id}`, { price: 650 });
    assert.equal(upd.body.data.price, 650);
    const bulk = await a.post('/api/products/bulk', { ids: [created.body.data._id], action: 'deactivate' });
    assert.equal(bulk.status, 200);
    assert.equal((await agent.get('/api/products/test-pebble-bottle')).status, 404, 'inactive hidden from store');
    assert.equal((await a.del(`/api/products/${created.body.data._id}`)).status, 200);
  });

  it('uploads images to free local storage when Cloudinary is not configured, and rejects non-images', async () => {
    // 1×1 transparent PNG
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    const res = await agent
      .post('/api/uploads/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .attach('images', png, { filename: 'pixel.png', contentType: 'image/png' });
    assert.equal(res.status, 201);
    const [img] = res.body.data;
    assert.match(img.url, /^\/uploads\/banners\/.+\.png$/);
    const served = await agent.get(img.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers['content-type'], 'image/png');

    const fake = await agent
      .post('/api/uploads/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .attach('images', Buffer.from('<script>alert(1)</script>xxxxxxxx'), { filename: 'evil.png', contentType: 'image/png' });
    assert.equal(fake.status, 400, 'magic-byte check rejects disguised files');
    assert.equal((await agent.post('/api/uploads/banners').set('Origin', ORIGIN).attach('images', png, 'p.png')).status, 401);

    await agent.delete('/api/uploads').set('Authorization', `Bearer ${adminToken}`).set('Origin', ORIGIN).send({ publicId: img.publicId });
    assert.equal((await agent.get(img.url)).status, 404, 'deleted from disk');
  });

  it('stores contact messages and shows them to admins', async () => {
    const res = await agent
      .post('/api/contact')
      .set('Origin', ORIGIN)
      .send({ name: 'Riya', email: 'riya@example.com', subject: 'Corporate order', message: 'We would like 50 custom tumblers for our team offsite.' });
    assert.equal(res.status, 201);
    const list = await as(adminToken).get('/api/admin/messages');
    assert.ok(list.body.data.items.some((m) => m.email === 'riya@example.com'));
  });
});
