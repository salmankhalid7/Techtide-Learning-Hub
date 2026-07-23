import { UnauthorizedError, ForbiddenError } from "../errors/index.js";

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("You are not authorized to perform this action."));
    }

    next();
  };
};

export default authorize;