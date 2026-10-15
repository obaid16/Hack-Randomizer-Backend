/**
 * Higher-order function to wrap async Express route handlers
 * and catch unhandled promise rejections.
 * @param {Function} fn
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
