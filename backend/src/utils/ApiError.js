class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg = 'Bad request', opts) { return new ApiError(400, msg, opts); }
  static unauthorized(msg = 'Authentication required', opts) { return new ApiError(401, msg, opts); }
  static forbidden(msg = 'You do not have permission to perform this action', opts) { return new ApiError(403, msg, opts); }
  static notFound(msg = 'Resource not found', opts) { return new ApiError(404, msg, opts); }
  static conflict(msg = 'Conflict', opts) { return new ApiError(409, msg, opts); }
  static unavailable(msg = 'Service unavailable', opts) { return new ApiError(503, msg, opts); }
}

module.exports = ApiError;
