const mongoose = require('mongoose');
const { env } = require('./env');
const logger = require('../utils/logger');

let memoryServer = null;

mongoose.set('strictQuery', true);
// NoSQL operator injection is blocked at the edge (express-mongo-sanitize + Zod validation of
// every request), so server-built filters can use operators freely.

async function connectDB(uriOverride) {
  let uri = uriOverride || env.mongoUri;
  if (!uri && env.useMemoryDb) {
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    uri = memoryServer.getUri('sipcraft');
    logger.warn('Using in-memory MongoDB (development only). Data is lost on restart.');
  }
  await mongoose.connect(uri, { autoIndex: !env.isProd || process.env.MONGO_AUTO_INDEX === 'true' });
  logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  memoryServer = null;
}

module.exports = { connectDB, disconnectDB, isMemoryDb: () => Boolean(memoryServer) };
