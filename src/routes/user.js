const express = require('express');
const router = express.Router();
const userService = require('../services/user');
const { authenticate } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  updateProfileValidator,
  updatePreferencesValidator,
  addPaymentMethodValidator,
  removePaymentMethodValidator,
  addDeviceTokenValidator,
  walletCreditValidator,
  validate,
} = require('../validators');

// Get profile
router.get(
  '/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await userService.getProfile(req.userId);
    res.json({
      success: true,
      data: { user },
    });
  })
);

// Update profile
router.put(
  '/profile',
  authenticate,
  updateProfileValidator,
  validate,
  asyncHandler(async (req, res) => {
    const user = await userService.updateProfile(req.userId, req.body);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  })
);

// Update preferences
router.put(
  '/preferences',
  authenticate,
  updatePreferencesValidator,
  validate,
  asyncHandler(async (req, res) => {
    const user = await userService.updateProfile(req.userId, req.body);
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: user.preferences },
    });
  })
);

// Update avatar
router.post(
  '/avatar',
  authenticate,
  ...uploadSingle('avatar', 'avatars'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    const result = await userService.updateAvatar(req.userId, req.file);
    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: result,
    });
  })
);

// Delete avatar
router.delete(
  '/avatar',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.deleteAvatar(req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get payment methods
router.get(
  '/payment-methods',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.getPaymentMethods(req.userId);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Add payment method
router.post(
  '/payment-methods',
  authenticate,
  addPaymentMethodValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await userService.addPaymentMethod(
      req.userId,
      req.body.paymentMethodId,
      req.body.setAsDefault
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Remove payment method
router.delete(
  '/payment-methods/:paymentMethodId',
  authenticate,
  removePaymentMethodValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await userService.removePaymentMethod(req.userId, req.params.paymentMethodId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Set default payment method
router.put(
  '/payment-methods/:paymentMethodId/default',
  authenticate,
  removePaymentMethodValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await userService.setDefaultPaymentMethod(req.userId, req.params.paymentMethodId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get wallet balance
router.get(
  '/wallet',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.getWalletBalance(req.userId);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Add funds to wallet
router.post(
  '/wallet/credit',
  authenticate,
  walletCreditValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await userService.addWalletFunds(
      req.userId,
      req.body.amount,
      req.body.paymentMethodId
    );
    res.json({
      success: true,
      message: 'Funds added successfully',
      data: result,
    });
  })
);

// Get affiliate code
router.get(
  '/affiliate',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.getAffiliateCode(req.userId);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get referral stats
router.get(
  '/referrals',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.getReferralStats(req.userId);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Add device token
router.post(
  '/device-token',
  authenticate,
  addDeviceTokenValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await userService.addDeviceToken(
      req.userId,
      req.body.token,
      req.body.platform
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Remove device token
router.delete(
  '/device-token',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.removeDeviceToken(req.userId, req.body.token);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Deactivate account
router.post(
  '/deactivate',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.deactivateAccount(req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Delete account
router.delete(
  '/account',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await userService.deleteAccount(req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

module.exports = router;
