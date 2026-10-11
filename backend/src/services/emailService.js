const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const logger = require('../utils/logger');
const templates = require('../emails/templates');

let transporter = null;
const outbox = []; // last few rendered emails when SMTP is not configured (dev/test visibility)

function getTransporter() {
  if (transporter) return transporter;
  if (env.features.smtp()) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  } else {
    // No SMTP configured: render the message as JSON instead of sending it.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/**
 * Renders and sends a template email. Never throws — email failures must not break
 * checkout, registration or other core flows.
 */
async function sendEmail(to, templateName, data = {}) {
  if (!to) return false;
  try {
    const render = templates[templateName];
    if (!render) throw new Error(`Unknown email template: ${templateName}`);
    const { subject, html } = render({ clientUrl: env.clientUrls[0], ...data });
    await getTransporter().sendMail({ from: env.smtp.from, to, subject, html });
    if (!env.features.smtp()) {
      outbox.push({ to, subject, templateName, data, at: new Date() });
      if (outbox.length > 50) outbox.shift();
      logger.info(`[email:dev] "${subject}" → ${to} (SMTP not configured; not delivered)`);
    }
    return true;
  } catch (err) {
    logger.error(`Email "${templateName}" to ${to} failed:`, err.message);
    return false;
  }
}

/** Fire-and-forget helper. */
const queueEmail = (to, templateName, data) => {
  setImmediate(() => sendEmail(to, templateName, data));
};

module.exports = { sendEmail, queueEmail, __outbox: outbox };
