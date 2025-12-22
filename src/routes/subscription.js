const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscription');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createSubscriptionValidator,
  updateSubscriptionValidator,
  subscriptionIdValidator,
  pauseSubscriptionValidator,
  cancelSubscriptionValidator,
  subscriptionListValidator,
  validate,
} = require('../validators');

// Get user subscriptions
router.get(
  '/',
  authenticate,
  subscriptionListValidator,
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await subscriptionService.getUserSubscriptions(req.userId, options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get subscription statistics
router.get(
  '/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const stats = await subscriptionService.getSubscriptionStats(req.userId);
    res.json({
      success: true,
      data: { stats },
    });
  })
);

// Create subscription
router.post(
  '/',
  authenticate,
  createSubscriptionValidator,
  validate,
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.createSubscription(req.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: { subscription },
    });
  })
);

// Get subscription by ID
router.get(
  '/:subscriptionId',
  authenticate,
  subscriptionIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.getSubscriptionById(
      req.params.subscriptionId,
      req.userId
    );
    res.json({
      success: true,
      data: { subscription },
    });
  })
);

// Update subscription
router.put(
  '/:subscriptionId',
  authenticate,
  updateSubscriptionValidator,
  validate,
  asyncHandler(async (req, res) => {
    const subscription = await subscriptionService.updateSubscription(
      req.params.subscriptionId,
      req.userId,
      req.body
    );
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: { subscription },
    });
  })
);

// Pause subscription
router.post(
  '/:subscriptionId/pause',
  authenticate,
  pauseSubscriptionValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.pauseSubscription(
      req.params.subscriptionId,
      req.userId,
      req.body.until
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Resume subscription
router.post(
  '/:subscriptionId/resume',
  authenticate,
  subscriptionIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.resumeSubscription(
      req.params.subscriptionId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Cancel subscription
router.post(
  '/:subscriptionId/cancel',
  authenticate,
  cancelSubscriptionValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await subscriptionService.cancelSubscription(
      req.params.subscriptionId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

module.exports = router;
