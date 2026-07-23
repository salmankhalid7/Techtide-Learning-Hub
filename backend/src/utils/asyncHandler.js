/**
 * Async Handler
 * Wraps async route handlers to catch errors and forward them to Express error middleware.
 */

const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export default asyncHandler;