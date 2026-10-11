/**
 * Database seed.
 *
 *   npm run seed            → wipes the store collections and inserts sample data
 *   npm run seed:destroy    → wipes the store collections only
 *
 * Admin credentials come from ADMIN_EMAIL / ADMIN_PASSWORD. Sample customers use
 * SEED_USER_PASSWORD. If a password is not provided, a strong random one is generated and
 * printed once. Refuses to run against NODE_ENV=production unless --force is passed.
 */
const crypto = require('crypto');
const { env } = require('../src/config/env');
const models = require('../src/models');
const { categories, products, customers, reviewTexts, coupons, banners, team, STD_SHIPPING, STD_RETURNS } = require('./data');
const { toSlug, round2 } = require('../src/utils/helpers');
const { ORDER_STATUS, PAYMENT_STATUS } = require('../src/utils/constants');

const { User, Category, Product, Order, Payment, Review, Coupon, Banner, TeamMember, Address, Setting, Notification, Cart, Wishlist, RefreshToken, ContactMessage, NewsletterSubscriber, AdminActivity, SiteContent } = models;

const DAY = 86400000;
const generatePassword = () => `${crypto.randomBytes(9).toString('base64url')}Aa1`;

/** Number of bundled renders per product (mirrors tools/product-renders). */
function imageCount(p) {
  if (p.render.shape === 'gift-box') return p.colors.length + 1;
  if (p.render.shape === 'straw-set') return 2;
  return Math.max(p.colors.length, 1) + 1;
}

// Deterministic pseudo-random so every seed produces the same store.
let rngState = 42;
const rand = () => {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function wipe() {
  await Promise.all(
    [User, Category, Product, Order, Payment, Review, Coupon, Banner, TeamMember, Address, Setting, Notification, Cart, Wishlist, RefreshToken, ContactMessage, NewsletterSubscriber, AdminActivity, SiteContent].map(
      (m) => m.deleteMany({}),
    ),
  );
}

async function seed({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  await wipe();

  await Setting.create({ key: 'store' });

  /* Users */
  const adminEmail = env.seed.adminEmail || 'admin@sipcraft.local';
  const adminPassword = env.seed.adminPassword || generatePassword();
  const userPassword = env.seed.userPassword || generatePassword();
  const admin = await User.create({ name: env.seed.adminName, email: adminEmail, password: adminPassword, role: 'admin', phone: '9000000001' });

  const users = [];
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    const u = await User.create({ name: c.name, email: c.email, phone: c.phone, password: userPassword, role: 'user' });
    // Spread sign-ups across the last six months for the customer-growth chart.
    const created = new Date(Date.now() - (170 - i * 30) * DAY);
    await User.collection.updateOne({ _id: u._id }, { $set: { createdAt: created } });
    await Address.create({
      user: u._id,
      label: 'Home',
      fullName: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      country: 'India',
      isDefault: true,
    });
    users.push({ doc: u, info: c, created });
  }

  /* Categories */
  const catDocs = {};
  for (const c of categories) {
    catDocs[c.slug] = await Category.create({
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
      image: { url: `/media/categories/${c.slug}.webp`, publicId: null },
    });
  }

  /* Products */
  const productDocs = [];
  for (const p of products) {
    const slug = toSlug(p.name);
    const count = imageCount(p);
    const images = Array.from({ length: count }, (_, i) => ({
      url: `/media/products/${slug}-${i}.webp`,
      publicId: null,
      alt: i < p.colors.length ? `${p.name} in ${p.colors[i].name}` : `${p.name}`,
    }));
    const { render, category, ...fields } = p;
    const doc = await Product.create({
      ...fields,
      slug,
      category: catDocs[category]._id,
      images,
      shippingInfo: STD_SHIPPING,
      returnInfo: STD_RETURNS,
      brand: 'Sipcraft',
      lowStockThreshold: p.lowStockThreshold ?? 5,
    });
    const created = new Date(Date.now() - (p.isNewArrival ? 20 + productDocs.length : 200 - productDocs.length * 5) * DAY);
    await Product.collection.updateOne({ _id: doc._id }, { $set: { createdAt: created } });
    productDocs.push(doc);
  }

  /* Coupons */
  for (const c of coupons) {
    const { days, ...rest } = c;
    await Coupon.create({ ...rest, startDate: new Date(Date.now() - 30 * DAY), expiryDate: new Date(Date.now() + days * DAY) });
  }

  /* Historical orders (sample data for order history and analytics) */
  const statusPlan = [
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.PROCESSING,
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.PLACED,
    ORDER_STATUS.DELIVERED,
    ORDER_STATUS.CANCELLED,
  ];
  const flow = [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED];
  const purchasable = productDocs.filter((p) => p.stock > 0);
  const orders = [];
  let seq = 0;

  for (let n = 0; n < 34; n++) {
    const u = users[n % users.length];
    const status = statusPlan[n % statusPlan.length];
    // Recent orders are still in fulfilment; older ones are delivered.
    const ageDays = status === ORDER_STATUS.DELIVERED || status === ORDER_STATUS.CANCELLED ? 6 + Math.floor(rand() * 150) : Math.floor(rand() * 4);
    const createdAt = new Date(Math.max(u.created.getTime() + DAY, Date.now() - ageDays * DAY - Math.floor(rand() * 10) * 3600000));

    const lineCount = 1 + Math.floor(rand() * 3);
    const chosen = new Set();
    const items = [];
    while (items.length < lineCount) {
      // Rotate the first line through the catalogue so every product has sales history.
      const p = items.length === 0 ? purchasable[n % purchasable.length] : pick(purchasable);
      if (chosen.has(String(p._id))) continue;
      chosen.add(String(p._id));
      const qty = 1 + (rand() > 0.8 ? 1 : 0);
      const color = p.colors.length ? pick(p.colors).name : '';
      const size = p.sizes.length ? pick(p.sizes) : '';
      items.push({
        product: p._id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        image: p.images[0]?.url,
        category: p.category,
        price: p.price,
        mrp: p.mrp,
        quantity: qty,
        color,
        size,
        lineTotal: round2(p.price * qty),
      });
    }
    const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
    const useCoupon = subtotal >= 1999 && rand() > 0.6;
    const discount = useCoupon ? 200 : 0;
    const after = subtotal - discount;
    const shippingFee = after >= env.store.freeShippingThreshold ? 0 : env.store.shippingFee;
    const tax = round2((after * env.store.taxRate) / (100 + env.store.taxRate));
    const total = round2(after + shippingFee);

    const steps = status === ORDER_STATUS.CANCELLED ? [ORDER_STATUS.PLACED, ORDER_STATUS.CANCELLED] : flow.slice(0, flow.indexOf(status) + 1);
    const history = steps.map((s, i) => ({
      status: s,
      note: s === ORDER_STATUS.PLACED ? 'Payment received' : s === ORDER_STATUS.CANCELLED ? 'Cancelled by customer' : undefined,
      at: new Date(createdAt.getTime() + i * (status === ORDER_STATUS.DELIVERED ? 22 : 5) * 3600000),
    }));
    seq += 1;
    const orderNumber = `SC${createdAt.toISOString().slice(2, 10).replace(/-/g, '')}${String(1000 + seq)}`;
    const isRefunded = status === ORDER_STATUS.CANCELLED;

    const order = await Order.create({
      orderNumber,
      user: u.doc._id,
      items,
      shippingAddress: { fullName: u.info.name, phone: u.info.phone, email: u.info.email, address: u.info.address, city: u.info.city, state: u.info.state, pincode: u.info.pincode, country: 'India' },
      contact: { name: u.info.name, email: u.info.email, phone: u.info.phone },
      subtotal,
      discount,
      shippingFee,
      tax,
      total,
      coupon: useCoupon ? { code: 'HYDRATE200', discountType: 'fixed', discountValue: 200 } : undefined,
      paymentStatus: isRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PAID,
      orderStatus: status,
      statusHistory: history,
      paidAt: createdAt,
      trackingNumber: [ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED].includes(status) ? `DLV${String(78100000 + seq * 7919)}` : undefined,
      carrier: [ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED].includes(status) ? 'Delhivery' : undefined,
      deliveredAt: status === ORDER_STATUS.DELIVERED ? history[history.length - 1].at : undefined,
      cancelledAt: isRefunded ? history[1].at : undefined,
      cancelReason: isRefunded ? 'Cancelled by customer' : undefined,
      refundStatus: isRefunded ? 'processed' : 'none',
      refundAmount: isRefunded ? total : undefined,
      refundedAt: isRefunded ? history[1].at : undefined,
    });
    const payment = await Payment.create({
      order: order._id,
      user: u.doc._id,
      provider: 'seed',
      razorpayOrderId: `order_seed${String(seq).padStart(8, '0')}`,
      razorpayPaymentId: `pay_seed${String(seq).padStart(8, '0')}`,
      amount: Math.round(total * 100),
      currency: 'INR',
      status: isRefunded ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PAID,
      method: pick(['upi', 'card', 'upi', 'netbanking']),
      verifiedVia: 'signature',
      events: [{ event: 'seeded', at: createdAt }],
    });
    order.payment = payment._id;
    await order.save();
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt, updatedAt: history[history.length - 1].at } });
    await Payment.collection.updateOne({ _id: payment._id }, { $set: { createdAt } });
    if (!isRefunded) {
      for (const i of items) await Product.updateOne({ _id: i.product }, { $inc: { soldCount: i.quantity } });
    }
    orders.push(order);
  }

  /* Reviews on delivered orders */
  let r = 0;
  for (const order of orders.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED)) {
    for (const item of order.items) {
      if (rand() > 0.75) continue;
      const text = reviewTexts[r % reviewTexts.length];
      r += 1;
      const exists = await Review.exists({ user: order.user, product: item.product, order: order._id });
      if (exists) continue;
      const review = await Review.create({ user: order.user, product: item.product, order: order._id, rating: text.rating, title: text.title, comment: text.comment, status: 'approved' });
      await Review.collection.updateOne({ _id: review._id }, { $set: { createdAt: new Date(order.deliveredAt.getTime() + 2 * DAY) } });
      await Order.updateOne({ _id: order._id }, { $set: { 'items.$[i].reviewed': true } }, { arrayFilters: [{ 'i.product': item.product }] });
    }
  }
  const { recalcProductRating } = require('../src/controllers/reviewController');
  for (const p of productDocs) await recalcProductRating(p._id);

  /* Notifications for the most recent orders */
  for (const o of orders.filter((x) => [ORDER_STATUS.SHIPPED, ORDER_STATUS.PROCESSING].includes(x.orderStatus))) {
    await Notification.create({
      user: o.user,
      type: 'order',
      title: o.orderStatus === ORDER_STATUS.SHIPPED ? `Shipped · ${o.orderNumber}` : `Processing · ${o.orderNumber}`,
      message: o.orderStatus === ORDER_STATUS.SHIPPED ? 'Your order has been shipped.' : 'Your order is being packed.',
      link: `/orders/${o._id}`,
    });
  }

  /* Wishlists */
  for (const u of users.slice(0, 3)) {
    await Wishlist.create({ user: u.doc._id, products: [pick(productDocs)._id, pick(productDocs)._id].filter((v, i, a) => a.indexOf(v) === i) });
  }

  /* Content */
  for (const b of banners) await Banner.create(b);
  for (const t of team) await TeamMember.create(t);
  await ContactMessage.create({
    name: 'Neha Gupta',
    email: 'neha.gupta@example.com',
    phone: '9811098110',
    subject: 'Bulk order for 120 tumblers',
    message: 'Hi team, we are planning employee welcome kits for our Gurugram office and would like 120 Aurora tumblers with our logo engraved. Could you share pricing and lead times?',
  });

  log('\n✔ Seed complete');
  log(`  Categories: ${categories.length} · Products: ${productDocs.length} · Customers: ${users.length} · Orders: ${orders.length} · Reviews: ${r}`);
  log(`  Admin login     → ${adminEmail} / ${env.seed.adminPassword ? '(ADMIN_PASSWORD from .env)' : adminPassword}`);
  log(`  Customer logins → ${customers.map((c) => c.email).join(', ')}`);
  log(`  Customer password: ${env.seed.userPassword ? '(SEED_USER_PASSWORD from .env)' : userPassword}`);
  if (quiet && (!env.seed.adminPassword || !env.seed.userPassword)) {
    console.log(`[seed] Admin: ${adminEmail} / ${adminPassword}   Customers password: ${userPassword}`);
  }
  return { admin, users: users.map((u) => u.doc), products: productDocs, adminPassword, userPassword };
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (env.isProd && !args.includes('--force')) {
      console.error('Refusing to seed a production database. Re-run with --force if you are absolutely sure.');
      process.exit(1);
    }
    const { connectDB, disconnectDB } = require('../src/config/db');
    try {
      await connectDB();
      if (args.includes('--destroy')) {
        await wipe();
        console.log('✔ Store data removed');
      } else {
        await seed();
      }
    } catch (err) {
      console.error('Seed failed:', err);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}

module.exports = { seed, wipe };
