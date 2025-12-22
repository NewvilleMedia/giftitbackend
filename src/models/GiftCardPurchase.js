const mongoose = require('mongoose');

const giftCardPurchaseSchema = new mongoose.Schema(
  {
    // Buyer information
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      default: null,
    },

    // Gift card reference
    giftCardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftCard',
      required: true,
    },

    // Purchase details
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [1, 'Amount must be at least $1'],
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      required: true,
    },

    // Recipient information (for gifting)
    recipientType: {
      type: String,
      enum: ['self', 'gift', 'business'],
      default: 'self',
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    recipientEmail: {
      type: String,
      default: null,
    },
    recipientPhone: {
      type: String,
      default: null,
    },
    recipientName: {
      type: String,
      default: null,
    },
    personalMessage: {
      type: String,
      maxlength: 500,
    },
    deliveryDate: {
      type: Date,
      default: null, // null means immediate delivery
    },

    // Provider order information
    provider: {
      type: String,
      enum: ['runa', 'tremendous', 'tango'],
      required: true,
    },
    providerOrderId: {
      type: String,
    },
    providerStatus: {
      type: String,
    },

    // Redemption codes (from provider)
    redemptionCodes: [{
      code: {
        type: String,
        required: true,
      },
      pin: String,
      barcode: String,
      qrCode: String,
      link: String,
      expiresAt: Date,
      isRedeemed: {
        type: Boolean,
        default: false,
      },
      redeemedAt: Date,
      redeemedAmount: {
        type: Number,
        default: 0,
      },
      remainingBalance: Number,
    }],

    // Status tracking
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'completed',
        'delivered',
        'partially_redeemed',
        'fully_redeemed',
        'cancelled',
        'refunded',
        'failed',
      ],
      default: 'pending',
    },

    // Payment information
    paymentMethod: {
      type: String,
      enum: ['card', 'wallet', 'bank', 'business_account'],
      required: true,
    },
    paymentIntentId: {
      type: String,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },

    // Delivery tracking
    deliveryMethod: {
      type: String,
      enum: ['email', 'sms', 'in_app', 'all'],
      default: 'email',
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending',
    },
    deliveredAt: Date,

    // For subscriptions
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
    },

    // For campaigns
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },

    // Refund information
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,

    // Notes and metadata
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
giftCardPurchaseSchema.index({ buyerId: 1 });
giftCardPurchaseSchema.index({ businessId: 1 });
giftCardPurchaseSchema.index({ recipientId: 1 });
giftCardPurchaseSchema.index({ recipientEmail: 1 });
giftCardPurchaseSchema.index({ giftCardId: 1 });
giftCardPurchaseSchema.index({ status: 1 });
giftCardPurchaseSchema.index({ subscriptionId: 1 });
giftCardPurchaseSchema.index({ campaignId: 1 });
giftCardPurchaseSchema.index({ createdAt: -1 });
giftCardPurchaseSchema.index({ deliveryDate: 1, deliveryStatus: 1 });

// Virtual for checking if fully redeemed
giftCardPurchaseSchema.virtual('isFullyRedeemed').get(function () {
  if (!this.redemptionCodes || this.redemptionCodes.length === 0) return false;
  return this.redemptionCodes.every((code) => code.isRedeemed);
});

// Virtual for total redeemed amount
giftCardPurchaseSchema.virtual('totalRedeemedAmount').get(function () {
  if (!this.redemptionCodes) return 0;
  return this.redemptionCodes.reduce((sum, code) => sum + (code.redeemedAmount || 0), 0);
});

// Virtual for remaining balance
giftCardPurchaseSchema.virtual('totalRemainingBalance').get(function () {
  if (!this.redemptionCodes) return this.amount;
  return this.redemptionCodes.reduce(
    (sum, code) => sum + (code.remainingBalance || 0),
    0
  );
});

// Method to mark as delivered
giftCardPurchaseSchema.methods.markAsDelivered = async function () {
  this.deliveryStatus = 'delivered';
  this.deliveredAt = new Date();
  if (this.status === 'completed') {
    this.status = 'delivered';
  }
  return this.save();
};

// Method to redeem code
giftCardPurchaseSchema.methods.redeemCode = async function (codeIndex, amount) {
  if (!this.redemptionCodes[codeIndex]) {
    throw new Error('Invalid code index');
  }

  const code = this.redemptionCodes[codeIndex];
  code.redeemedAmount = (code.redeemedAmount || 0) + amount;
  code.remainingBalance = (code.remainingBalance || this.amount) - amount;

  if (code.remainingBalance <= 0) {
    code.isRedeemed = true;
    code.redeemedAt = new Date();
  }

  // Update overall status
  if (this.isFullyRedeemed) {
    this.status = 'fully_redeemed';
  } else if (this.totalRedeemedAmount > 0) {
    this.status = 'partially_redeemed';
  }

  return this.save();
};

// Method to cancel purchase
giftCardPurchaseSchema.methods.cancel = async function (reason) {
  if (['completed', 'delivered', 'partially_redeemed', 'fully_redeemed'].includes(this.status)) {
    throw new Error('Cannot cancel completed or redeemed purchase');
  }
  this.status = 'cancelled';
  this.notes = reason || 'Cancelled by user';
  return this.save();
};

// Method to refund purchase
giftCardPurchaseSchema.methods.refund = async function (amount, reason) {
  this.status = 'refunded';
  this.refundedAt = new Date();
  this.refundAmount = amount || this.totalPaid;
  this.refundReason = reason;
  return this.save();
};

// Static method to get user purchases
giftCardPurchaseSchema.statics.getUserPurchases = async function (userId, options = {}) {
  const { status, page = 1, limit = 20 } = options;

  const filter = { buyerId: userId };
  if (status) {
    filter.status = status;
  }

  const purchases = await this.find(filter)
    .populate('giftCardId', 'name brandName image category')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    purchases,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get received gift cards
giftCardPurchaseSchema.statics.getReceivedGiftCards = async function (userId, userEmail, options = {}) {
  const { status, page = 1, limit = 20 } = options;

  const filter = {
    $or: [{ recipientId: userId }, { recipientEmail: userEmail }],
    recipientType: 'gift',
  };

  if (status) {
    filter.status = status;
  }

  const purchases = await this.find(filter)
    .populate('giftCardId', 'name brandName image category')
    .populate('buyerId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    purchases,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get pending deliveries
giftCardPurchaseSchema.statics.getPendingDeliveries = async function () {
  return this.find({
    status: 'completed',
    deliveryStatus: 'pending',
    $or: [
      { deliveryDate: { $lte: new Date() } },
      { deliveryDate: null },
    ],
  }).populate('giftCardId recipientId buyerId');
};

const GiftCardPurchase = mongoose.model('GiftCardPurchase', giftCardPurchaseSchema);

module.exports = GiftCardPurchase;
