const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Notification type
    type: {
      type: String,
      enum: [
        'gift_received',
        'gift_sent',
        'gift_delivered',
        'gift_redeemed',
        'subscription_reminder',
        'subscription_processed',
        'subscription_failed',
        'campaign_started',
        'campaign_completed',
        'payment_success',
        'payment_failed',
        'account_update',
        'security_alert',
        'promotion',
        'system',
      ],
      required: true,
    },

    // Content
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    body: {
      type: String,
      maxlength: 2000,
    },

    // Visual
    icon: String,
    image: String,
    color: String,

    // Action
    actionUrl: String,
    actionText: String,
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Delivery channels
    channels: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      inApp: { type: Boolean, default: true },
    },

    // Delivery status per channel
    deliveryStatus: {
      push: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        error: String,
      },
      email: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        error: String,
      },
      sms: {
        sent: { type: Boolean, default: false },
        sentAt: Date,
        error: String,
      },
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,

    // Archive/Delete
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: Date,

    // Priority
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Scheduling
    scheduledFor: Date,
    expiresAt: Date,

    // References
    referenceType: {
      type: String,
      enum: ['purchase', 'subscription', 'campaign', 'transaction', 'user', 'business'],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      enum: ['GiftCardPurchase', 'Subscription', 'Campaign', 'Transaction', 'User', 'Business'],
    },

    // Metadata
    metadata: {
      type: Map,
      of: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
notificationSchema.index({ userId: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ isArchived: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, isArchived: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ expiresAt: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = async function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return this;
};

// Method to archive
notificationSchema.methods.archive = async function () {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Method to update delivery status
notificationSchema.methods.updateDeliveryStatus = async function (channel, status) {
  if (this.deliveryStatus[channel]) {
    this.deliveryStatus[channel].sent = status.sent;
    this.deliveryStatus[channel].sentAt = status.sent ? new Date() : null;
    this.deliveryStatus[channel].error = status.error || null;
  }
  return this.save();
};

// Static method to create gift received notification
notificationSchema.statics.createGiftReceivedNotification = async function (data) {
  return this.create({
    userId: data.recipientId,
    type: 'gift_received',
    title: 'You received a gift card!',
    message: `${data.senderName} sent you a ${data.giftCardName} gift card worth $${data.amount}.`,
    body: data.personalMessage || null,
    channels: { push: true, email: true, inApp: true },
    priority: 'high',
    actionUrl: `/gift-cards/received/${data.purchaseId}`,
    actionText: 'View Gift Card',
    referenceType: 'purchase',
    referenceId: data.purchaseId,
    referenceModel: 'GiftCardPurchase',
    data: new Map([
      ['purchaseId', data.purchaseId.toString()],
      ['amount', data.amount.toString()],
      ['giftCardName', data.giftCardName],
    ]),
  });
};

// Static method to create subscription reminder
notificationSchema.statics.createSubscriptionReminder = async function (data) {
  return this.create({
    userId: data.userId,
    type: 'subscription_reminder',
    title: 'Upcoming subscription delivery',
    message: `Your ${data.subscriptionName} gift card ($${data.amount}) will be delivered tomorrow.`,
    channels: { push: true, email: true, inApp: true },
    priority: 'normal',
    actionUrl: `/subscriptions/${data.subscriptionId}`,
    actionText: 'View Subscription',
    referenceType: 'subscription',
    referenceId: data.subscriptionId,
    referenceModel: 'Subscription',
  });
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = async function (userId, options = {}) {
  const { type, isRead, page = 1, limit = 20, includeArchived = false } = options;

  const filter = { userId };

  if (type) filter.type = type;
  if (isRead !== undefined) filter.isRead = isRead;
  if (!includeArchived) filter.isArchived = false;

  // Exclude expired notifications
  filter.$or = [
    { expiresAt: { $exists: false } },
    { expiresAt: null },
    { expiresAt: { $gt: new Date() } },
  ];

  const notifications = await this.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);
  const unreadCount = await this.countDocuments({ ...filter, isRead: false });

  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    userId,
    isRead: false,
    isArchived: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
};

// Static method to delete old notifications
notificationSchema.statics.cleanupOldNotifications = async function (daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isArchived: true,
  });
};

// Static method to get scheduled notifications
notificationSchema.statics.getScheduledNotifications = async function () {
  return this.find({
    scheduledFor: { $lte: new Date() },
    'deliveryStatus.push.sent': false,
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
