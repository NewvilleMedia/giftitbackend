const mongoose = require('mongoose');

const giftCardSchema = new mongoose.Schema(
  {
    // Provider information
    provider: {
      type: String,
      enum: ['runa', 'tremendous', 'tango', 'internal'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
    },
    providerProductId: {
      type: String,
      required: true,
    },

    // Brand information
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    brandSlug: {
      type: String,
      lowercase: true,
    },
    brandLogo: {
      type: String,
    },
    brandDescription: {
      type: String,
    },

    // Card details
    name: {
      type: String,
      required: [true, 'Gift card name is required'],
      trim: true,
    },
    description: {
      type: String,
    },
    image: {
      type: String,
    },
    category: {
      type: String,
      enum: [
        'amazon',
        'retail',
        'restaurants',
        'coffee',
        'pets',
        'travel',
        'gas',
        'entertainment',
        'health',
        'sports',
        'gifts',
        'other',
      ],
      default: 'other',
    },
    tags: [{
      type: String,
    }],

    // Pricing
    priceType: {
      type: String,
      enum: ['fixed', 'variable'],
      required: true,
    },
    fixedAmounts: [{
      type: Number,
    }],
    minAmount: {
      type: Number,
      default: 5,
    },
    maxAmount: {
      type: Number,
      default: 500,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    discount: {
      type: Number,
      default: 0, // Percentage discount
    },

    // Availability
    isAvailable: {
      type: Boolean,
      default: true,
    },
    countries: [{
      type: String,
      default: 'US',
    }],
    inventory: {
      type: Number,
      default: -1, // -1 means unlimited
    },

    // Redemption info
    redemptionType: {
      type: String,
      enum: ['code', 'link', 'barcode', 'qr'],
      default: 'code',
    },
    redemptionInstructions: {
      type: String,
    },
    expirationPolicy: {
      type: String,
    },
    termsAndConditions: {
      type: String,
    },

    // Analytics
    popularity: {
      type: Number,
      default: 0,
    },
    totalSold: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },

    // Admin settings
    featured: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Cache control
    lastSyncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
giftCardSchema.index({ provider: 1, providerId: 1 });
giftCardSchema.index({ brandName: 1 });
giftCardSchema.index({ brandSlug: 1 });
giftCardSchema.index({ category: 1 });
giftCardSchema.index({ tags: 1 });
giftCardSchema.index({ isAvailable: 1, isActive: 1 });
giftCardSchema.index({ popularity: -1 });
giftCardSchema.index({ featured: 1 });
giftCardSchema.index({ name: 'text', brandName: 'text', description: 'text' });

// Pre-save to generate brand slug
giftCardSchema.pre('save', function (next) {
  if (this.isModified('brandName') && !this.brandSlug) {
    this.brandSlug = this.brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

// Method to check availability
giftCardSchema.methods.checkAvailability = function () {
  if (!this.isActive || !this.isAvailable) return false;
  if (this.inventory === -1) return true;
  return this.inventory > 0;
};

// Method to decrement inventory
giftCardSchema.methods.decrementInventory = async function (quantity = 1) {
  if (this.inventory !== -1) {
    this.inventory = Math.max(0, this.inventory - quantity);
    if (this.inventory === 0) {
      this.isAvailable = false;
    }
  }
  this.totalSold += quantity;
  this.popularity += quantity;
  return this.save();
};

// Static method to search gift cards
giftCardSchema.statics.searchCards = async function (query, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    featured,
    sort = 'popularity',
    page = 1,
    limit = 20,
  } = options;

  const filter = {
    isActive: true,
    isAvailable: true,
  };

  if (query) {
    filter.$text = { $search: query };
  }

  if (category) {
    filter.category = category;
  }

  if (minPrice !== undefined) {
    filter.$or = [
      { priceType: 'variable', minAmount: { $lte: minPrice } },
      { priceType: 'fixed', fixedAmounts: { $gte: minPrice } },
    ];
  }

  if (maxPrice !== undefined) {
    filter.$or = filter.$or || [];
    filter.$or.push(
      { priceType: 'variable', maxAmount: { $gte: maxPrice } },
      { priceType: 'fixed', fixedAmounts: { $lte: maxPrice } }
    );
  }

  if (featured !== undefined) {
    filter.featured = featured;
  }

  const sortOptions = {
    popularity: { popularity: -1 },
    newest: { createdAt: -1 },
    name: { name: 1 },
    rating: { averageRating: -1 },
  };

  const results = await this.find(filter)
    .sort(sortOptions[sort] || sortOptions.popularity)
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    cards: results,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get by category
giftCardSchema.statics.getByCategory = async function (category, limit = 20) {
  return this.find({
    category,
    isActive: true,
    isAvailable: true,
  })
    .sort({ popularity: -1 })
    .limit(limit);
};

// Static method to get featured cards
giftCardSchema.statics.getFeatured = async function (limit = 10) {
  return this.find({
    featured: true,
    isActive: true,
    isAvailable: true,
  })
    .sort({ displayOrder: 1, popularity: -1 })
    .limit(limit);
};

// Static method to get popular cards
giftCardSchema.statics.getPopular = async function (limit = 20) {
  return this.find({
    isActive: true,
    isAvailable: true,
  })
    .sort({ popularity: -1 })
    .limit(limit);
};

const GiftCard = mongoose.model('GiftCard', giftCardSchema);

module.exports = GiftCard;
