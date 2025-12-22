const cron = require('node-cron');
const subscriptionService = require('../services/subscription');
const campaignService = require('../services/campaign');
const notificationService = require('../services/notification');
const giftCardService = require('../services/giftcard');
const GiftCardPurchase = require('../models/GiftCardPurchase');

// Process due subscriptions - runs every hour
const processSubscriptions = cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Processing due subscriptions...');
  try {
    const results = await subscriptionService.processDueSubscriptions();
    console.log('[CRON] Subscription processing complete:', results.length, 'processed');
  } catch (error) {
    console.error('[CRON] Subscription processing error:', error);
  }
}, { scheduled: false });

// Send subscription reminders - runs daily at 9 AM
const sendSubscriptionReminders = cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Sending subscription reminders...');
  try {
    const results = await subscriptionService.sendSubscriptionReminders();
    console.log('[CRON] Subscription reminders sent:', results.length);
  } catch (error) {
    console.error('[CRON] Subscription reminder error:', error);
  }
}, { scheduled: false });

// Process scheduled campaigns - runs every 15 minutes
const processCampaigns = cron.schedule('*/15 * * * *', async () => {
  console.log('[CRON] Processing scheduled campaigns...');
  try {
    const results = await campaignService.processScheduledCampaigns();
    console.log('[CRON] Campaign processing complete:', results.length, 'processed');
  } catch (error) {
    console.error('[CRON] Campaign processing error:', error);
  }
}, { scheduled: false });

// Process scheduled deliveries - runs every 30 minutes
const processDeliveries = cron.schedule('*/30 * * * *', async () => {
  console.log('[CRON] Processing scheduled deliveries...');
  try {
    const pendingDeliveries = await GiftCardPurchase.getPendingDeliveries();

    for (const purchase of pendingDeliveries) {
      try {
        await giftCardService.deliverGiftCard(purchase);
      } catch (error) {
        console.error(`[CRON] Delivery error for purchase ${purchase._id}:`, error);
      }
    }

    console.log('[CRON] Deliveries processed:', pendingDeliveries.length);
  } catch (error) {
    console.error('[CRON] Delivery processing error:', error);
  }
}, { scheduled: false });

// Send scheduled notifications - runs every 5 minutes
const processNotifications = cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] Processing scheduled notifications...');
  try {
    const results = await notificationService.processScheduledNotifications();
    console.log('[CRON] Notifications processed:', results.length);
  } catch (error) {
    console.error('[CRON] Notification processing error:', error);
  }
}, { scheduled: false });

// Cleanup old notifications - runs daily at midnight
const cleanupNotifications = cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Cleaning up old notifications...');
  try {
    const result = await notificationService.cleanupOldNotifications(90);
    console.log('[CRON] Notifications cleaned up:', result.deletedCount);
  } catch (error) {
    console.error('[CRON] Notification cleanup error:', error);
  }
}, { scheduled: false });

// Sync gift cards from providers - runs daily at 3 AM
const syncGiftCards = cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Syncing gift cards from providers...');
  try {
    const result = await giftCardService.syncGiftCardsFromRuna();
    console.log('[CRON] Gift card sync complete:', result.message);
  } catch (error) {
    console.error('[CRON] Gift card sync error:', error);
  }
}, { scheduled: false });

// Start all scheduled jobs
const startScheduler = () => {
  console.log('[SCHEDULER] Starting cron jobs...');

  processSubscriptions.start();
  sendSubscriptionReminders.start();
  processCampaigns.start();
  processDeliveries.start();
  processNotifications.start();
  cleanupNotifications.start();
  syncGiftCards.start();

  console.log('[SCHEDULER] All cron jobs started');
};

// Stop all scheduled jobs
const stopScheduler = () => {
  console.log('[SCHEDULER] Stopping cron jobs...');

  processSubscriptions.stop();
  sendSubscriptionReminders.stop();
  processCampaigns.stop();
  processDeliveries.stop();
  processNotifications.stop();
  cleanupNotifications.stop();
  syncGiftCards.stop();

  console.log('[SCHEDULER] All cron jobs stopped');
};

module.exports = {
  startScheduler,
  stopScheduler,
};
