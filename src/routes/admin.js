const express = require('express');
const router = express.Router();
const adminService = require('../services/admin');
const { authenticate, isAdmin, isSuperAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

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

module.exports = router;
