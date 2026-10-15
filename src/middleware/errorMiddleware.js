import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * 404 Route Not Found Handler
 */
export const notFoundHandler = (req, res, next) => {
  const error = ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
};

/**
 * Global Centralized Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = err.message || 'An unexpected error occurred';
  let errors = err.errors || [];

  // Log detailed error in non-test environment
  if (env.NODE_ENV !== 'test') {
    logger.error(`[${req.method} ${req.url}] ${statusCode} - ${message}`, err.stack);
  }

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = `Invalid format for resource identifier: ${err.value}`;
    errors = [{ field: err.path, message: `Invalid identifier format: ${err.value}` }];
  }

  // Handle Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    message = 'Data validation failed';
    errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message
    }));
  }

  // Handle Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    const fields = Object.keys(err.keyValue || {});
    const fieldName = fields.join(', ');
    message = `Duplicate value entered for ${fieldName}. It must be unique.`;
    errors = fields.map(f => ({
      field: f,
      message: `${f} already exists in the system with value '${err.keyValue[f]}'`
    }));
  }

  // Handle JSON parse error in body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Malformed JSON syntax in request body';
    errors = [{ message: 'Please provide valid JSON in request body' }];
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds maximum allowed size (5MB).';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // Don't leak stack traces or internal server error messages in production
  if (statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR && env.NODE_ENV === 'production') {
    message = 'Internal server error. Please try again later.';
    errors = [];
  }

  return ApiResponse.error(res, statusCode, message, errors);
};
