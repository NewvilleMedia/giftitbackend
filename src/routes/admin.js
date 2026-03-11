const express = require('express');
const router = express.Router();
const adminService = require('../services/admin');
const { authenticate, isAdmin, isSuperAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { body, param, query } = require('express-validator');
const { validate } = require('../validators');

// Dashboard statistics
router.get(
  '/dashboard',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const stats = await adminService.getDashboardStats();
    res.json({
      success: true,
      data: { stats },
    });
  })
);

// User management
router.get(
  '/users',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const options = {
      search: req.query.search,
      role: req.query.role,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await adminService.getUsers(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

router.get(
  '/users/:userId',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const user = await adminService.getUserById(req.params.userId);
    res.json({
      success: true,
      data: { user },
    });
  })
);

router.put(
  '/users/:userId',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const user = await adminService.updateUser(req.params.userId, req.body);
    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user },
    });
  })
);

router.delete(
  '/users/:userId',
  authenticate,
  isSuperAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.deleteUser(req.params.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Business management
router.get(
  '/businesses',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const options = {
      search: req.query.search,
      industry: req.query.industry,
      verified: req.query.verified === 'true' ? true : req.query.verified === 'false' ? false : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await adminService.getBusinesses(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/businesses/:businessId/verify',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const business = await adminService.verifyBusiness(req.params.businessId);
    res.json({
      success: true,
      message: 'Business verified successfully',
      data: { business },
    });
  })
);

// Gift card management
router.get(
  '/gift-cards',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const options = {
      search: req.query.search,
      category: req.query.category,
      provider: req.query.provider,
      active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await adminService.getGiftCards(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

router.put(
  '/gift-cards/:giftCardId',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const giftCard = await adminService.updateGiftCard(req.params.giftCardId, req.body);
    res.json({
      success: true,
      message: 'Gift card updated successfully',
      data: { giftCard },
    });
  })
);

router.post(
  '/gift-cards/sync',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.syncGiftCards();
    res.json({
      success: true,
      ...result,
    });
  })
);

// Transaction management
router.get(
  '/transactions',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const options = {
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await adminService.getTransactions(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Campaign management
router.get(
  '/campaigns',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      type: req.query.type,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await adminService.getCampaigns(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Reports
router.get(
  '/reports/revenue',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const report = await adminService.getRevenueReport(period);
    res.json({
      success: true,
      data: { report },
    });
  })
);

router.get(
  '/reports/user-growth',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const report = await adminService.getUserGrowthReport(period);
    res.json({
      success: true,
      data: { report },
    });
  })
);

router.get(
  '/reports/gift-cards',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const report = await adminService.getGiftCardReport();
    res.json({
      success: true,
      data: { report },
    });
  })
);

// ==================== USER BAN/UNBAN ====================

router.post(
  '/users/:userId/ban',
  authenticate,
  isAdmin,
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.banUser(
      req.params.userId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

router.post(
  '/users/:userId/unban',
  authenticate,
  isAdmin,
  [param('userId').isMongoId().withMessage('Invalid user ID')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.unbanUser(req.params.userId, req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== BUSINESS SUSPEND/UNSUSPEND ====================

router.post(
  '/businesses/:businessId/suspend',
  authenticate,
  isAdmin,
  [
    param('businessId').isMongoId().withMessage('Invalid business ID'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.suspendBusiness(
      req.params.businessId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

router.post(
  '/businesses/:businessId/unsuspend',
  authenticate,
  isAdmin,
  [param('businessId').isMongoId().withMessage('Invalid business ID')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.unsuspendBusiness(
      req.params.businessId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== TRANSACTION REFUND ====================

router.post(
  '/transactions/:transactionId/refund',
  authenticate,
  isAdmin,
  [
    param('transactionId').isMongoId().withMessage('Invalid transaction ID'),
    body('reason').optional().isString().trim(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.refundTransaction(
      req.params.transactionId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== SYSTEM SETTINGS ====================

router.get(
  '/settings',
  authenticate,
  isAdmin,
  asyncHandler(async (req, res) => {
    const category = req.query.category;
    const settings = await adminService.getSettings(category);
    res.json({
      success: true,
      data: { settings },
    });
  })
);

router.put(
  '/settings',
  authenticate,
  isSuperAdmin,
  [body('settings').isObject().withMessage('Settings must be an object')],
  validate,
  asyncHandler(async (req, res) => {
    const settings = await adminService.updateSettings(req.body.settings, req.userId);
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings },
    });
  })
);

router.post(
  '/settings/initialize',
  authenticate,
  isSuperAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.initializeSettings();
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== AUDIT LOGS ====================

router.get(
  '/audit-logs',
  authenticate,
  isAdmin,
  [
    query('userId').optional().isMongoId(),
    query('action').optional().isString(),
    query('resourceType').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      userId: req.query.userId,
      action: req.query.action,
      resourceType: req.query.resourceType,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50,
    };
    const result = await adminService.getAuditLogs(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// ==================== BROADCAST NOTIFICATIONS ====================

router.post(
  '/notifications/broadcast',
  authenticate,
  isAdmin,
  [
    body('title').notEmpty().withMessage('Title is required').trim(),
    body('message').notEmpty().withMessage('Message is required').trim(),
    body('targetAudience')
      .optional()
      .isIn(['all', 'users', 'business', 'verified'])
      .withMessage('Invalid target audience'),
    body('channels')
      .optional()
      .isArray()
      .withMessage('Channels must be an array'),
    body('scheduledFor').optional().isISO8601().withMessage('Invalid date format'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.broadcastNotification(req.userId, req.body);
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== PROMO CODES ====================

router.get(
  '/promo-codes',
  authenticate,
  isAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('includeExpired').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      includeExpired: req.query.includeExpired === 'true',
    };
    const result = await adminService.getPromoCodes(options);
    res.json({
      success: true,
      data: result,
    });
  })
);

router.get(
  '/promo-codes/:promoCodeId',
  authenticate,
  isAdmin,
  [param('promoCodeId').isMongoId().withMessage('Invalid promo code ID')],
  validate,
  asyncHandler(async (req, res) => {
    const promoCode = await adminService.getPromoCodeById(req.params.promoCodeId);
    res.json({
      success: true,
      data: { promoCode },
    });
  })
);

router.post(
  '/promo-codes',
  authenticate,
  isAdmin,
  [
    body('code')
      .notEmpty()
      .withMessage('Code is required')
      .isLength({ min: 3, max: 20 })
      .withMessage('Code must be 3-20 characters')
      .trim(),
    body('name').notEmpty().withMessage('Name is required').trim(),
    body('description').optional().trim(),
    body('discountType')
      .isIn(['percentage', 'fixed', 'free_delivery'])
      .withMessage('Invalid discount type'),
    body('discountValue')
      .isFloat({ min: 0 })
      .withMessage('Discount value must be a positive number'),
    body('maxDiscountAmount').optional().isFloat({ min: 0 }),
    body('usageLimit').optional().isInt({ min: 1 }),
    body('perUserLimit').optional().isInt({ min: 1 }),
    body('minimumPurchaseAmount').optional().isFloat({ min: 0 }),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('applicableCategories').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const promoCode = await adminService.createPromoCode(req.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Promo code created successfully',
      data: { promoCode },
    });
  })
);

router.put(
  '/promo-codes/:promoCodeId',
  authenticate,
  isAdmin,
  [
    param('promoCodeId').isMongoId().withMessage('Invalid promo code ID'),
    body('name').optional().trim(),
    body('description').optional().trim(),
    body('discountType').optional().isIn(['percentage', 'fixed', 'free_delivery']),
    body('discountValue').optional().isFloat({ min: 0 }),
    body('maxDiscountAmount').optional().isFloat({ min: 0 }),
    body('usageLimit').optional().isInt({ min: 1 }),
    body('perUserLimit').optional().isInt({ min: 1 }),
    body('minimumPurchaseAmount').optional().isFloat({ min: 0 }),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('applicableCategories').optional().isArray(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const promoCode = await adminService.updatePromoCode(
      req.params.promoCodeId,
      req.userId,
      req.body
    );
    res.json({
      success: true,
      message: 'Promo code updated successfully',
      data: { promoCode },
    });
  })
);

router.delete(
  '/promo-codes/:promoCodeId',
  authenticate,
  isAdmin,
  [param('promoCodeId').isMongoId().withMessage('Invalid promo code ID')],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.deletePromoCode(
      req.params.promoCodeId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

router.post(
  '/promo-codes/validate',
  authenticate,
  isAdmin,
  [
    body('code').notEmpty().withMessage('Code is required').trim(),
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('purchaseAmount').isFloat({ min: 0 }).withMessage('Invalid purchase amount'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const result = await adminService.validatePromoCode(
      req.body.code,
      req.body.userId,
      req.body.purchaseAmount
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

module.exports = router;
