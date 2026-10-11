const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { request, setup, teardown, ORIGIN } = require('./helpers');

let agent;
let adminToken;
let userToken;

const as = (token) => ({
  get: (url) => agent.get(url).set('Authorization', `Bearer ${token}`),
  post: (url, body) => agent.post(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN).send(body),
  put: (url, body) => agent.put(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN).send(body),
  del: (url) => agent.delete(url).set('Authorization', `Bearer ${token}`).set('Origin', ORIGIN),
});

describe('Admin features', () => {
  before(async () => {
    const { app } = await setup();
    agent = request(app);
    adminToken = (await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'admin@sipcraft.test', password: 'AdminPass123' })).body.data.accessToken;
    userToken = (await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email: 'ananya.iyer@example.com', password: 'Customer123' })).body.data.accessToken;
  });
  after(teardown);

  it('rejects customers on every /api/admin/* route with 403', async () => {
    const u = as(userToken);
    for (const url of ['/api/admin/products', '/api/admin/users', '/api/admin/refunds', '/api/admin/activity', '/api/admin/contact-messages', '/api/admin/coupons', '/api/admin/content/home', '/api/admin/search?q=au']) {
      assert.equal((await u.get(url)).status, 403, url);
    }
    assert.equal((await u.put('/api/admin/content/home', {})).status, 403);
    assert.equal((await u.post('/api/admin/notifications', { audience: 'all', title: 'x', message: 'y' })).status, 403);
  });

  it('records admin actions in the activity log', async () => {
    const a = as(adminToken);
    const cats = (await agent.get('/api/categories')).body.data;
    const created = await a.post('/api/admin/products', { name: 'Audit Trail Tumbler', sku: 'SC-AUD-01', description: 'Created to test the audit log.', category: cats[0]._id, price: 900, mrp: 1200, stock: 5 });
    assert.equal(created.status, 201);
    await a.put(`/api/admin/products/${created.body.data._id}`, { price: 950 });
    await a.post('/api/products/bulk', { ids: [created.body.data._id], action: 'archive' });
    const log = (await a.get('/api/admin/activity')).body.data.items;
    const actions = log.map((l) => l.action);
    assert.ok(actions.includes('product.created'));
    assert.ok(actions.includes('product.updated'));
    assert.ok(actions.includes('product.bulk_archive'));
    assert.match(log.find((l) => l.action === 'product.updated').description, /₹900→₹950/);
    assert.equal(log[0].admin.email, 'admin@sipcraft.test');

    const archived = (await a.get('/api/admin/products?status=archived')).body.data.items;
    assert.ok(archived.some((p) => p.sku === 'SC-AUD-01'));
    const defaultList = (await a.get('/api/admin/products?limit=100')).body.data.items;
    assert.ok(!defaultList.some((p) => p.sku === 'SC-AUD-01'), 'archived products hidden from the default list');
    assert.equal((await agent.get('/api/products/audit-trail-tumbler')).status, 404, 'archived products hidden from the store');
  });

  it('approves and rejects return requests', async () => {
    const { Order } = require('../src/models');
    const delivered = await Order.find({ orderStatus: 'DELIVERED', paymentStatus: 'PAID' }).limit(2);
    await Order.updateMany({ _id: { $in: delivered.map((o) => o._id) } }, { orderStatus: 'RETURN_REQUESTED', $push: { statusHistory: { status: 'RETURN_REQUESTED', note: 'Lid does not seal' } } });
    const a = as(adminToken);
    const list = (await a.get('/api/admin/refunds?status=requested')).body.data;
    assert.ok(list.items.length >= 2);
    assert.equal(list.items.find((o) => o._id === String(delivered[0]._id)).returnReason, 'Lid does not seal');

    assert.equal((await a.post(`/api/admin/refunds/${delivered[0]._id}/reject`, { reason: 'no' })).status, 400, 'reason required');
    const rejected = await a.post(`/api/admin/refunds/${delivered[0]._id}/reject`, { reason: 'Item shows signs of use' });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.orderStatus, 'DELIVERED');

    const approved = await a.post(`/api/admin/refunds/${delivered[1]._id}/approve`, {});
    assert.equal(approved.status, 200);
    const after = await Order.findById(delivered[1]._id);
    assert.equal(after.orderStatus, 'RETURNED');
    // Seeded payments have no Razorpay payment on file with the fake client, so the refund is queued for manual handling.
    assert.ok(['processed', 'pending', 'failed'].includes(after.refundStatus));
    const actions = (await a.get('/api/admin/activity')).body.data.items.map((l) => l.action);
    assert.ok(actions.includes('refund.rejected') && actions.includes('refund.approved'));
  });

  it('publishes homepage content that the storefront reads, with validation', async () => {
    const a = as(adminToken);
    const current = (await agent.get('/api/content/home')).body.data;
    assert.equal(current.hero.title, 'Hydrate in');
    const bad = await a.put('/api/admin/content/home', { ...current, hero: { ...current.hero, image: 'javascript:alert(1)' } });
    assert.equal(bad.status, 400);
    const next = { ...current, hero: { ...current.hero, title: 'Sip slower' }, sections: { ...current.sections, gallery: false } };
    assert.equal((await a.put('/api/admin/content/home', next)).status, 200);
    const pub = (await agent.get('/api/content/home')).body.data;
    assert.equal(pub.hero.title, 'Sip slower');
    assert.equal(pub.sections.gallery, false);
    await a.del('/api/admin/content/home');
    assert.equal((await agent.get('/api/content/home')).body.data.hero.title, 'Hydrate in');
  });

  it('sends customer notifications', async () => {
    const a = as(adminToken);
    const res = await a.post('/api/admin/notifications', { audience: 'user', email: 'ananya.iyer@example.com', title: 'Your engraving is ready', message: 'We have finished engraving your tumbler.', type: 'order' });
    assert.equal(res.status, 201);
    const mine = (await as(userToken).get('/api/users/me/notifications')).body.data.items;
    assert.ok(mine.some((n) => n.title === 'Your engraving is ready'));
    const all = await a.post('/api/admin/notifications', { audience: 'all', title: 'Monsoon sale', message: '20% off tumblers this weekend', link: '/products' });
    assert.ok(all.body.data.count >= 5);
  });

  it('lets shoppers report a review once and admins see reported reviews', async () => {
    const { Review } = require('../src/models');
    const review = await Review.findOne({ status: 'approved', user: { $ne: (await require('../src/models').User.findOne({ email: 'ananya.iyer@example.com' }))._id } });
    const u = as(userToken);
    assert.equal((await u.post(`/api/reviews/${review._id}/report`, { reason: 'Contains a phone number' })).status, 200);
    assert.equal((await u.post(`/api/reviews/${review._id}/report`, { reason: 'Again' })).status, 409);
    const reported = (await as(adminToken).get('/api/admin/reviews?status=reported')).body.data;
    assert.ok(reported.items.some((r) => r._id === String(review._id)));
    const pub = (await agent.get(`/api/products/${review.product}/reviews?limit=30`)).body.data.items;
    assert.ok(pub.every((r) => r.reports === undefined), 'report details are never public');
  });

  it('global admin search finds products, orders and customers', async () => {
    const res = (await as(adminToken).get('/api/admin/search?q=ananya')).body.data;
    assert.ok(res.customers.some((c) => c.email === 'ananya.iyer@example.com'));
    assert.ok(res.orders.length > 0);
    const p = (await as(adminToken).get('/api/admin/search?q=aurora')).body.data;
    assert.ok(p.products.length > 0);
  });

  it('replies to contact messages by email and supports the resolved status', async () => {
    const a = as(adminToken);
    const msg = (await a.get('/api/admin/contact-messages')).body.data.items[0];
    const reply = await a.post(`/api/admin/messages/${msg._id}/reply`, { message: 'Hi Neha, happy to help with 120 engraved tumblers.' });
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.status, 'replied');
    assert.equal((await agent.patch(`/api/admin/messages/${msg._id}`).set('Authorization', `Bearer ${adminToken}`).set('Origin', ORIGIN).send({ status: 'resolved' })).body.data.status, 'resolved');
  });

  it('extended analytics expose customer, inventory and payment statistics', async () => {
    const d = (await as(adminToken).get('/api/admin/analytics?range=12m')).body.data;
    assert.ok(d.customers.newCustomers >= 0);
    assert.ok(d.inventory.products > 0 && d.inventory.outOfStock >= 1);
    assert.ok(d.payments.find((p) => p.status === 'PAID').count > 0);
  });
});
