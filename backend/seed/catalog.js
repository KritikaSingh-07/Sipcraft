/**
 * Catalogue-only seed — safe to run against a database that already has real users/orders.
 *
 *   npm run seed:catalog
 *
 * Upserts categories and products from ./data.js (matched by slug / SKU) and adds the sample
 * promo banners if there are none, upserts team members by name, and stores the coupons and the
 * default page content (Home/About/Services) — admin edits to coupons and content are kept.
 * Never deletes anything and never touches users, orders, reviews or carts. Product stock/price/flags are refreshed from data.js on every run; sales
 * counters are only set when a product is first created.
 */
const { env } = require('../src/config/env');
const { Category, Product, Banner, Setting, TeamMember, Coupon, Order, SiteContent } = require('../src/models');
const { CONTENT_DEFAULTS } = require('../src/validators/content');
const { categories, products, banners, team, coupons, STD_SHIPPING, STD_RETURNS } = require('./data');
const { toSlug } = require('../src/utils/helpers');

/** Number of bundled renders per product (mirrors tools/product-renders). */
function imageCount(p) {
  if (p.render.shape === 'gift-box') return p.colors.length + 1;
  if (p.render.shape === 'straw-set') return 2;
  return Math.max(p.colors.length, 1) + 1;
}

const DAY = 86400000;

/** Upserts the store coupons by code. Dates are only set on first insert; edits made in admin are kept. */
async function ensureCoupons() {
  for (const { days, ...c } of coupons) {
    const { description, discountType, discountValue, minimumOrderAmount, maximumDiscount, perUserLimit, usageLimit, code } = c;
    await Coupon.updateOne(
      { code },
      {
        $setOnInsert: { code, description, discountType, discountValue, minimumOrderAmount, maximumDiscount, perUserLimit, usageLimit, isActive: true, startDate: new Date(Date.now() - 365 * DAY), expiryDate: new Date(Date.now() + days * DAY) },
      },
      { upsert: true },
    );
  }
  await syncCouponUsage();
}

/** usedCount = number of orders that actually paid with the coupon (refunded ones included). */
async function syncCouponUsage() {
  const all = await Coupon.find().select('code').lean();
  for (const c of all) {
    const used = await Order.countDocuments({ 'coupon.code': c.code, paymentStatus: { $in: ['PAID', 'REFUNDED'] } });
    await Coupon.updateOne({ _id: c._id }, { $set: { usedCount: used } });
  }
}

/** Stores the default Home / About / Services page content, without overwriting admin edits. */
async function ensureSiteContent() {
  let added = 0;
  for (const [key, data] of Object.entries(CONTENT_DEFAULTS)) {
    const r = await SiteContent.updateOne({ key }, { $setOnInsert: { key, data } }, { upsert: true });
    added += r.upsertedCount || 0;
  }
  return added;
}

// Deterministic starting popularity so "best sellers" and popularity sorting have an order.
const initialSold = (p, i) => (p.isBestSeller ? 180 : p.isFeatured ? 90 : 30) + ((i * 37) % 60);

async function seedCatalog({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);

  await Setting.updateOne({ key: 'store' }, { $setOnInsert: { key: 'store' } }, { upsert: true });

  const catIds = {};
  for (const c of categories) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $set: { name: c.name, description: c.description, sortOrder: c.sortOrder, image: { url: `/media/categories/${c.slug}.webp`, publicId: null } } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    catIds[c.slug] = doc._id;
  }

  let created = 0;
  let updated = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const slug = toSlug(p.name);
    const images = Array.from({ length: imageCount(p) }, (_, n) => ({
      url: `/media/products/${slug}-${n}.webp`,
      publicId: null,
      alt: n < p.colors.length ? `${p.name} in ${p.colors[n].name}` : p.name,
    }));
    const { render, category, ...fields } = p;
    const values = {
      ...fields,
      slug,
      category: catIds[category],
      images,
      shippingInfo: STD_SHIPPING,
      returnInfo: STD_RETURNS,
      brand: 'Sipcraft',
      lowStockThreshold: p.lowStockThreshold ?? 5,
    };

    const existing = await Product.findOne({ $or: [{ sku: p.sku.toUpperCase() }, { slug }] });
    if (existing) {
      existing.set(values);
      await existing.save(); // save() so model hooks (discount, stock status) run
      updated++;
    } else {
      await Product.create({ ...values, soldCount: initialSold(p, i) });
      created++;
    }
  }

  let bannersAdded = 0;
  if ((await Banner.countDocuments()) === 0) {
    for (const b of banners) await Banner.create(b);
    bannersAdded = banners.length;
  }

  await ensureCoupons();
  const contentAdded = await ensureSiteContent();

  // Team members are matched by name; fields from data.js are refreshed on every run.
  for (const t of team) await TeamMember.updateOne({ name: t.name }, { $set: t }, { upsert: true });

  log('\n✔ Catalogue seeded');
  log(`  Categories: ${categories.length} · Products created: ${created} · updated: ${updated} · Banners added: ${bannersAdded} · Team: ${team.length} · Coupons: ${coupons.length} · Page content added: ${contentAdded}`);
  return { created, updated };
}

if (require.main === module) {
  (async () => {
    if (env.isProd && !process.argv.includes('--force')) {
      console.error('Refusing to seed a production database. Re-run with --force if you are absolutely sure.');
      process.exit(1);
    }
    const { connectDB, disconnectDB } = require('../src/config/db');
    try {
      await connectDB();
      await seedCatalog();
    } catch (err) {
      console.error('Catalogue seed failed:', err);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}

module.exports = { seedCatalog, ensureCoupons, syncCouponUsage, ensureSiteContent };
