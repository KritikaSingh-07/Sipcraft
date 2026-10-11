/**
 * Demo activity for the admin dashboard & analytics — safe to run on a database with real data.
 *
 *   npm run seed:demo              → (re)creates demo customers, orders, payments, refunds, reviews…
 *   npm run seed:demo -- --remove  → deletes all demo data again
 *
 * Every demo record is traceable: customers use @demo.sipcraft.test emails (a reserved test
 * domain, so no real mail is ever sent), orders are numbered DM…, payments use order_demo… ids
 * and admin activity rows carry metadata.demo = true. Re-running replaces the previous demo set.
 * Coupons and page content are stored in MongoDB too (see catalog.js); coupon usedCount is
 * recalculated from the orders that used each code.
 * Real customers, orders and product stock are never modified (product ratings are recalculated
 * from approved reviews, as the app always does).
 */
const { env } = require('../src/config/env');
const { ensureCoupons, syncCouponUsage } = require('./catalog');
const { Coupon, User, Product, Order, Payment, Review, Address, Wishlist, Cart, Notification, RefreshToken, ContactMessage, NewsletterSubscriber, AdminActivity } = require('../src/models');
const { reviewTexts } = require('./data');
const { round2 } = require('../src/utils/helpers');
const { ORDER_STATUS: S, PAYMENT_STATUS: P } = require('../src/utils/constants');

const DOMAIN = 'demo.sipcraft.test';
const DEMO_EMAIL = new RegExp(`@${DOMAIN.replace(/\./g, '\\.')}$`);
const DAY = 86400000;
const HOUR = 3600000;
const NOW = Date.now();

// Deterministic pseudo-random so every run produces the same store.
let seed = 20261008;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[pairs.length - 1][0];
};

const CUSTOMERS = [
  ['Aarav Sharma', 'Bengaluru', 'Karnataka', '560038', '14, 12th Main, Indiranagar'],
  ['Diya Patel', 'Ahmedabad', 'Gujarat', '380015', '7 Satellite Road, Jodhpur Village'],
  ['Vihaan Reddy', 'Hyderabad', 'Telangana', '500034', 'Plot 22, Road No. 10, Banjara Hills'],
  ['Saanvi Iyer', 'Chennai', 'Tamil Nadu', '600017', '5 Burkit Road, T. Nagar'],
  ['Arjun Kapoor', 'New Delhi', 'Delhi', '110048', 'E-12, Greater Kailash I'],
  ['Ananya Das', 'Kolkata', 'West Bengal', '700019', '31 Ballygunge Place'],
  ['Kabir Mehta', 'Mumbai', 'Maharashtra', '400053', '9 Seven Bungalows, Andheri West'],
  ['Myra Nair', 'Kochi', 'Kerala', '682036', 'Flat 6B, Panampilly Nagar'],
  ['Reyansh Gupta', 'Lucknow', 'Uttar Pradesh', '226010', '42 Gomti Nagar Extension'],
  ['Ira Joshi', 'Pune', 'Maharashtra', '411004', '18 Prabhat Road, Erandwane'],
  ['Advik Singh', 'Jaipur', 'Rajasthan', '302001', '3 C-Scheme, Ashok Marg'],
  ['Kiara Menon', 'Bengaluru', 'Karnataka', '560102', '221 HSR Layout, Sector 2'],
  ['Ishaan Verma', 'Gurugram', 'Haryana', '122002', 'Tower 4, DLF Phase 3'],
  ['Aadhya Rao', 'Mysuru', 'Karnataka', '570009', '67 Vijayanagar 2nd Stage'],
  ['Vivaan Malhotra', 'Chandigarh', 'Chandigarh', '160017', 'House 1102, Sector 17'],
  ['Anika Bose', 'Kolkata', 'West Bengal', '700091', 'BG-14, Salt Lake Sector II'],
  ['Rohan Pillai', 'Thiruvananthapuram', 'Kerala', '695010', '12 Kowdiar Gardens'],
  ['Navya Kulkarni', 'Pune', 'Maharashtra', '411057', 'B-503, Hinjewadi Phase 1'],
  ['Dhruv Agarwal', 'Indore', 'Madhya Pradesh', '452010', '88 Vijay Nagar Scheme 54'],
  ['Prisha Shetty', 'Mangaluru', 'Karnataka', '575003', '4 Kadri Hills Road'],
  ['Krishna Chawla', 'Noida', 'Uttar Pradesh', '201301', 'C-701, Sector 50'],
  ['Meera Krishnan', 'Coimbatore', 'Tamil Nadu', '641018', '10 Race Course Road'],
  ['Aryan Bhatt', 'Ahmedabad', 'Gujarat', '380054', '16 Bodakdev, SG Highway'],
  ['Tara Fernandes', 'Panaji', 'Goa', '403001', '2 Fontainhas, Rua de Natal'],
  ['Neel Saxena', 'Bhopal', 'Madhya Pradesh', '462016', '55 Arera Colony'],
  ['Zara Khan', 'Hyderabad', 'Telangana', '500081', '1201 Hitech City Towers, Madhapur'],
];

const FLOW = [S.PLACED, S.CONFIRMED, S.PROCESSING, S.SHIPPED, S.OUT_FOR_DELIVERY, S.DELIVERED];
let COUPONS = []; // loaded from the database in seedDemo()

async function removeDemo({ quiet = false } = {}) {
  const users = await User.find({ email: DEMO_EMAIL }).select('_id').lean();
  const ids = users.map((u) => u._id);
  const byUser = { user: { $in: ids } };
  const out = {
    orders: (await Order.deleteMany({ $or: [byUser, { orderNumber: /^DM/ }] })).deletedCount,
    payments: (await Payment.deleteMany({ $or: [byUser, { razorpayOrderId: /^order_demo/ }] })).deletedCount,
    reviews: (await Review.deleteMany(byUser)).deletedCount,
  };
  await Promise.all([Address.deleteMany(byUser), Wishlist.deleteMany(byUser), Cart.deleteMany(byUser), Notification.deleteMany(byUser), RefreshToken.deleteMany(byUser)]);
  await ContactMessage.deleteMany({ email: DEMO_EMAIL });
  await NewsletterSubscriber.deleteMany({ email: DEMO_EMAIL });
  await AdminActivity.deleteMany({ 'metadata.demo': true });
  out.customers = (await User.deleteMany({ _id: { $in: ids } })).deletedCount;
  await syncCouponUsage();
  if (!quiet) console.log('✔ Demo data removed', out);
  return out;
}

function buildItems(products) {
  const lines = weighted([[1, 55], [2, 32], [3, 13]]);
  const chosen = new Map();
  while (chosen.size < lines) {
    // Best sellers sell more often.
    const p = rand() < 0.55 ? pick(products.filter((x) => x.isBestSeller)) : pick(products);
    if (chosen.has(String(p._id))) continue;
    const qty = weighted([[1, 80], [2, 17], [3, 3]]);
    chosen.set(String(p._id), {
      product: p._id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      image: p.images?.[0]?.url,
      category: p.category,
      price: p.price,
      mrp: p.mrp,
      quantity: qty,
      color: p.colors?.length ? pick(p.colors).name : '',
      size: p.sizes?.length ? pick(p.sizes) : '',
      lineTotal: round2(p.price * qty),
    });
  }
  return [...chosen.values()];
}

/** Picks a realistic status for an order of the given age. */
function statusFor(ageDays) {
  if (ageDays < 0.5) return weighted([['PENDING_PAYMENT', 12], [S.PLACED, 55], [S.CONFIRMED, 33]]);
  if (ageDays < 2) return weighted([[S.CONFIRMED, 30], [S.PROCESSING, 50], ['CANCELLED_REFUND_PENDING', 8], ['FAILED', 12]]);
  if (ageDays < 5) return weighted([[S.PROCESSING, 20], [S.SHIPPED, 50], [S.OUT_FOR_DELIVERY, 30]]);
  if (ageDays < 10) return weighted([[S.SHIPPED, 15], [S.OUT_FOR_DELIVERY, 10], [S.DELIVERED, 60], [S.RETURN_REQUESTED, 15]]);
  if (ageDays < 30) return weighted([[S.DELIVERED, 78], [S.RETURN_REQUESTED, 6], [S.RETURNED, 5], ['CANCELLED', 6], ['FAILED', 3], ['CANCELLED_REFUND_FAILED', 2]]);
  return weighted([[S.DELIVERED, 84], [S.RETURNED, 5], ['CANCELLED', 7], ['FAILED', 4]]);
}

async function seedDemo({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  await removeDemo({ quiet: true });
  await ensureCoupons();
  COUPONS = await Coupon.find({ isActive: true }).lean();

  const products = await Product.find({ isActive: true, isArchived: { $ne: true }, stock: { $gte: 0 } }).lean();
  if (!products.length) throw new Error('No products found — run `npm run seed:catalog` first.');
  const admin = (env.seed.adminEmail && (await User.findOne({ email: env.seed.adminEmail.toLowerCase(), role: 'admin' }))) || (await User.findOne({ role: 'admin' }));

  /* Customers — sign-ups spread across the last 12 months for the growth chart. */
  const password = env.seed.userPassword || `Demo${Math.random().toString(36).slice(2, 10)}A1`;
  const customers = [];
  for (let i = 0; i < CUSTOMERS.length; i++) {
    const [name, city, state, pincode, address] = CUSTOMERS[i];
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@${DOMAIN}`;
    const phone = `9${String(800000000 + i * 7919123).slice(0, 9)}`;
    const createdAt = new Date(NOW - Math.round((360 - i * 13.5 + between(-5, 5)) * DAY));
    const user = await User.create({ name, email, phone, password, role: 'user' });
    await User.collection.updateOne({ _id: user._id }, { $set: { createdAt, updatedAt: createdAt, lastLoginAt: new Date(NOW - between(0, 20) * DAY) } });
    await Address.create({ user: user._id, label: 'Home', fullName: name, phone, email, address, city, state, pincode, country: 'India', isDefault: true });
    customers.push({ user, info: { name, email, phone, city, state, pincode, address }, createdAt });
  }

  /* Orders + payments — growing month over month, with live orders in the last few days. */
  const orders = [];
  const payments = [];
  let seq = 0;
  const months = 12;
  for (let m = months - 1; m >= 0; m--) {
    const count = Math.round(7 + (months - 1 - m) * 2.4 + between(-2, 2));
    for (let k = 0; k < count; k++) {
      const createdAt = new Date(NOW - (m * 30 + between(0, 30)) * DAY);
      if (createdAt.getTime() > NOW) continue;
      const eligible = customers.filter((c) => c.createdAt < createdAt);
      if (!eligible.length) continue;
      // A loyal core of customers orders repeatedly.
      const cust = rand() < 0.45 ? pick(eligible.slice(0, Math.max(3, Math.ceil(eligible.length / 3)))) : pick(eligible);
      orders.push(buildOrder(cust, createdAt, ++seq, products, payments, admin));
    }
  }
  // Guarantee a lively "today" — fresh orders in every early stage.
  for (const [hoursAgo, forced] of [[0.4, 'PENDING_PAYMENT'], [1.2, S.PLACED], [2.5, S.PLACED], [5, S.CONFIRMED], [20, S.PROCESSING], [30, S.PROCESSING], [52, S.SHIPPED], [70, S.OUT_FOR_DELIVERY], [100, S.RETURN_REQUESTED], [26, 'FAILED']]) {
    const cust = pick(customers);
    orders.push(buildOrder(cust, new Date(NOW - hoursAgo * HOUR), ++seq, products, payments, admin, forced));
  }

  const orderDocs = orders.map((o) => new Order(o));
  const paymentDocs = payments.map((p) => new Payment(p));
  for (const d of [...orderDocs, ...paymentDocs]) {
    await d.validate();
  }
  // Raw inserts keep the historical createdAt/updatedAt values intact.
  await Order.collection.insertMany(orderDocs.map((d, i) => ({ ...d.toObject({ depopulate: true }), createdAt: orders[i].createdAt, updatedAt: orders[i].updatedAt })));
  await Payment.collection.insertMany(paymentDocs.map((d, i) => ({ ...d.toObject({ depopulate: true }), createdAt: payments[i].createdAt, updatedAt: payments[i].updatedAt })));

  /* Reviews on delivered/returned orders — mostly approved, some awaiting moderation. */
  let reviewCount = 0;
  const reviewDocs = [];
  for (const o of orders.filter((x) => [S.DELIVERED, S.RETURNED, S.RETURN_REQUESTED].includes(x.orderStatus) && x.deliveredAt)) {
    for (const item of o.items) {
      if (rand() > 0.55) continue;
      const t = reviewTexts[reviewCount % reviewTexts.length];
      const at = new Date(Math.min(NOW - HOUR, o.deliveredAt.getTime() + between(1, 6) * DAY));
      const status = weighted([['approved', 84], ['pending', 12], ['hidden', 4]]);
      reviewDocs.push({ user: o.user, product: item.product, order: o._id, rating: o.orderStatus === S.RETURNED ? Math.min(t.rating, 3) : t.rating, title: t.title, comment: t.comment, status, createdAt: at, updatedAt: at });
      item.reviewed = true;
      reviewCount++;
    }
  }
  if (reviewDocs.length) {
    for (const r of reviewDocs) await new Review(r).validate();
    await Review.collection.insertMany(reviewDocs);
    for (const o of orders.filter((x) => x.items.some((i) => i.reviewed))) {
      await Order.collection.updateOne({ _id: o._id }, { $set: { items: o.items } });
    }
  }
  const { recalcProductRating } = require('../src/controllers/reviewController');
  for (const p of products) await recalcProductRating(p._id);

  /* Notifications, wishlists, inbox, newsletter, admin activity. */
  const notifications = orders
    .filter((o) => NOW - o.createdAt.getTime() < 10 * DAY)
    .map((o) => ({
      user: o.user,
      type: 'order',
      title: `${o.orderStatus.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} · ${o.orderNumber}`,
      message: `Your order ${o.orderNumber} is now ${o.orderStatus.replace(/_/g, ' ').toLowerCase()}.`,
      link: `/orders/${o._id}`,
      isRead: rand() > 0.5,
      createdAt: o.updatedAt,
      updatedAt: o.updatedAt,
    }));
  if (notifications.length) await Notification.collection.insertMany(notifications);

  for (const c of customers.slice(0, 14)) {
    const ids = [...new Set(Array.from({ length: 1 + Math.floor(rand() * 4) }, () => String(pick(products)._id)))];
    await Wishlist.create({ user: c.user._id, products: ids });
  }

  const messages = [
    ['Bulk order for 200 tumblers', 'Hi! We are planning Diwali gifts for our team in Pune and want 200 Aurora tumblers with our logo. Can you share pricing and lead time?', 'new'],
    ['Lid not sealing properly', 'My Hydra sipper lid started leaking after two weeks. Is this covered by the warranty? Order DM-series, delivered last month.', 'new'],
    ['Do you ship to Sri Lanka?', 'Love your bottles! Do you offer international shipping to Colombo?', 'read'],
    ['Collaboration request', 'I run a fitness community of 40k on Instagram and would love to collaborate on a limited Pulse colourway.', 'replied'],
    ['Wrong colour delivered', 'I ordered Sage but received Midnight. Could you arrange an exchange please?', 'resolved'],
    ['Engraving options', 'Can you engrave names on the Petal Kids Sipper? Looking for 3 pieces for my kids.', 'archived'],
  ];
  for (let i = 0; i < messages.length; i++) {
    const c = customers[(i * 5) % customers.length];
    const at = new Date(NOW - (i * 2.5 + between(0, 1)) * DAY);
    const doc = await ContactMessage.create({ name: c.info.name, email: c.info.email, phone: c.info.phone, subject: messages[i][0], message: messages[i][1], status: messages[i][2] });
    await ContactMessage.collection.updateOne({ _id: doc._id }, { $set: { createdAt: at, updatedAt: at } });
  }

  const subscribers = Array.from({ length: 48 }, (_, i) => {
    const at = new Date(NOW - between(0, 360) * DAY);
    return { email: `subscriber${i + 1}@${DOMAIN}`, isActive: rand() > 0.08, createdAt: at, updatedAt: at };
  });
  await NewsletterSubscriber.collection.insertMany(subscribers);

  if (admin) {
    const recent = orders.filter((o) => NOW - o.createdAt.getTime() < 20 * DAY).slice(-12);
    const acts = recent.map((o, i) => ({
      admin: admin._id,
      action: o.orderStatus === S.RETURNED ? 'refund.approved' : 'order.status',
      entity: 'order',
      entityId: String(o._id),
      description: o.orderStatus === S.RETURNED ? `Return approved and refund issued for ${o.orderNumber} (₹${o.total})` : `Updated ${o.orderNumber} to ${o.orderStatus.replace(/_/g, ' ').toLowerCase()}`,
      metadata: { demo: true, status: o.orderStatus },
      createdAt: new Date(o.updatedAt.getTime() - i * 60000),
    }));
    acts.push(
      { admin: admin._id, action: 'product.update', entity: 'product', entityId: String(products[0]._id), description: `Updated stock for ${products[0].name}`, metadata: { demo: true }, createdAt: new Date(NOW - 3 * DAY) },
      { admin: admin._id, action: 'coupon.create', entity: 'coupon', description: 'Created coupon HYDRATE200', metadata: { demo: true }, createdAt: new Date(NOW - 9 * DAY) },
      { admin: admin._id, action: 'content.update', entity: 'content', description: 'Updated home page hero text', metadata: { demo: true }, createdAt: new Date(NOW - 12 * DAY) },
    );
    await AdminActivity.collection.insertMany(acts);
  }

  await syncCouponUsage();

  const by = (k) => orders.reduce((m, o) => ((m[o[k]] = (m[o[k]] || 0) + 1), m), {});
  const revenue = orders.filter((o) => o.paymentStatus === P.PAID).reduce((s, o) => s + o.total, 0);
  log('\n✔ Demo data created');
  log(`  Customers: ${customers.length} · Orders: ${orders.length} · Payments: ${payments.length} · Reviews: ${reviewCount} · Messages: ${messages.length} · Subscribers: ${subscribers.length}`);
  log(`  Order status:   ${JSON.stringify(by('orderStatus'))}`);
  log(`  Payment status: ${JSON.stringify(by('paymentStatus'))}`);
  log(`  Refunds:        ${JSON.stringify(by('refundStatus'))}`);
  log(`  Paid revenue:   ₹${Math.round(revenue).toLocaleString('en-IN')}`);
  log(`  Remove with:    npm run seed:demo -- --remove`);
}

function buildOrder(cust, createdAt, n, products, payments, admin, forced) {
  const ageDays = (NOW - createdAt.getTime()) / DAY;
  const kind = forced || statusFor(ageDays);
  const items = buildItems(products);
  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  // Apply a stored coupon the same way checkout does: minimum order + maximum discount.
  const eligible = COUPONS.filter((c) => subtotal >= (c.minimumOrderAmount || 0));
  const c = eligible.length && rand() < 0.3 ? pick(eligible) : null;
  let discount = 0;
  if (c) {
    discount = c.discountType === 'percentage' ? round2((subtotal * c.discountValue) / 100) : c.discountValue;
    if (c.maximumDiscount) discount = Math.min(discount, c.maximumDiscount);
  }
  const coupon = c ? { code: c.code, discountType: c.discountType, discountValue: c.discountValue, couponId: c._id } : null;
  const after = subtotal - discount;
  const shippingFee = after >= env.store.freeShippingThreshold ? 0 : env.store.shippingFee;
  const tax = round2((after * env.store.taxRate) / (100 + env.store.taxRate));
  const total = round2(after + shippingFee);

  const t = (h) => new Date(Math.min(NOW - 60000, createdAt.getTime() + h * HOUR));
  const paid = !['PENDING_PAYMENT', 'FAILED'].includes(kind);
  const history = [];
  let orderStatus;
  let paymentStatus = paid ? P.PAID : kind === 'FAILED' ? P.FAILED : P.CREATED;
  let refundStatus = 'none';
  let refundAmount;
  let refundedAt;
  let cancelledAt;
  let cancelReason;
  let deliveredAt;

  if (kind === 'PENDING_PAYMENT') {
    orderStatus = S.PENDING_PAYMENT;
    history.push({ status: S.PENDING_PAYMENT, note: 'Awaiting payment', at: createdAt });
  } else if (kind === 'FAILED') {
    orderStatus = S.CANCELLED;
    cancelledAt = t(0.5);
    cancelReason = 'Payment failed';
    history.push({ status: S.PENDING_PAYMENT, at: createdAt }, { status: S.CANCELLED, note: 'Payment not completed in time', at: cancelledAt });
  } else if (kind.startsWith('CANCELLED')) {
    orderStatus = S.CANCELLED;
    history.push({ status: S.PLACED, note: 'Payment received', at: createdAt });
    if (rand() < 0.5) history.push({ status: S.CONFIRMED, at: t(3) });
    cancelledAt = t(6);
    cancelReason = pick(['Ordered the wrong colour', 'Found a better option', 'Delivery date too late', 'Cancelled by customer']);
    history.push({ status: S.CANCELLED, note: cancelReason, at: cancelledAt, by: undefined });
    if (kind === 'CANCELLED') {
      paymentStatus = P.REFUNDED;
      refundStatus = 'processed';
      refundAmount = total;
      refundedAt = t(30);
    } else {
      refundStatus = kind === 'CANCELLED_REFUND_FAILED' ? 'failed' : 'pending';
    }
  } else {
    const target = [S.RETURN_REQUESTED, S.RETURNED].includes(kind) ? S.DELIVERED : kind;
    const steps = FLOW.slice(0, FLOW.indexOf(target) + 1);
    const gaps = [0, 2, 10, 26, 60, 72];
    steps.forEach((s, i) => history.push({ status: s, note: i === 0 ? 'Payment received' : undefined, at: t(gaps[i] + between(0, 4)), by: i > 0 && admin ? admin._id : undefined }));
    orderStatus = target;
    if (target === S.DELIVERED) deliveredAt = history[history.length - 1].at;
    if (kind === S.RETURN_REQUESTED) {
      orderStatus = S.RETURN_REQUESTED;
      refundStatus = 'pending';
      history.push({ status: S.RETURN_REQUESTED, note: pick(['Lid leaks when tilted', 'Colour different from photos', 'Received a dented bottle']), at: t(80 + between(0, 30)) });
    }
    if (kind === S.RETURNED) {
      orderStatus = S.RETURNED;
      paymentStatus = P.REFUNDED;
      refundStatus = 'processed';
      refundAmount = total;
      history.push({ status: S.RETURN_REQUESTED, note: 'Product damaged in transit', at: t(96) }, { status: S.RETURNED, note: 'Return approved, refund issued', at: t(140), by: admin?._id });
      refundedAt = t(140);
    }
  }

  const _id = new Order.base.Types.ObjectId();
  const paymentId = new Order.base.Types.ObjectId();
  const orderNumber = `DM${createdAt.toISOString().slice(2, 10).replace(/-/g, '')}${String(n).padStart(4, '0')}`;
  const last = history[history.length - 1].at;
  const shipped = history.some((h) => h.status === S.SHIPPED);

  payments.push({
    _id: paymentId,
    order: _id,
    user: cust.user._id,
    provider: 'razorpay',
    razorpayOrderId: `order_demo${String(n).padStart(8, '0')}`,
    razorpayPaymentId: paid ? `pay_demo${String(n).padStart(8, '0')}` : undefined,
    amount: Math.round(total * 100),
    currency: 'INR',
    status: paymentStatus === P.REFUNDED ? P.REFUNDED : paid ? P.PAID : paymentStatus,
    method: weighted([['upi', 55], ['card', 28], ['netbanking', 10], ['wallet', 7]]),
    failureReason: kind === 'FAILED' ? pick(['Payment declined by bank', 'UPI request expired', 'Insufficient funds']) : undefined,
    verifiedVia: paid ? pick(['signature', 'webhook']) : null,
    refundId: paymentStatus === P.REFUNDED ? `rfnd_demo${String(n).padStart(8, '0')}` : undefined,
    refundedAt,
    events: [{ event: 'created', at: createdAt }, ...(paid ? [{ event: 'captured', at: new Date(createdAt.getTime() + 60000) }] : []), ...(kind === 'FAILED' ? [{ event: 'failed', at: t(0.5) }] : []), ...(refundedAt ? [{ event: 'refunded', at: refundedAt }] : [])],
    createdAt,
    updatedAt: refundedAt || createdAt,
  });

  return {
    _id,
    orderNumber,
    user: cust.user._id,
    items,
    shippingAddress: { fullName: cust.info.name, phone: cust.info.phone, email: cust.info.email, address: cust.info.address, city: cust.info.city, state: cust.info.state, pincode: cust.info.pincode, country: 'India' },
    contact: { name: cust.info.name, email: cust.info.email, phone: cust.info.phone },
    subtotal,
    discount,
    shippingFee,
    tax,
    total,
    coupon: coupon || undefined,
    payment: paymentId,
    paymentMethod: 'razorpay',
    paymentStatus,
    orderStatus,
    statusHistory: history,
    stockReserved: false, // demo orders never hold inventory
    paidAt: paid ? new Date(createdAt.getTime() + 60000) : undefined,
    deliveredAt,
    cancelledAt,
    cancelReason,
    refundStatus,
    refundAmount,
    refundedAt,
    trackingNumber: shipped ? `DLV${String(78100000 + n * 7919)}` : undefined,
    carrier: shipped ? pick(['Delhivery', 'Blue Dart', 'Ekart', 'XpressBees']) : undefined,
    createdAt,
    updatedAt: refundedAt || last,
  };
}

if (require.main === module) {
  (async () => {
    if (env.isProd && !process.argv.includes('--force')) {
      console.error('Refusing to add demo data to a production database. Re-run with --force if you are absolutely sure.');
      process.exit(1);
    }
    const { connectDB, disconnectDB } = require('../src/config/db');
    try {
      await connectDB();
      if (process.argv.includes('--remove')) {
        await removeDemo();
        const products = await Product.find().select('_id').lean();
        const { recalcProductRating } = require('../src/controllers/reviewController');
        for (const p of products) await recalcProductRating(p._id);
      } else {
        await seedDemo();
      }
    } catch (err) {
      console.error('Demo seed failed:', err);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}

module.exports = { seedDemo, removeDemo };
