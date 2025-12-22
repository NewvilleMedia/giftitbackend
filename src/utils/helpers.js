const crypto = require('crypto');

// Generate random string
const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate random code (alphanumeric)
const generateRandomCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generate affiliate code
const generateAffiliateCode = (prefix = 'GI') => {
  return `${prefix}${generateRandomCode(6)}`;
};

// Generate order ID
const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = generateRandomCode(4);
  return `ORD-${timestamp}-${random}`;
};

// Hash string (for tokens, etc.)
const hashString = (str) => {
  return crypto.createHash('sha256').update(str).digest('hex');
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone format
const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return phoneRegex.test(phone);
};

// Format currency
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

// Format date
const formatDate = (date, options = {}) => {
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  return new Date(date).toLocaleDateString('en-US', defaultOptions);
};

// Calculate percentage
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

// Paginate results
const paginate = (data, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const results = data.slice(startIndex, endIndex);

  return {
    data: results,
    pagination: {
      page,
      limit,
      total: data.length,
      pages: Math.ceil(data.length / limit),
      hasNextPage: endIndex < data.length,
      hasPrevPage: startIndex > 0,
    },
  };
};

// Sanitize object (remove undefined/null values)
const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Delay function
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry function with exponential backoff
const retry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, i);
        await delay(delayTime);
      }
    }
  }

  throw lastError;
};

// Parse CSV content
const parseCSV = (content, hasHeader = true) => {
  const lines = content.trim().split('\n');
  const headers = hasHeader ? lines[0].split(',').map((h) => h.trim()) : null;
  const startIndex = hasHeader ? 1 : 0;

  const data = [];
  for (let i = startIndex; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    if (headers) {
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });
      data.push(row);
    } else {
      data.push(values);
    }
  }

  return { headers, data };
};

// Validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Get IP address from request
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip
  );
};

// Mask sensitive data
const maskEmail = (email) => {
  const [local, domain] = email.split('@');
  const maskedLocal = local[0] + '*'.repeat(Math.max(local.length - 2, 1)) + local.slice(-1);
  return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 4) return phone;
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
};

const maskCard = (cardNumber) => {
  const cleaned = cardNumber.replace(/\D/g, '');
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
};

// Calculate days between dates
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Check if date is in the past
const isDateInPast = (date) => {
  return new Date(date) < new Date();
};

// Get start and end of period
const getPeriodDates = (period) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setMonth(now.getMonth() - 1);
  }

  return { startDate: start, endDate: end };
};

module.exports = {
  generateRandomString,
  generateRandomCode,
  generateAffiliateCode,
  generateOrderId,
  hashString,
  isValidEmail,
  isValidPhone,
  formatCurrency,
  formatDate,
  calculatePercentage,
  paginate,
  sanitizeObject,
  deepClone,
  delay,
  retry,
  parseCSV,
  isValidObjectId,
  getClientIP,
  maskEmail,
  maskPhone,
  maskCard,
  daysBetween,
  isDateInPast,
  getPeriodDates,
};
