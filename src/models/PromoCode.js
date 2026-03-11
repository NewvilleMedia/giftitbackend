const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema(
  {
    // Code details
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },

    // Discount type
    discountType: {
      type: String,
      enum: ['percentage', 'fixed', 'free_delivery'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number, // Cap for percentage discounts
    },

    // Usage limits
    usageLimit: {
      type: Number, // Total uses allowed (null = unlimited)
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    perUserLimit: {
      type: Number,
      default: 1, // How many times each user can use
    },

    // Minimum requirements
    minimumPurchaseAmount: {
      type: Number,
      default: 0,
    },

    // Validity period
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },

    // Restrictions
    applicableGiftCards: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftCard',
    }],
    applicableCategories: [{
      type: String,
    }],
    excludedGiftCards: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GiftCard',
    }],

    // User restrictions
    applicableUserTypes: [{
      type: String,
      enum: ['new', 'existing', 'business'],
    }],
    specificUsers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],

    // Usage tracking
    usedBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      purchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GiftCardPurchase',
      },
      discountApplied: {
        type: Number,
      },
    }],

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Created by
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Metadata
    tags: [{
      type: String,
    }],
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
promoCodeSchema.index({ code: 1 }, { unique: true });
promoCodeSchema.index({ isActive: 1, startDate: 1, endDate: 1 });
promoCodeSchema.index({ createdBy: 1 });

// Virtual for checking if promo is currently valid
promoCodeSchema.virtual('isValid').get(function () {
  const now = new Date();

  if (!this.isActive) return false;
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;
  if (this.usageLimit && this.usageCount >= this.usageLimit) return false;

  return true;
});

// Method to check if user can use this promo
promoCodeSchema.methods.canUserUse = function (userId) {
  if (!this.isValid) return { valid: false, reason: 'Promo code is not valid' };

  // Check specific users restriction
  if (this.specificUsers.length > 0) {
    const allowed = this.specificUsers.some(
      (id) => id.toString() === userId.toString()
    );
    if (!allowed) return { valid: false, reason: 'Promo code not available for this user' };
  }

  // Check per-user limit
  const userUsageCount = this.usedBy.filter(
    (use) => use.userId.toString() === userId.toString()
  ).length;

  if (userUsageCount >= this.perUserLimit) {
    return { valid: false, reason: 'You have already used this promo code' };
  }

  return { valid: true };
};

// Method to calculate discount
promoCodeSchema.methods.calculateDiscount = function (purchaseAmount) {
  if (purchaseAmount < this.minimumPurchaseAmount) {
    return { valid: false, reason: `Minimum purchase amount is $${this.minimumPurchaseAmount}` };
  }

  let discount = 0;

  switch (this.discountType) {
    case 'percentage':
      discount = (purchaseAmount * this.discountValue) / 100;
      if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
        discount = this.maxDiscountAmount;
      }
      break;
    case 'fixed':
      discount = this.discountValue;
      break;
    case 'free_delivery':
      discount = 0; // Handled separately
      break;
  }

  return { valid: true, discount: Math.min(discount, purchaseAmount) };
};

// Method to record usage
promoCodeSchema.methods.recordUsage = async function (userId, purchaseId, discountApplied) {
  this.usedBy.push({
    userId,
    purchaseId,
    discountApplied,
    usedAt: new Date(),
  });
  this.usageCount += 1;
  await this.save();
};

// Static method to validate and get promo code
promoCodeSchema.statics.validateCode = async function (code, userId, purchaseAmount) {
  const promo = await this.findOne({ code: code.toUpperCase() });

  if (!promo) {
    return { valid: false, reason: 'Invalid promo code' };
  }

  const userCheck = promo.canUserUse(userId);
  if (!userCheck.valid) return userCheck;

  const discountCheck = promo.calculateDiscount(purchaseAmount);
  if (!discountCheck.valid) return discountCheck;

  return {
    valid: true,
    promo,
    discount: discountCheck.discount,
  };
};

// Static method to get active promo codes
promoCodeSchema.statics.getActiveCodes = async function (options = {}) {
  const { page = 1, limit = 20, includeExpired = false } = options;
  const now = new Date();

  const filter = {};

  if (!includeExpired) {
    filter.isActive = true;
    filter.$or = [
      { endDate: null },
      { endDate: { $gte: now } },
    ];
  }

  const promoCodes = await this.find(filter)
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    promoCodes,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

promoCodeSchema.set('toJSON', { virtuals: true });
promoCodeSchema.set('toObject', { virtuals: true });

const PromoCode = mongoose.model('PromoCode', promoCodeSchema);

module.exports = PromoCode;
