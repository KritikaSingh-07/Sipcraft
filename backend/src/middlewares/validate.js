/**
 * Validates and replaces req.body / req.query / req.params using Zod schemas.
 * Unknown keys are stripped, so clients can't smuggle fields like `role` or `price`.
 */
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query ?? {});
      // Express 4 allows reassigning req.query; keep a copy for clarity.
      req.validatedQuery = parsed;
      req.query = parsed;
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = validate;
