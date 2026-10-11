const { releaseExpiredReservations } = require('../services/orderService');
const logger = require('../utils/logger');

let timer = null;
let running = false;

/** Every minute: release stock held by unpaid checkouts whose payment window expired. */
function startReservationJob(intervalMs = 60 * 1000) {
  if (timer) return;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const n = await releaseExpiredReservations();
      if (n) logger.info(`Released ${n} expired checkout reservation(s)`);
    } catch (err) {
      logger.error('Reservation job failed:', err.message);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
}

function stopReservationJob() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startReservationJob, stopReservationJob };
