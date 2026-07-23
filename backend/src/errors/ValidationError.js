import AppError from "./AppError.js";

class ValidationError extends AppError {
  constructor(message = "Validation failed.") {
    super(message, 422);
  }
}

export default ValidationError;