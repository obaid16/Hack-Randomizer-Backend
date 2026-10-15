import { HTTP_STATUS } from '../constants/httpStatus.js';

export class ApiResponse {
  /**
   * Format standard success response
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {object|array|null} data
   * @param {object|null} meta
   */
  static success(res, statusCode = HTTP_STATUS.OK, message = 'Success', data = {}, meta = undefined) {
    const responsePayload = {
      success: true,
      message,
      data: data !== null && data !== undefined ? data : {}
    };

    if (meta !== undefined && meta !== null) {
      responsePayload.meta = meta;
    }

    return res.status(statusCode).json(responsePayload);
  }

  /**
   * Format standard error response
   * @param {import('express').Response} res
   * @param {number} statusCode
   * @param {string} message
   * @param {Array} errors
   */
  static error(res, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, message = 'An unexpected error occurred', errors = []) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: Array.isArray(errors) ? errors : [errors]
    });
  }
}
