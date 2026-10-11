const mongoose = require('mongoose');
const multer = require('multer');
const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { env } = require('../config/env');

const notFound = (req, res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err instanceof ZodError) {
    error = ApiError.badRequest('Validation failed', {
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = ApiError.badRequest('Validation failed', {
      code: 'VALIDATION_ERROR',
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    });
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    error = ApiError.conflict(`A record with this ${field} already exists`, { code: 'DUPLICATE' });
  } else if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
    error = ApiError.badRequest(msg, { code: err.code });
  } else if (err && err.type === 'entity.too.large') {
    error = new ApiError(413, 'Request body is too large');
  } else if (err && err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body');
  } else if (!(err instanceof ApiError)) {
    logger.error(err);
    error = new ApiError(500, 'Something went wrong. Please try again.');
  }

  const body = { success: false, message: error.message };
  if (error.code) body.code = error.code;
  if (error.details) body.details = error.details;
  // Stack traces are never sent to clients in production.
  if (!env.isProd && !env.isTest && error.statusCode >= 500 && err.stack) body.stack = err.stack;

  res.status(error.statusCode || 500).json(body);
};

module.exports = { notFound, errorHandler };
