"use strict";

/**
 * Standardized API response formatter
 */
class ResponseFormatter {
  
  static success(res, data = null, message = null) {
    const response = { success: true };
    
    if (data !== null) response.data = data;
    if (message) response.message = message;
    
    return res.json(response);
  }
  
  static error(res, message = "An error occurred", statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      error: message
    });
  }
  
  static notFound(res, message = "Resource not found") {
    return res.status(404).json({
      success: false,
      error: message
    });
  }
  
  static forbidden(res, message = "Access forbidden") {
    return res.status(403).json({
      success: false,
      error: message
    });
  }
  
  static unauthorized(res, message = "Unauthorized") {
    return res.status(401).json({
      success: false,
      error: message
    });
  }
  
  static serverError(res, message = "Internal server error") {
    return res.status(500).json({
      success: false,
      error: message
    });
  }
  
  static validationError(res, errors) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      errors: Array.isArray(errors) ? errors : [errors]
    });
  }
}

module.exports = ResponseFormatter;