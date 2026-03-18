"use strict";

/**
 * Input validation utilities
 */
class Validator {
  
  static validateProfileUpdate(data) {
    const errors = [];
    
    // Username validation
    if (!data.username || data.username.trim().length < 2) {
      errors.push("Username must be at least 2 characters long");
    }
    
    if (data.username && data.username.length > 100) {
      errors.push("Username cannot exceed 100 characters");
    }
    
    // PRN validation (optional)
    if (data.prn && !/^[A-Z0-9]{6,20}$/i.test(data.prn)) {
      errors.push("PRN must be 6-20 alphanumeric characters");
    }
    
    // Class name validation (optional)
    if (data.class_name && data.class_name.length > 50) {
      errors.push("Class name cannot exceed 50 characters");
    }
    
    // Division validation (optional)
    if (data.division && data.division.length > 10) {
      errors.push("Division cannot exceed 10 characters");
    }
    
    // Current year validation (optional)
    if (data.current_year && (data.current_year < 1 || data.current_year > 8)) {
      errors.push("Current year must be between 1 and 8");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validatePassword(password) {
    return password && password.length >= 6;
  }
  
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }
  
  static sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/[<>]/g, '');
  }
}

module.exports = Validator;