/* Minimal leveled logger. Never pass secrets, passwords or tokens to it. */
const silent = process.env.NODE_ENV === 'test';
const stamp = () => new Date().toISOString();

module.exports = {
  info: (...a) => !silent && console.log(`[${stamp()}] INFO `, ...a),
  warn: (...a) => !silent && console.warn(`[${stamp()}] WARN `, ...a),
  error: (...a) => console.error(`[${stamp()}] ERROR`, ...a),
};
