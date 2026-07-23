/**
 * ApiResponse
 * Standardized structure for all successful API responses.
 */

class ApiResponse {
  constructor(
    statusCode,
    message = "Success",
    data = null,
    success = true
  ) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

export default ApiResponse;