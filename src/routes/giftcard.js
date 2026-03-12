const express = require('express');
const router = express.Router();
const giftCardService = require('../services/giftcard');
const GiftCardPurchase = require('../models/GiftCardPurchase');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { purchaseRateLimitMiddleware } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  searchGiftCardsValidator,
  giftCardIdValidator,
  purchaseGiftCardValidator,
  purchaseIdValidator,
  updateBalanceValidator,
  categoryValidator,
  validate,
} = require('../validators');

// Get all gift cards with filters
router.get(
  '/',
  optionalAuth,
  searchGiftCardsValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await giftCardService.getGiftCards(req.query);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get featured gift cards
router.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const giftCards = await giftCardService.getFeaturedGiftCards(limit);
    res.json({
      success: true,
      data: { giftCards },
    });
  })
);

// Get popular gift cards
router.get(
  '/popular',
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const giftCards = await giftCardService.getPopularGiftCards(limit);
    res.json({
      success: true,
      data: { giftCards },
    });
  })
);

// Get categories
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await giftCardService.getCategories();
    res.json({
      success: true,
      data: { categories },
    });
  })
);

// Get gift cards by category
router.get(
  '/category/:category',
  categoryValidator,
  validate,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const giftCards = await giftCardService.getGiftCardsByCategory(req.params.category, limit);
    res.json({
      success: true,
      data: { giftCards },
    });
  })
);

// Claim a gift card using a claim code
router.post(
  '/claim',
  authenticate,
  asyncHandler(async (req, res) => {
    const { claimCode } = req.body;

    if (!claimCode || typeof claimCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Claim code is required',
      });
    }

    const normalizedCode = claimCode.trim().toUpperCase();

    // Find purchase by claim code
    const purchase = await GiftCardPurchase.findOne({ claimCode: normalizedCode })
      .populate('giftCardId', 'name brandName image category')
      .populate('buyerId', 'firstName lastName email');

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Invalid claim code',
      });
    }

    // Check if already claimed by a different user
    if (purchase.recipientId && purchase.recipientId.toString() !== req.userId.toString()) {
      return res.status(409).json({
        success: false,
        message: 'This gift card has already been claimed by another user',
      });
    }

    // Check if already fully redeemed
    if (purchase.status === 'fully_redeemed') {
      return res.status(410).json({
        success: false,
        message: 'This gift card has already been fully redeemed',
      });
    }

    // Check if cancelled or refunded
    if (['cancelled', 'refunded', 'failed'].includes(purchase.status)) {
      return res.status(410).json({
        success: false,
        message: 'This gift card is no longer valid',
      });
    }

    // Assign to the authenticated user
    purchase.recipientId = req.userId;
    await purchase.save();

    res.json({
      success: true,
      message: 'Gift card claimed successfully',
      data: {
        purchase: {
          id: purchase._id,
          amount: purchase.amount,
          status: purchase.status,
          personalMessage: purchase.personalMessage,
          giftCard: purchase.giftCardId,
          sender: purchase.buyerId,
          redemptionCodes: purchase.redemptionCodes,
          claimedAt: new Date(),
        },
      },
    });
  })
);

// Get received gift cards (must be before /:giftCardId)
router.get(
  '/received',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await giftCardService.getReceivedGiftCards(
      req.userId,
      req.user.email,
      options
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get gift card by ID
router.get(
  '/:giftCardId',
  giftCardIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const giftCard = await giftCardService.getGiftCardById(req.params.giftCardId);
    res.json({
      success: true,
      data: { giftCard },
    });
  })
);

// Purchase gift card
router.post(
  '/purchase',
  authenticate,
  purchaseRateLimitMiddleware,
  purchaseGiftCardValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await giftCardService.purchaseGiftCard(req.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Purchase initiated',
      data: result,
    });
  })
);

// Get user purchases
router.get(
  '/purchases/my',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await giftCardService.getUserPurchases(req.userId, options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get purchase by ID
router.get(
  '/purchases/:purchaseId',
  authenticate,
  purchaseIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await giftCardService.getPurchaseById(req.params.purchaseId, req.userId);
    res.json({
      success: true,
      data: { purchase },
    });
  })
);

// Update balance tracking
router.post(
  '/purchases/:purchaseId/track-balance',
  authenticate,
  updateBalanceValidator,
  validate,
  asyncHandler(async (req, res) => {
    const purchase = await giftCardService.updateBalanceTracking(
      req.params.purchaseId,
      req.body.codeIndex,
      req.body.spentAmount,
      req.body.notes,
      req.userId
    );
    res.json({
      success: true,
      message: 'Balance updated',
      data: { purchase },
    });
  })
);

// Cancel purchase
router.post(
  '/purchases/:purchaseId/cancel',
  authenticate,
  purchaseIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await giftCardService.cancelPurchase(
      req.params.purchaseId,
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
