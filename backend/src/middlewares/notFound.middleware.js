/**
 * Not Found Middleware
 * Handles unmatched routes by returning a 404 error.
 */

import { NotFoundError } from "../errors/index.js";

const notFound = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

export default notFound;