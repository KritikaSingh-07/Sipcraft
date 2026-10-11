/* Test bootstrap: in-memory MongoDB, test secrets and a fake Razorpay client. */
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-'.padEnd(64, 'a');
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-'.padEnd(64, 'b');
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummykey';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_test_value';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.ADMIN_EMAIL = 'admin@sipcraft.test';
process.env.ADMIN_PASSWORD = 'AdminPass123';
process.env.SEED_USER_PASSWORD = 'Customer123';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.MONGO_URI = '';
process.env.USE_MEMORY_DB = 'false';

const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { __setRazorpayClient } = require('../src/config/razorpay');

/** In-memory stand-in for the Razorpay SDK used by the payment service. */
function createFakeRazorpay() {
  const orders = new Map();
  const payments = new Map();
  return {
    orders: {
      create: async ({ amount, currency, receipt }) => {
        const o = { id: `order_${crypto.randomBytes(7).toString('hex')}`, amount, currency, receipt, status: 'created' };
        orders.set(o.id, o);
        return o;
      },
      fetchPayments: async (orderId) => ({ items: [...payments.values()].filter((p) => p.order_id === orderId) }),
    },
    payments: {
      fetch: async (id) => {
        const p = payments.get(id);
        if (!p) throw Object.assign(new Error('not found'), { error: { description: 'payment not found' } });
        return p;
      },
      capture: async (id) => {
        const p = payments.get(id);
        p.status = 'captured';
        return p;
      },
      refund: async (id, { amount }) => ({ id: `rfnd_${crypto.randomBytes(5).toString('hex')}`, payment_id: id, amount }),
    },
    /** Simulates the customer completing payment in Razorpay Checkout. */
    pay(orderId, { status = 'captured', amount } = {}) {
      const order = orders.get(orderId);
      const id = `pay_${crypto.randomBytes(7).toString('hex')}`;
      payments.set(id, { id, order_id: orderId, amount: amount ?? order.amount, status, method: 'upi' });
      const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${id}`).digest('hex');
      return { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: signature };
    },
  };
}

let replSet;
async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDB(replSet.getUri('sipcraft_test'));
  const { seed } = require('../seed/seed');
  const seeded = await seed({ quiet: true });
  const rzp = createFakeRazorpay();
  __setRazorpayClient(rzp);
  const app = require('../src/app');
  return { app, rzp, seeded };
}

async function teardown() {
  await disconnectDB();
  if (replSet) await replSet.stop();
}

const ORIGIN = 'http://localhost:5173';

/** Extracts the refresh cookie ("sc_rt=...") from a response. */
const refreshCookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('sc_rt='));
const cookiePair = (setCookie) => setCookie.split(';')[0];

module.exports = { request, setup, teardown, ORIGIN, refreshCookie, cookiePair };
