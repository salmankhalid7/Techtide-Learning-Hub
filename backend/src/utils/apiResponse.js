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

  /**
   * Convenience method — sends a standardised JSON response.
   *
   * @param {import("express").Response} res
   * @param {Object} opts
   * @param {string}  [opts.message="Success"]
   * @param {*}       [opts.data=null]
   * @param {number}  [opts.statusCode=200]
   */
  static success(res, { message = "Success", data = null, statusCode = 200 } = {}) {
    return res.status(statusCode).json(new ApiResponse(statusCode, message, data));
  }
}

export default ApiResponse;