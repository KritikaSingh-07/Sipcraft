const { env, assertEnv } = require('./config/env');
const logger = require('./utils/logger');

async function main() {
  assertEnv();
  const { connectDB, disconnectDB, isMemoryDb } = require('./config/db');
  const app = require('./app');
  const { startReservationJob, stopReservationJob } = require('./jobs/reservationJob');

  await connectDB();
  if (isMemoryDb()) {
    // Ephemeral dev database: seed it so the store is usable immediately.
    const { seed } = require('../seed/seed');
    await seed({ quiet: true });
    logger.info('In-memory database seeded with sample data');
  }
  // Admin login works straight from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
  await require('./services/adminBootstrap')
    .ensureEnvAdmin()
    .catch((err) => logger.error('Could not set up the .env admin account:', err));
  startReservationJob();

  const server = app.listen(env.port, () => {
    logger.info(`Sipcraft API listening on http://localhost:${env.port} (${env.nodeEnv})`);
    if (!env.features.payments()) logger.warn('Razorpay keys missing — checkout will be unavailable until RAZORPAY_KEY_ID/SECRET are set.');
    if (!env.features.uploads()) logger.warn('Cloudinary not configured — uploads are stored on local disk in backend/uploads.');
    if (!env.features.smtp()) logger.warn('SMTP not configured — emails are logged to the console instead of sent.');
  });
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${env.port} is already in use — another server (probably an older instance of this API) is running. Stop it or set PORT in .env.`);
    } else {
      logger.error(err);
    }
    stopReservationJob();
    await disconnectDB();
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down…`);
    stopReservationJob();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
}

main().catch((err) => {
  logger.error(err.isConfigError ? err.message : err);
  process.exit(1);
});
