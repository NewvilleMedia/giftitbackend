const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    // User/Business reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },

    // Transaction type
    type: {
      type: String,
      enum: [
        'purchase',           // Gift card purchase
        'subscription',       // Subscription payment
        'refund',            // Refund
        'wallet_credit',     // Adding funds to wallet
        'wallet_debit',      // Using wallet funds
        'transfer',          // Transfer between users
        'campaign_spend',    // Business campaign spending
        'payout',           // Payout to bank
        'fee',              // Platform fees
        'adjustment',       // Manual adjustments
      ],
      required: true,
    },

    // Financial details
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    fee: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
    },

    // Payment provider details
    paymentProvider: {
      type: String,
      enum: ['stripe', 'paypal', 'wallet', 'bank', 'manual'],
      default: 'stripe',
    },
    paymentIntentId: String,
    paymentMethodId: String,
    chargeId: String,
    refundId: String,

    // Related documents
    purchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftCardPurchase',
      default: null,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },

    // Description
    description: {
      type: String,
      required: true,
    },

    // Balance tracking (for wallet transactions)
    balanceBefore: {
      type: Number,
      default: null,
    },
    balanceAfter: {
      type: Number,
      default: null,
    },

    // Metadata
    metadata: {
      type: Map,
      of: String,
    },

    // Failure details
    failureReason: String,
    failureCode: String,

    // IP and device info for security
    ipAddress: String,
    userAgent: String,
    deviceId: String,

    // Processing timestamps
    processedAt: Date,
    completedAt: Date,
    failedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
transactionSchema.index({ userId: 1 });
transactionSchema.index({ businessId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ paymentIntentId: 1 });
transactionSchema.index({ purchaseId: 1 });
transactionSchema.index({ subscriptionId: 1 });
transactionSchema.index({ campaignId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ businessId: 1, createdAt: -1 });

// Pre-save to calculate net amount
transactionSchema.pre('save', function (next) {
  if (this.isModified('amount') || this.isModified('fee')) {
    this.netAmount = this.amount - this.fee;
  }
  next();
});

// Method to complete transaction
transactionSchema.methods.complete = async function () {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to fail transaction
transactionSchema.methods.fail = async function (reason, code = null) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  this.failureCode = code;
  return this.save();
};

// Method to refund transaction
transactionSchema.methods.refund = async function (refundId) {
  this.status = 'refunded';
  this.refundId = refundId;
  return this.save();
};

// Static method to create purchase transaction
transactionSchema.statics.createPurchaseTransaction = async function (data) {
  return this.create({
    userId: data.userId,
    businessId: data.businessId || null,
    type: 'purchase',
    amount: data.amount,
    fee: data.fee || 0,
    netAmount: data.amount - (data.fee || 0),
    status: data.status || 'pending',
    paymentProvider: data.paymentProvider || 'stripe',
    paymentIntentId: data.paymentIntentId,
    paymentMethodId: data.paymentMethodId,
    purchaseId: data.purchaseId,
    description: data.description || 'Gift card purchase',
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    deviceId: data.deviceId,
    metadata: data.metadata,
  });
};

// Static method to create wallet transaction
transactionSchema.statics.createWalletTransaction = async function (data) {
  return this.create({
    userId: data.userId,
    type: data.type, // 'wallet_credit' or 'wallet_debit'
    amount: data.amount,
    fee: 0,
    netAmount: data.amount,
    status: 'completed',
    paymentProvider: 'wallet',
    description: data.description,
    balanceBefore: data.balanceBefore,
    balanceAfter: data.balanceAfter,
    metadata: data.metadata,
  });
};

// Static method to get user transaction history
transactionSchema.statics.getUserTransactions = async function (userId, options = {}) {
  const { type, status, startDate, endDate, page = 1, limit = 20 } = options;

  const filter = { userId };

  if (type) filter.type = type;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const transactions = await this.find(filter)
    .populate('purchaseId', 'giftCardId amount status')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get business transactions
transactionSchema.statics.getBusinessTransactions = async function (businessId, options = {}) {
  const { type, status, startDate, endDate, page = 1, limit = 20 } = options;

  const filter = { businessId };

  if (type) filter.type = type;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const transactions = await this.find(filter)
    .populate('userId', 'firstName lastName email')
    .populate('campaignId', 'name')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get transaction summary
transactionSchema.statics.getTransactionSummary = async function (userId, period = 'month') {
  const startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  const result = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed',
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.reduce((acc, item) => {
    acc[item._id] = { total: item.total, count: item.count };
    return acc;
  }, {});
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
