const express = require('express');
const router = express.Router();
const notificationService = require('../services/notification');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Get user notifications
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const options = {
      type: req.query.type,
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      includeArchived: req.query.includeArchived === 'true',
    };
    const result = await notificationService.getUserNotifications(req.userId, options);
    res.json({
      success: true,
      data: result,
    });
  })
);

// Get unread count
router.get(
  '/unread-count',
  authenticate,
  asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.userId);
    res.json({
      success: true,
      data: { unreadCount: count },
    });
  })
);

// Mark notification as read
router.post(
  '/:notificationId/read',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await notificationService.markAsRead(
      req.params.notificationId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Mark all as read
router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.userId);
    res.json({
      success: true,
      ...result,
    });
  })
);

// Archive notification
router.post(
  '/:notificationId/archive',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await notificationService.archiveNotification(
      req.params.notificationId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Delete notification
router.delete(
  '/:notificationId',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await notificationService.deleteNotification(
      req.params.notificationId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

module.exports = router;
