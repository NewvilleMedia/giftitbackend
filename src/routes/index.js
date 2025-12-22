const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const userRoutes = require('./user');
const giftCardRoutes = require('./giftcard');
const subscriptionRoutes = require('./subscription');
const businessRoutes = require('./business');
const campaignRoutes = require('./campaign');
const transactionRoutes = require('./transaction');
const notificationRoutes = require('./notification');
const adminRoutes = require('./admin');
const webhookRoutes = require('./webhook');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'GiftIt API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/gift-cards', giftCardRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/businesses', businessRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
