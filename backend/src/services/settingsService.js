const { Setting } = require('../models');
const { env } = require('../config/env');

let cache = null;
let cachedAt = 0;
const TTL = 30 * 1000;

async function getSettings({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cachedAt < TTL) return cache;
  let doc = await Setting.findOne({ key: 'store' }).lean();
  if (!doc) doc = (await Setting.create({ key: 'store' })).toObject();
  cache = {
    ...doc,
    shippingFee: doc.shippingFee ?? env.store.shippingFee,
    freeShippingThreshold: doc.freeShippingThreshold ?? env.store.freeShippingThreshold,
    taxRate: doc.taxRate ?? env.store.taxRate,
    currency: env.store.currency,
  };
  cachedAt = Date.now();
  return cache;
}

function invalidateSettings() {
  cache = null;
}

module.exports = { getSettings, invalidateSettings };
