let loader = null;

/** Loads Razorpay Checkout once. Resolves to window.Razorpay. */
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('Razorpay failed to load')));
      s.onerror = () => {
        loader = null;
        reject(new Error('Could not load the payment window. Check your connection and try again.'));
      };
      document.body.appendChild(s);
    });
  }
  return loader;
}

/**
 * Opens Razorpay Checkout for a server-created order.
 * Resolves with the payment response on success; rejects with { reason } on failure or dismissal.
 * The result is never trusted on its own — it is always verified by the API.
 */
export async function openRazorpayCheckout(order, { onFailure } = {}) {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      name: 'Sipcraft',
      description: `Order ${order.orderNumber}`,
      image: `${window.location.origin}/favicon.svg`,
      prefill: order.prefill,
      notes: { orderNumber: order.orderNumber },
      theme: { color: '#6D5BD0' },
      retry: { enabled: true, max_count: 3 },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject({ reason: 'dismissed' }),
        confirm_close: true,
        escape: true,
      },
    });
    rzp.on('payment.failed', (resp) => {
      onFailure?.(resp.error);
    });
    rzp.open();
  });
}
