/* Admin analytics — every figure comes from MongoDB aggregation, nothing is hard-coded. */
const { Order, User, Product, Cart, Review, ContactMessage, Payment } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { round2 } = require('../utils/helpers');
const { PAYMENT_STATUS, ORDER_STATUS } = require('../utils/constants');

const TZ = 'Asia/Kolkata';
const PAID = { paymentStatus: PAYMENT_STATUS.PAID };
// Orders that completed payment at some point (refunds still count as orders, not revenue).
const PLACED_ORDERS = { paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED] } };

const startOfDay = (d = new Date()) => {
  // Midnight in IST expressed as a UTC Date.
  const ist = new Date(d.getTime() + 330 * 60000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60000);
};
const daysAgo = (n) => new Date(startOfDay().getTime() - n * 86400000);
/** Start of the IST calendar month, `monthsBack` months ago. */
const startOfMonth = (monthsBack = 0) => {
  const ist = new Date(Date.now() + 330 * 60000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - monthsBack, 1) - 330 * 60000);
};
const startOfYear = () => {
  const ist = new Date(Date.now() + 330 * 60000);
  return new Date(Date.UTC(ist.getUTCFullYear(), 0, 1) - 330 * 60000);
};

const FORMATS = { day: '%Y-%m-%d', week: '%G-W%V', month: '%Y-%m' };

/** Builds a continuous list of period keys so charts have no gaps. */
function periodKeys(from, granularity) {
  const keys = [];
  const fmt = (d) => {
    const ist = new Date(d.getTime() + 330 * 60000);
    const y = ist.getUTCFullYear();
    const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const day = String(ist.getUTCDate()).padStart(2, '0');
    if (granularity === 'month') return `${y}-${m}`;
    if (granularity === 'week') {
      const t = new Date(Date.UTC(y, ist.getUTCMonth(), ist.getUTCDate()));
      const dayNum = t.getUTCDay() || 7;
      t.setUTCDate(t.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
      return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    return `${y}-${m}-${day}`;
  };
  const step = granularity === 'month' ? null : granularity === 'week' ? 7 : 1;
  let cursor = new Date(from);
  const end = new Date();
  while (cursor <= end) {
    const k = fmt(cursor);
    if (!keys.includes(k)) keys.push(k);
    if (step) cursor = new Date(cursor.getTime() + step * 86400000);
    else {
      const ist = new Date(cursor.getTime() + 330 * 60000);
      cursor = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - 330 * 60000);
    }
  }
  const last = fmt(end);
  if (!keys.includes(last)) keys.push(last);
  return keys;
}

async function revenueSeries(from, granularity) {
  const rows = await Order.aggregate([
    { $match: { ...PLACED_ORDERS, paidAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: FORMATS[granularity], date: '$paidAt', timezone: TZ } },
        revenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, '$total', 0] } },
        orders: { $sum: 1 },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [r._id, r]));
  return periodKeys(from, granularity).map((k) => ({ period: k, revenue: round2(map.get(k)?.revenue || 0), orders: map.get(k)?.orders || 0 }));
}

async function sumRevenue(from) {
  const [r] = await Order.aggregate([
    { $match: { ...PAID, ...(from ? { paidAt: { $gte: from } } : {}) } },
    { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
  ]);
  return { revenue: round2(r?.revenue || 0), orders: r?.orders || 0 };
}

async function topProducts(from, limit = 6) {
  return Order.aggregate([
    { $match: { ...PAID, ...(from ? { paidAt: { $gte: from } } : {}) } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', name: { $first: '$items.name' }, image: { $first: '$items.image' }, quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
    { $sort: { quantity: -1, revenue: -1 } },
    { $limit: limit },
  ]);
}

async function categorySales(from) {
  return Order.aggregate([
    { $match: { ...PAID, ...(from ? { paidAt: { $gte: from } } : {}) } },
    { $unwind: '$items' },
    { $group: { _id: '$items.category', revenue: { $sum: '$items.lineTotal' }, quantity: { $sum: '$items.quantity' } } },
    { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'cat' } },
    { $project: { _id: 1, revenue: { $round: ['$revenue', 2] }, quantity: 1, name: { $ifNull: [{ $first: '$cat.name' }, 'Uncategorised'] } } },
    { $sort: { revenue: -1 } },
  ]);
}

async function customerGrowth(months = 12) {
  const from = startOfMonth(months - 1);
  const [rows, before] = await Promise.all([
    User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'user', createdAt: { $lt: from } }),
  ]);
  const map = new Map(rows.map((r) => [r._id, r.count]));
  let running = before;
  return periodKeys(from, 'month').map((k) => {
    running += map.get(k) || 0;
    return { period: k, newCustomers: map.get(k) || 0, totalCustomers: running };
  });
}

/* GET /api/admin/dashboard */
const dashboard = asyncHandler(async (req, res) => {
  const [total, today, month, totalOrders, statusCounts, customers, products, lowStock, recentOrders, revenue30, top, cats, growth, newMessages, pendingReviews] =
    await Promise.all([
      sumRevenue(),
      sumRevenue(startOfDay()),
      sumRevenue(startOfMonth()),
      Order.countDocuments(PLACED_ORDERS),
      Order.aggregate([{ $match: PLACED_ORDERS }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      User.countDocuments({ role: 'user' }),
      Product.countDocuments({}),
      Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
        .select('name sku stock lowStockThreshold images slug')
        .sort({ stock: 1 })
        .limit(8)
        .lean(),
      Order.find(PLACED_ORDERS).select('orderNumber contact total orderStatus paymentStatus createdAt items').sort({ createdAt: -1 }).limit(6).lean(),
      revenueSeries(daysAgo(29), 'day'),
      topProducts(null, 5),
      categorySales(null),
      customerGrowth(6),
      ContactMessage.countDocuments({ status: 'new' }),
      Review.countDocuments({ status: 'pending' }),
    ]);

  const byStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));
  const pending = [ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING].reduce((s, k) => s + (byStatus[k] || 0), 0);
  const lowStockCount = await Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } });

  res.json({
    success: true,
    data: {
      stats: {
        totalRevenue: total.revenue,
        todayRevenue: today.revenue,
        todayOrders: today.orders,
        monthlyRevenue: month.revenue,
        monthlyOrders: month.orders,
        totalOrders,
        pendingOrders: pending,
        inTransitOrders: (byStatus.SHIPPED || 0) + (byStatus.OUT_FOR_DELIVERY || 0),
        completedOrders: byStatus.DELIVERED || 0,
        cancelledOrders: byStatus.CANCELLED || 0,
        customers,
        products,
        lowStockCount,
        averageOrderValue: total.orders ? round2(total.revenue / total.orders) : 0,
        newMessages,
        pendingReviews,
      },
      ordersByStatus: byStatus,
      lowStock,
      recentOrders,
      charts: { revenue: revenue30, topProducts: top, categorySales: cats, customerGrowth: growth },
    },
  });
});

/* GET /api/admin/analytics?range=7d|30d|90d|12m */
const analytics = asyncHandler(async (req, res) => {
  const range = ['7d', '30d', '90d', '12m'].includes(req.query.range) ? req.query.range : '30d';
  const config = { '7d': [daysAgo(6), 'day'], '30d': [daysAgo(29), 'day'], '90d': [daysAgo(89), 'week'], '12m': [null, 'month'] }[range];
  const [rangeFrom, granularity] = config;
  const from = rangeFrom || startOfMonth(11);
  const prevFrom = new Date(from.getTime() - (Date.now() - from.getTime()));

  const [series, daily, weekly, monthly, yearly, allTime, period, previous, top, cats, growth, checkoutsStarted, checkoutsPaid, activeCarts, repeat, statusMix] =
    await Promise.all([
      revenueSeries(from, granularity),
      sumRevenue(startOfDay()),
      sumRevenue(daysAgo(6)),
      sumRevenue(startOfMonth()),
      sumRevenue(startOfYear()),
      sumRevenue(),
      sumRevenue(from),
      Order.aggregate([
        { $match: { ...PAID, paidAt: { $gte: prevFrom, $lt: from } } },
        { $group: { _id: null, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
      ]),
      topProducts(from, 8),
      categorySales(from),
      customerGrowth(12),
      Order.countDocuments({ createdAt: { $gte: from } }),
      Order.countDocuments({ createdAt: { $gte: from }, ...PLACED_ORDERS }),
      Cart.countDocuments({ 'items.0': { $exists: true }, updatedAt: { $gte: from } }),
      Order.aggregate([{ $match: PLACED_ORDERS }, { $group: { _id: '$user', n: { $sum: 1 } } }, { $group: { _id: null, customers: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gt: ['$n', 1] }, 1, 0] } } } }]),
      Order.aggregate([{ $match: { ...PLACED_ORDERS, createdAt: { $gte: from } } }, { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    ]);

  const [newCustomers, periodBuyers, cancelledOrders, inventory, payments] = await Promise.all([
    User.countDocuments({ role: 'user', createdAt: { $gte: from } }),
    // Buyers in the period, split by whether they had a paid order before it.
    Order.aggregate([
      { $match: { ...PAID, paidAt: { $gte: from } } },
      { $group: { _id: '$user' } },
      { $lookup: { from: 'orders', let: { u: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$user', '$$u'] }, { $eq: ['$paymentStatus', PAYMENT_STATUS.PAID] }, { $lt: ['$paidAt', from] }] } } }, { $limit: 1 }], as: 'prior' } },
      { $group: { _id: null, total: { $sum: 1 }, returning: { $sum: { $cond: [{ $gt: [{ $size: '$prior' }, 0] }, 1, 0] } } } },
    ]),
    Order.countDocuments({ orderStatus: ORDER_STATUS.CANCELLED, ...PLACED_ORDERS, updatedAt: { $gte: from } }),
    Product.aggregate([
      { $match: { isArchived: { $ne: true } } },
      {
        $group: {
          _id: null,
          products: { $sum: 1 },
          units: { $sum: '$stock' },
          stockValue: { $sum: { $multiply: ['$stock', '$price'] } },
          outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
          lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', '$lowStockThreshold'] }] }, 1, 0] } },
        },
      },
    ]),
    Payment.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
  ]);
  const inv = inventory[0] || {};
  const buyers = periodBuyers[0] || { total: 0, returning: 0 };

  const prev = { revenue: round2(previous[0]?.revenue || 0), orders: previous[0]?.orders || 0 };
  const pct = (cur, old) => (old ? round2(((cur - old) / old) * 100) : null);

  res.json({
    success: true,
    data: {
      range,
      granularity,
      summary: {
        dailyRevenue: daily.revenue,
        weeklyRevenue: weekly.revenue,
        monthlyRevenue: monthly.revenue,
        yearlyRevenue: yearly.revenue,
        allTimeRevenue: allTime.revenue,
        periodRevenue: period.revenue,
        periodOrders: period.orders,
        totalOrders: allTime.orders,
        averageOrderValue: period.orders ? round2(period.revenue / period.orders) : 0,
        revenueChange: pct(period.revenue, prev.revenue),
        ordersChange: pct(period.orders, prev.orders),
      },
      conversion: {
        checkoutsStarted,
        checkoutsPaid,
        checkoutConversionRate: checkoutsStarted ? round2((checkoutsPaid / checkoutsStarted) * 100) : 0,
        activeCarts,
        repeatCustomerRate: repeat[0]?.customers ? round2((repeat[0].repeat / repeat[0].customers) * 100) : 0,
        payingCustomers: repeat[0]?.customers || 0,
      },
      customers: { newCustomers, buyers: buyers.total, returningCustomers: buyers.returning, firstTimeBuyers: buyers.total - buyers.returning },
      cancelledOrders,
      inventory: {
        products: inv.products || 0,
        units: inv.units || 0,
        stockValue: round2(inv.stockValue || 0),
        outOfStock: inv.outOfStock || 0,
        lowStock: inv.lowStock || 0,
        inStock: (inv.products || 0) - (inv.outOfStock || 0) - (inv.lowStock || 0),
      },
      payments: ['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'CREATED'].map((s) => {
        const p = payments.find((x) => x._id === s);
        return { status: s, count: p?.count || 0, amount: round2((p?.amount || 0) / 100) };
      }),
      series,
      topProducts: top,
      categorySales: cats,
      customerGrowth: growth,
      orderStatusMix: statusMix.map((s) => ({ status: s._id, count: s.count })),
    },
  });
});

module.exports = { dashboard, analytics };
