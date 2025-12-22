const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { sendEmail } = require('../../utils/email');
const { sendPushNotification, sendMulticastPushNotification } = require('../../utils/pushNotification');

class NotificationService {
  // Get user notifications
  async getUserNotifications(userId, options = {}) {
    return Notification.getUserNotifications(userId, options);
  }

  // Get unread count
  async getUnreadCount(userId) {
    return Notification.getUnreadCount(userId);
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await notification.markAsRead();

    return { message: 'Notification marked as read' };
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    await Notification.markAllAsRead(userId);

    return { message: 'All notifications marked as read' };
  }

  // Archive notification
  async archiveNotification(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await notification.archive();

    return { message: 'Notification archived' };
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await Notification.findByIdAndDelete(notificationId);

    return { message: 'Notification deleted' };
  }

  // Create and send notification
  async createNotification(data) {
    const {
      userId,
      type,
      title,
      message,
      body,
      icon,
      image,
      actionUrl,
      actionText,
      channels = { push: true, email: false, inApp: true },
      priority = 'normal',
      referenceType,
      referenceId,
      referenceModel,
      scheduledFor,
      expiresAt,
      metadata,
    } = data;

    // Create notification record
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      body,
      icon,
      image,
      actionUrl,
      actionText,
      channels,
      priority,
      referenceType,
      referenceId,
      referenceModel,
      scheduledFor,
      expiresAt,
      data: metadata ? new Map(Object.entries(metadata)) : undefined,
    });

    // Send immediately if not scheduled
    if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
      await this.sendNotification(notification);
    }

    return notification;
  }

  // Send notification through channels
  async sendNotification(notification) {
    const user = await User.findById(notification.userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const results = {};

    // Send push notification
    if (notification.channels.push && user.deviceTokens?.length > 0) {
      const tokens = user.deviceTokens.map((dt) => dt.token);

      if (tokens.length === 1) {
        const result = await sendPushNotification(tokens[0], {
          title: notification.title,
          body: notification.message,
          imageUrl: notification.image,
        }, {
          notificationId: notification._id.toString(),
          type: notification.type,
          actionUrl: notification.actionUrl || '',
        });

        results.push = result;

        // Remove invalid tokens
        if (result.invalidToken) {
          await User.findByIdAndUpdate(user._id, {
            $pull: { deviceTokens: { token: tokens[0] } },
          });
        }
      } else {
        const result = await sendMulticastPushNotification(tokens, {
          title: notification.title,
          body: notification.message,
          imageUrl: notification.image,
        }, {
          notificationId: notification._id.toString(),
          type: notification.type,
          actionUrl: notification.actionUrl || '',
        });

        results.push = result;

        // Remove invalid tokens
        if (result.invalidTokens?.length > 0) {
          await User.findByIdAndUpdate(user._id, {
            $pull: { deviceTokens: { token: { $in: result.invalidTokens } } },
          });
        }
      }

      await notification.updateDeliveryStatus('push', {
        sent: results.push?.success,
        error: results.push?.error,
      });
    }

    // Send email
    if (notification.channels.email) {
      try {
        const emailResult = await sendEmail(user.email, 'campaignNotification', {
          subject: notification.title,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
          actionText: notification.actionText,
        });

        results.email = emailResult;

        await notification.updateDeliveryStatus('email', {
          sent: emailResult.success,
          error: emailResult.error,
        });
      } catch (error) {
        results.email = { success: false, error: error.message };
      }
    }

    return results;
  }

  // Send notification to multiple users
  async sendBulkNotification(userIds, notificationData) {
    const results = [];

    for (const userId of userIds) {
      try {
        const notification = await this.createNotification({
          ...notificationData,
          userId,
        });
        results.push({ userId, status: 'success', notificationId: notification._id });
      } catch (error) {
        results.push({ userId, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  // Process scheduled notifications (called by cron job)
  async processScheduledNotifications() {
    const notifications = await Notification.getScheduledNotifications();
    const results = [];

    for (const notification of notifications) {
      try {
        await this.sendNotification(notification);
        results.push({ notificationId: notification._id, status: 'sent' });
      } catch (error) {
        results.push({ notificationId: notification._id, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  // Cleanup old notifications (called by cron job)
  async cleanupOldNotifications(daysOld = 90) {
    const result = await Notification.cleanupOldNotifications(daysOld);
    return { deletedCount: result.deletedCount };
  }

  // Create gift received notification
  async notifyGiftReceived(data) {
    return Notification.createGiftReceivedNotification(data);
  }

  // Create subscription reminder
  async notifySubscriptionReminder(data) {
    return Notification.createSubscriptionReminder(data);
  }

  // Notify payment success
  async notifyPaymentSuccess(userId, amount) {
    return this.createNotification({
      userId,
      type: 'payment_success',
      title: 'Payment Successful',
      message: `Your payment of $${amount} has been processed successfully.`,
      channels: { push: true, email: true, inApp: true },
      priority: 'normal',
    });
  }

  // Notify payment failure
  async notifyPaymentFailed(userId, amount, reason) {
    return this.createNotification({
      userId,
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Your payment of $${amount} could not be processed. ${reason}`,
      channels: { push: true, email: true, inApp: true },
      priority: 'high',
      actionUrl: `${process.env.FRONTEND_URL}/settings/payment-methods`,
      actionText: 'Update Payment Method',
    });
  }

  // Notify security alert
  async notifySecurityAlert(userId, message) {
    return this.createNotification({
      userId,
      type: 'security_alert',
      title: 'Security Alert',
      message,
      channels: { push: true, email: true, inApp: true },
      priority: 'urgent',
    });
  }
}

module.exports = new NotificationService();
