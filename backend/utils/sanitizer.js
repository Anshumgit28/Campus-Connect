"use strict";

/**
 * Input sanitization utilities
 */
class Sanitizer {
  
  static sanitizeProfileData(data) {
    return {
      username: this.sanitizeString(data.username),
      prn: this.sanitizeString(data.prn),
      class_name: this.sanitizeString(data.class_name),
      division: this.sanitizeString(data.division),
      current_year: data.current_year ? parseInt(data.current_year) : null
    };
  }
  
  static sanitizeString(str) {
    if (!str) return '';
    
    return String(str)
      .trim()
      .replace(/[<>]/g, '')  // Remove potential HTML tags
      .slice(0, 255);  // Limit length
  }
  
  static sanitizeNumber(num) {
    const parsed = parseInt(num);
    return isNaN(parsed) ? null : parsed;
  }
  
  static sanitizeBoolean(val) {
    return Boolean(val);
  }
  
  static sanitizeArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => item !== null && item !== undefined);
  }
  
  static removeHtmlTags(str) {
    if (!str) return '';
    return String(str).replace(/<[^>]*>/g, '');
  }
}

module.exports = Sanitizer;