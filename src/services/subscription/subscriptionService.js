const Subscription = require('../../models/Subscription');
const GiftCard = require('../../models/GiftCard');
const User = require('../../models/User');
const giftCardService = require('../giftcard');
const { sendEmail } = require('../../utils/email');
const { sendPushNotification, notificationTemplates } = require('../../utils/pushNotification');

class SubscriptionService {
  // Create subscription
  async createSubscription(userId, subscriptionData) {
    const {
      name,
      giftCardId,
      amount,
      frequency,
      recipientType = 'self',
      recipientEmail,
      recipientName,
      recipientPhone,
      personalMessage,
      startDate,
      endDate,
      dayOfMonth,
      dayOfWeek,
      maxDeliveries,
      paymentMethodId,
      notifyBeforeDelivery = true,
    } = subscriptionData;

    // Validate gift card
    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    // Validate amount
    if (giftCard.priceType === 'fixed' && !giftCard.fixedAmounts.includes(amount)) {
      throw new Error('Invalid amount for this gift card');
    }
    if (giftCard.priceType === 'variable') {
      if (amount < giftCard.minAmount || amount > giftCard.maxAmount) {
        throw new Error(`Amount must be between $${giftCard.minAmount} and $${giftCard.maxAmount}`);
      }
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Determine recipient
    let recipientId = null;
    if (recipientType === 'other' && recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail });
      if (recipient) {
        recipientId = recipient._id;
      }
    }

    // Calculate first delivery date
    const start = startDate ? new Date(startDate) : new Date();

    // Create subscription
    const subscription = await Subscription.create({
      userId,
      name,
      giftCardId,
      amount,
      currency: giftCard.currency,
      frequency,
      recipientType,
      recipientId,
      recipientEmail: recipientType === 'other' ? recipientEmail : user.email,
      recipientName: recipientType === 'other' ? recipientName : user.fullName,
      recipientPhone: recipientType === 'other' ? recipientPhone : user.phone,
      personalMessage,
      startDate: start,
      endDate: endDate ? new Date(endDate) : null,
      dayOfMonth: dayOfMonth || 1,
      dayOfWeek: dayOfWeek || 1,
      maxDeliveries,
      paymentMethodId,
      notifyBeforeDelivery,
      status: 'active',
    });

    return subscription;
  }

  // Get user subscriptions
  async getUserSubscriptions(userId, options = {}) {
    return Subscription.getUserSubscriptions(userId, options);
  }

  // Get subscription by ID
  async getSubscriptionById(subscriptionId, userId) {
    const subscription = await Subscription.findById(subscriptionId)
      .populate('giftCardId', 'name brandName image category');

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    return subscription;
  }

  // Update subscription
  async updateSubscription(subscriptionId, userId, updateData) {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    if (subscription.status === 'cancelled' || subscription.status === 'completed') {
      throw new Error('Cannot update cancelled or completed subscription');
    }

    const allowedFields = [
      'name',
      'amount',
      'frequency',
      'recipientType',
      'recipientEmail',
      'recipientName',
      'recipientPhone',
      'personalMessage',
      'dayOfMonth',
      'dayOfWeek',
      'paymentMethodId',
      'notifyBeforeDelivery',
      'endDate',
      'maxDeliveries',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        subscription[field] = updateData[field];
      }
    }

    // Recalculate next delivery if frequency changed
    if (updateData.frequency) {
      subscription.nextDeliveryDate = subscription.calculateNextDeliveryDate();
    }

    await subscription.save();

    return subscription;
  }

  // Pause subscription
  async pauseSubscription(subscriptionId, userId, until = null) {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await subscription.pause(until);

    return { message: 'Subscription paused' };
  }

  // Resume subscription
  async resumeSubscription(subscriptionId, userId) {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await subscription.resume();

    return { message: 'Subscription resumed' };
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId, userId, reason = '') {
    const subscription = await Subscription.findById(subscriptionId);

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await subscription.cancel(reason);

    return { message: 'Subscription cancelled' };
  }

  // Process due subscriptions (called by cron job)
  async processDueSubscriptions() {
    const dueSubscriptions = await Subscription.getDueSubscriptions();
    const results = [];

    for (const subscription of dueSubscriptions) {
      try {
        // Purchase gift card
        const purchaseData = {
          giftCardId: subscription.giftCardId._id,
          amount: subscription.amount,
          recipientType: subscription.recipientType === 'self' ? 'self' : 'gift',
          recipientEmail: subscription.recipientEmail,
          recipientName: subscription.recipientName,
          recipientPhone: subscription.recipientPhone,
          personalMessage: subscription.personalMessage,
          deliveryMethod: 'email',
          paymentMethodId: subscription.paymentMethodId,
        };

        const purchase = await giftCardService.purchaseGiftCard(
          subscription.userId._id,
          purchaseData
        );

        // Record successful delivery
        await subscription.recordDelivery(purchase.purchase.id, 'success');

        results.push({
          subscriptionId: subscription._id,
          status: 'success',
          purchaseId: purchase.purchase.id,
        });

        // Notify user
        const user = subscription.userId;
        if (user.deviceTokens && user.deviceTokens.length > 0) {
          const notification = notificationTemplates.subscriptionProcessed({
            giftCardName: subscription.giftCardId.name,
            amount: subscription.amount,
          });

          for (const deviceToken of user.deviceTokens) {
            await sendPushNotification(deviceToken.token, notification);
          }
        }
      } catch (error) {
        // Record failed delivery
        await subscription.recordDelivery(null, 'failed', error.message);

        results.push({
          subscriptionId: subscription._id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  // Send subscription reminders (called by cron job)
  async sendSubscriptionReminders() {
    const subscriptions = await Subscription.getSubscriptionsNeedingNotification();
    const results = [];

    for (const subscription of subscriptions) {
      try {
        const user = subscription.userId;

        // Send email reminder
        await sendEmail(user.email, 'subscriptionReminder', {
          firstName: user.firstName,
          giftCardName: subscription.giftCardId.name,
          amount: subscription.amount,
          recipientName: subscription.recipientName,
          manageUrl: `${process.env.FRONTEND_URL}/subscriptions/${subscription._id}`,
        });

        // Send push notification
        if (user.deviceTokens && user.deviceTokens.length > 0) {
          const notification = notificationTemplates.subscriptionReminder({
            giftCardName: subscription.giftCardId.name,
            amount: subscription.amount,
          });

          for (const deviceToken of user.deviceTokens) {
            await sendPushNotification(deviceToken.token, notification);
          }
        }

        // Update last notification sent
        subscription.lastNotificationSent = new Date();
        await subscription.save();

        results.push({
          subscriptionId: subscription._id,
          status: 'sent',
        });
      } catch (error) {
        results.push({
          subscriptionId: subscription._id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  // Get subscription statistics
  async getSubscriptionStats(userId) {
    const stats = await Subscription.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    return stats.reduce((acc, stat) => {
      acc[stat._id] = { count: stat.count, totalAmount: stat.totalAmount };
      return acc;
    }, {});
  }
}

module.exports = new SubscriptionService();
