const Razorpay = require('razorpay');
const { env } = require('./env');

let instance = null;
let override = null;

function getRazorpay() {
  if (override) return override;
  if (!env.features.payments()) return null;
  if (!instance) instance = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return instance;
}

/** Test hook: substitute the Razorpay client (used only by the automated test-suite). */
function __setRazorpayClient(client) {
  override = client;
}

module.exports = { getRazorpay, __setRazorpayClient };
