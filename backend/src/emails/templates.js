/* Reusable, inline-styled HTML email templates. All dynamic values are HTML-escaped. */
const { formatINR } = require('../utils/helpers');

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const BRAND = '#6D5BD0';
const INK = '#17161C';

function layout({ preheader = '', heading, body, cta, footerNote = '' }) {
  const button = cta
    ? `<tr><td style="padding:8px 0 28px"><a href="${esc(cta.url)}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:600;font-size:14px">${esc(cta.label)}</a></td></tr>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(heading)}</title></head>
<body style="margin:0;background:#F6F5F2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">
<span style="display:none;opacity:0;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F5F2;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="padding:28px 36px;border-bottom:1px solid #EEECE8"><span style="font-size:20px;font-weight:700;letter-spacing:-0.02em">sipcraft<span style="color:${BRAND}">.</span></span></td></tr>
<tr><td style="padding:32px 36px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font-size:24px;font-weight:700;letter-spacing:-0.02em;padding-bottom:16px">${esc(heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.65;color:#4A4852;padding-bottom:20px">${body}</td></tr>
${button}
</table></td></tr>
<tr><td style="padding:20px 36px 28px;font-size:12px;line-height:1.6;color:#8C8A93;border-top:1px solid #EEECE8">${footerNote ? `${footerNote}<br>` : ''}Sipcraft · Crafted for everyday hydration · Bengaluru, India</td></tr>
</table></td></tr></table></body></html>`;
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (i) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #F0EEEA;font-size:14px">${esc(i.name)}${i.color || i.size ? `<br><span style="color:#8C8A93;font-size:12px">${esc([i.color, i.size].filter(Boolean).join(' · '))}</span>` : ''}</td>
<td style="padding:10px 0;border-bottom:1px solid #F0EEEA;font-size:14px;text-align:center">×${i.quantity}</td>
<td style="padding:10px 0;border-bottom:1px solid #F0EEEA;font-size:14px;text-align:right">${formatINR(i.lineTotal)}</td></tr>`,
    )
    .join('');
  const line = (label, value, bold) =>
    `<tr><td colspan="2" style="padding:6px 0;font-size:14px;${bold ? 'font-weight:700' : 'color:#4A4852'}">${label}</td><td style="padding:6px 0;font-size:14px;text-align:right;${bold ? 'font-weight:700' : ''}">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">${rows}
${line('Subtotal', formatINR(order.subtotal))}
${order.discount ? line(`Discount${order.coupon?.code ? ` (${esc(order.coupon.code)})` : ''}`, `− ${formatINR(order.discount)}`) : ''}
${line('Shipping', order.shippingFee ? formatINR(order.shippingFee) : 'Free')}
${line('Includes GST', formatINR(order.tax))}
${line('Total', formatINR(order.total), true)}</table>`;
}

const templates = {
  welcome: ({ name, clientUrl }) => ({
    subject: 'Welcome to Sipcraft',
    html: layout({
      preheader: 'Your account is ready.',
      heading: `Welcome, ${name.split(' ')[0]}.`,
      body: 'Your Sipcraft account is ready. Save favourites to your wishlist, track orders in real time and check out faster on every visit.<br><br>Here is 10% off your first order: use code <strong>WELCOME10</strong> at checkout.',
      cta: { label: 'Start exploring', url: `${clientUrl}/products` },
    }),
  }),

  passwordReset: ({ name, resetUrl, minutes }) => ({
    subject: 'Reset your Sipcraft password',
    html: layout({
      preheader: 'Use this link to choose a new password.',
      heading: 'Reset your password',
      body: `Hi ${esc(name.split(' ')[0])}, we received a request to reset your password. The link below expires in ${minutes} minutes and can only be used once.<br><br>If you didn't request this, you can safely ignore this email — your password won't change.`,
      cta: { label: 'Choose a new password', url: resetUrl },
      footerNote: 'For your security, all signed-in devices will be logged out once your password is changed.',
    }),
  }),

  passwordChanged: ({ name }) => ({
    subject: 'Your Sipcraft password was changed',
    html: layout({
      heading: 'Password updated',
      body: `Hi ${esc(name.split(' ')[0])}, the password for your account was just changed and all other sessions were signed out. If this wasn't you, reset your password immediately and contact care@sipcraft.in.`,
    }),
  }),

  orderConfirmation: ({ order, clientUrl }) => ({
    subject: `Order confirmed · ${order.orderNumber}`,
    html: layout({
      preheader: `We've received your order ${order.orderNumber}.`,
      heading: 'Thank you for your order',
      body: `Your order <strong>${esc(order.orderNumber)}</strong> is confirmed and we're getting it ready. We'll email you again when it ships.${itemsTable(order)}`,
      cta: { label: 'View order', url: `${clientUrl}/orders/${order._id}` },
    }),
  }),

  paymentConfirmation: ({ order, payment, clientUrl }) => ({
    subject: `Payment received · ${order.orderNumber}`,
    html: layout({
      heading: 'Payment successful',
      body: `We've received your payment of <strong>${formatINR(order.total)}</strong> for order <strong>${esc(order.orderNumber)}</strong>.<br><br>Payment ID: ${esc(payment.razorpayPaymentId)}`,
      cta: { label: 'View order', url: `${clientUrl}/orders/${order._id}` },
    }),
  }),

  orderShipped: ({ order, clientUrl }) => ({
    subject: `Your order is on its way · ${order.orderNumber}`,
    html: layout({
      heading: 'Your order has shipped',
      body: `Good news — order <strong>${esc(order.orderNumber)}</strong> is on its way.${order.trackingNumber ? `<br><br>Carrier: ${esc(order.carrier || 'Courier')}<br>Tracking number: <strong>${esc(order.trackingNumber)}</strong>` : ''}`,
      cta: { label: 'Track order', url: `${clientUrl}/orders/${order._id}` },
    }),
  }),

  orderDelivered: ({ order, clientUrl }) => ({
    subject: `Delivered · ${order.orderNumber}`,
    html: layout({
      heading: 'Your order was delivered',
      body: `Order <strong>${esc(order.orderNumber)}</strong> has been delivered. We hope you love it — share a review and help others find their perfect sip.`,
      cta: { label: 'Write a review', url: `${clientUrl}/orders/${order._id}` },
    }),
  }),

  orderCancelled: ({ order, clientUrl }) => ({
    subject: `Order cancelled · ${order.orderNumber}`,
    html: layout({
      heading: 'Your order was cancelled',
      body: `Order <strong>${esc(order.orderNumber)}</strong> has been cancelled.${order.cancelReason ? `<br>Reason: ${esc(order.cancelReason)}` : ''}${order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED' ? '<br><br>Any payment made will be refunded to the original payment method within 5–7 business days.' : ''}`,
      cta: { label: 'View order', url: `${clientUrl}/orders/${order._id}` },
    }),
  }),

  contactNotification: ({ msg }) => ({
    subject: `New contact message: ${msg.subject}`,
    html: layout({
      heading: 'New contact message',
      body: `<strong>From:</strong> ${esc(msg.name)} &lt;${esc(msg.email)}&gt;${msg.phone ? `<br><strong>Phone:</strong> ${esc(msg.phone)}` : ''}<br><strong>Subject:</strong> ${esc(msg.subject)}<br><br>${esc(msg.message).replace(/\n/g, '<br>')}`,
    }),
  }),

  contactReply: ({ msg, reply }) => ({
    subject: `Re: ${msg.subject}`,
    html: layout({
      heading: `Hi ${esc(msg.name.split(' ')[0])},`,
      body: `${esc(reply).replace(/\n/g, '<br>')}<br><br>— The Sipcraft team<br><br><span style="color:#8C8A93;font-size:13px">Your original message:<br>“${esc(msg.message).replace(/\n/g, '<br>')}”</span>`,
    }),
  }),

  contactAcknowledgement: ({ msg }) => ({
    subject: 'We received your message',
    html: layout({
      heading: `Thanks, ${esc(msg.name.split(' ')[0])}`,
      body: 'Our customer care team has received your message and will reply within one business day.',
    }),
  }),
};

module.exports = templates;
