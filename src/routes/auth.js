const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const { authenticate } = require('../middleware/auth');
const { authRateLimitMiddleware, passwordResetRateLimitMiddleware } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  refreshTokenValidator,
  verifyEmailValidator,
  registerBusinessValidator,
  resendVerificationPublicValidator,
  validate,
} = require('../validators');

// Register
router.post(
  '/register',
  authRateLimitMiddleware,
  registerValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: result,
    });
  })
);

// Register a business account (creates User + Business)
router.post(
  '/register-business',
  authRateLimitMiddleware,
  registerBusinessValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.registerBusiness(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email to activate your account.',
      data: result,
    });
  })
);

// Resend verification email by email address (unauthenticated, rate-limited)
router.post(
  '/resend-verification-public',
  authRateLimitMiddleware,
  resendVerificationPublicValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerificationByEmail(req.body.email);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Login
router.post(
  '/login',
  authRateLimitMiddleware,
  loginValidator,
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const deviceInfo = {
      token: req.body.deviceToken,
      platform: req.body.platform,
    };
    const result = await authService.login(email, password, deviceInfo);
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  })
);

// Refresh token
router.post(
  '/refresh-token',
  refreshTokenValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Verify email
router.get(
  '/verify-email/:token',
  verifyEmailValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.verifyEmail(req.params.token);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Resend verification email
router.post(
  '/resend-verification',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.resendVerificationEmail(req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Forgot password
router.post(
  '/forgot-password',
  passwordResetRateLimitMiddleware,
  forgotPasswordValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.forgotPassword(req.body.email);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Reset password
router.post(
  '/reset-password/:token',
  resetPasswordValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await authService.resetPassword(req.params.token, req.body.password);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Change password
router.post(
  '/change-password',
  authenticate,
  changePasswordValidator,
  validate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.userId, currentPassword, newPassword);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Force change password (after temp password login)
router.post(
  '/force-change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }
    const result = await authService.forceChangePassword(req.userId, newPassword);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Logout
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await authService.logout(req.userId, req.body.deviceToken);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get current user
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.userId);
    res.json({
      success: true,
      data: { user },
    });
  })
);

module.exports = router;
