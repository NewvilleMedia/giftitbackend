const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    // User information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Subscription name/label
    name: {
      type: String,
      required: [true, 'Subscription name is required'],
      trim: true,
      maxlength: 100,
    },

    // Gift card configuration
    giftCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftCard',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least $1'],
    },
    currency: {
      type: String,
      default: 'USD',
    },

    // Recipient configuration
    recipientType: {
      type: String,
      enum: ['self', 'other'],
      default: 'self',
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipientEmail: String,
    recipientPhone: String,
    recipientName: String,
    personalMessage: {
      type: String,
      maxlength: 500,
    },

    // Frequency configuration
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'],
      required: true,
      default: 'monthly',
    },
    dayOfMonth: {
      type: Number,
      min: 1,
      max: 28, // Avoid edge cases with 29, 30, 31
      default: 1,
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6, // 0 = Sunday, 6 = Saturday
      default: 1, // Monday
    },

    // Schedule tracking
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
    },
    lastDeliveryDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null, // null means no end date
    },

    // Delivery count
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    maxDeliveries: {
      type: Number,
      default: null, // null means unlimited
    },

    // Payment configuration
    paymentMethodId: {
      type: String,
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'paused', 'cancelled', 'completed', 'failed'],
      default: 'active',
    },
    pausedAt: Date,
    pausedUntil: Date,
    cancelledAt: Date,
    cancellationReason: String,

    // Failure tracking
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    lastFailureReason: String,
    lastFailureDate: Date,

    // Delivery history
    deliveryHistory: [{
      purchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GiftCardPurchase',
      },
      deliveredAt: Date,
      amount: Number,
      status: {
        type: String,
        enum: ['success', 'failed', 'pending'],
      },
      failureReason: String,
    }],

    // Notifications
    notifyBeforeDelivery: {
      type: Boolean,
      default: true,
    },
    notifyDaysBefore: {
      type: Number,
      default: 1,
    },
    lastNotificationSent: Date,

    // Metadata
    notes: String,
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
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ nextDeliveryDate: 1 });
subscriptionSchema.index({ giftCardId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

// Virtual for checking if subscription is due
subscriptionSchema.virtual('isDue').get(function () {
  if (this.status !== 'active') return false;
  return this.nextDeliveryDate <= new Date();
});

// Virtual for days until next delivery
subscriptionSchema.virtual('daysUntilNextDelivery').get(function () {
  if (!this.nextDeliveryDate) return null;
  const diff = this.nextDeliveryDate - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Pre-save to calculate next delivery date
subscriptionSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('frequency') || this.isModified('startDate')) {
    this.nextDeliveryDate = this.calculateNextDeliveryDate();
  }
  next();
});

// Method to calculate next delivery date
subscriptionSchema.methods.calculateNextDeliveryDate = function (fromDate = null) {
  const baseDate = fromDate || this.lastDeliveryDate || this.startDate || new Date();
  const date = new Date(baseDate);

  switch (this.frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      date.setDate(Math.min(this.dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      date.setDate(Math.min(this.dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
      break;
    case 'annually':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date;
};

// Method to record a delivery
subscriptionSchema.methods.recordDelivery = async function (purchaseId, status = 'success', failureReason = null) {
  const delivery = {
    purchaseId,
    deliveredAt: new Date(),
    amount: this.amount,
    status,
    failureReason,
  };

  this.deliveryHistory.push(delivery);
  this.totalDeliveries += 1;

  if (status === 'success') {
    this.lastDeliveryDate = new Date();
    this.nextDeliveryDate = this.calculateNextDeliveryDate();
    this.consecutiveFailures = 0;
    this.lastFailureReason = null;
  } else {
    this.consecutiveFailures += 1;
    this.lastFailureReason = failureReason;
    this.lastFailureDate = new Date();

    // Auto-pause after 3 consecutive failures
    if (this.consecutiveFailures >= 3) {
      this.status = 'failed';
    }
  }

  // Check if max deliveries reached
  if (this.maxDeliveries && this.totalDeliveries >= this.maxDeliveries) {
    this.status = 'completed';
  }

  // Check if end date reached
  if (this.endDate && new Date() >= this.endDate) {
    this.status = 'completed';
  }

  return this.save();
};

// Method to pause subscription
subscriptionSchema.methods.pause = async function (until = null) {
  this.status = 'paused';
  this.pausedAt = new Date();
  this.pausedUntil = until;
  return this.save();
};

// Method to resume subscription
subscriptionSchema.methods.resume = async function () {
  if (this.status !== 'paused') {
    throw new Error('Subscription is not paused');
  }
  this.status = 'active';
  this.pausedAt = null;
  this.pausedUntil = null;
  // Recalculate next delivery date from now
  this.nextDeliveryDate = this.calculateNextDeliveryDate(new Date());
  return this.save();
};

// Method to cancel subscription
subscriptionSchema.methods.cancel = async function (reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Method to update recipient
subscriptionSchema.methods.updateRecipient = async function (recipientData) {
  Object.assign(this, {
    recipientType: recipientData.recipientType || this.recipientType,
    recipientId: recipientData.recipientId || this.recipientId,
    recipientEmail: recipientData.recipientEmail || this.recipientEmail,
    recipientPhone: recipientData.recipientPhone || this.recipientPhone,
    recipientName: recipientData.recipientName || this.recipientName,
    personalMessage: recipientData.personalMessage || this.personalMessage,
  });
  return this.save();
};

// Static method to get due subscriptions
subscriptionSchema.statics.getDueSubscriptions = async function () {
  return this.find({
    status: 'active',
    nextDeliveryDate: { $lte: new Date() },
  }).populate('userId giftCardId');
};

// Static method to get subscriptions needing notification
subscriptionSchema.statics.getSubscriptionsNeedingNotification = async function () {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1); // Check for subscriptions due tomorrow

  return this.find({
    status: 'active',
    notifyBeforeDelivery: true,
    nextDeliveryDate: {
      $gte: new Date(),
      $lte: targetDate,
    },
    $or: [
      { lastNotificationSent: { $exists: false } },
      { lastNotificationSent: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    ],
  }).populate('userId giftCardId');
};

// Static method to get user subscriptions
subscriptionSchema.statics.getUserSubscriptions = async function (userId, options = {}) {
  const { status, page = 1, limit = 20 } = options;

  const filter = { userId };
  if (status) {
    filter.status = status;
  }

  const subscriptions = await this.find(filter)
    .populate('giftCardId', 'name brandName image category')
    .sort({ nextDeliveryDate: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    subscriptions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription;
