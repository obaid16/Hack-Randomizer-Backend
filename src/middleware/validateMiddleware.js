import { ApiError } from '../utils/apiError.js';

/**
 * Validate request payload against a Zod schema.
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} source
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err.errors && Array.isArray(err.errors)) {
        const formattedErrors = err.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(ApiError.unprocessable('Validation failed', formattedErrors));
      }
      return next(ApiError.badRequest(err.message));
    }
  };
};
