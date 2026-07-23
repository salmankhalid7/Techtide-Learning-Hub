import AppError from "./AppError.js";

class BadRequestError extends AppError {
  constructor(message = "Bad request.", errors = []) {
    super(message, 400, errors);
  }
}

export default BadRequestError;