const express = require('express');
const router = express.Router();
const transactionService = require('../services/transaction');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Get user transactions
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await transactionService.getUserTransactions(req.userId, options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get transaction summary
router.get(
  '/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const summary = await transactionService.getTransactionSummary(req.userId, period);
    res.json({
      success: true,
      data: { summary },
    });
  })
);

// Get spending analytics
router.get(
  '/analytics',
  authenticate,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const analytics = await transactionService.getSpendingAnalytics(req.userId, period);
    res.json({
      success: true,
      data: { analytics },
    });
  })
);

// Get recent activity
router.get(
  '/recent',
  authenticate,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const activity = await transactionService.getRecentActivity(req.userId, limit);
    res.json({
      success: true,
      data: { activity },
    });
  })
);

// Export transactions
router.get(
  '/export',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      format: req.query.format || 'json',
    };
    const result = await transactionService.exportTransactions(req.userId, options);

    if (result.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      return res.send(result.data);
    }

    res.json({
      success: true,
      data: result,
    });
  })
);

// Get transaction by ID
router.get(
  '/:transactionId',
  authenticate,
  asyncHandler(async (req, res) => {
    const transaction = await transactionService.getTransactionById(
      req.params.transactionId,
      req.userId
    );
    res.json({
      success: true,
      data: { transaction },
    });
  })
);

// Business transactions
router.get(
  '/business/:businessId',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await transactionService.getBusinessTransactions(
      req.params.businessId,
      req.userId,
      options
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

// Business transaction summary
router.get(
  '/business/:businessId/summary',
  authenticate,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const summary = await transactionService.getBusinessTransactionSummary(
      req.params.businessId,
      req.userId,
      period
    );
    res.json({
      success: true,
      data: { summary },
    });
  })
);

module.exports = router;
