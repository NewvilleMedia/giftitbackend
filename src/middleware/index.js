const {
  authenticate,
  optionalAuth,
  authorize,
  isAdmin,
  isSuperAdmin,
  isBusinessAdmin,
  requireEmailVerification,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('./auth');

const {
  rateLimitMiddleware,
  authRateLimitMiddleware,
  passwordResetRateLimitMiddleware,
  purchaseRateLimitMiddleware,
  resetAuthLimit,
} = require('./rateLimiter');

const {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  asyncHandler,
  notFoundHandler,
} = require('./errorHandler');

const {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
} = require('./upload');

module.exports = {
  // Auth
  authenticate,
  optionalAuth,
  authorize,
  isAdmin,
  isSuperAdmin,
  isBusinessAdmin,
  requireEmailVerification,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,

  // Rate Limiting
  rateLimitMiddleware,
  authRateLimitMiddleware,
  passwordResetRateLimitMiddleware,
  purchaseRateLimitMiddleware,
  resetAuthLimit,

  // Error Handling
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  asyncHandler,
  notFoundHandler,

  // Upload
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  handleUploadError,
};
