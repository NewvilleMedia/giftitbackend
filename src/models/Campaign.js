const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    // Business reference
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Campaign details
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: [
        'birthday',       // Employee birthdays
        'holiday',        // Holiday gifts (Christmas, New Year, etc.)
        'anniversary',    // Work anniversaries
        'recognition',    // Employee recognition/rewards
        'milestone',      // Company milestones
        'onboarding',     // New employee welcome
        'custom',         // Custom campaigns
      ],
      required: true,
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
    personalMessage: {
      type: String,
      maxlength: 500,
    },

    // Recipient configuration
    recipientType: {
      type: String,
      enum: ['all_employees', 'department', 'custom_list', 'csv_upload'],
      default: 'custom_list',
    },
    department: String,
    recipients: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      email: String,
      name: String,
      phone: String,
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed', 'redeemed'],
        default: 'pending',
      },
      purchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GiftCardPurchase',
      },
      sentAt: Date,
      deliveredAt: Date,
      failureReason: String,
    }],

    // Schedule configuration
    scheduleType: {
      type: String,
      enum: ['immediate', 'scheduled', 'recurring'],
      default: 'immediate',
    },
    scheduledDate: Date,

    // Recurring configuration
    recurring: {
      frequency: {
        type: String,
        enum: ['monthly', 'quarterly', 'annually'],
      },
      dayOfMonth: Number,
      month: Number, // For annual recurrence
      nextOccurrence: Date,
      occurrenceCount: {
        type: Number,
        default: 0,
      },
      maxOccurrences: Number, // null for unlimited
    },

    // Budget
    budget: {
      total: {
        type: Number,
        required: true,
      },
      spent: {
        type: Number,
        default: 0,
      },
      perRecipient: Number,
    },

    // Status
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },

    // Statistics
    stats: {
      totalRecipients: {
        type: Number,
        default: 0,
      },
      sentCount: {
        type: Number,
        default: 0,
      },
      deliveredCount: {
        type: Number,
        default: 0,
      },
      failedCount: {
        type: Number,
        default: 0,
      },
      redeemedCount: {
        type: Number,
        default: 0,
      },
      totalAmountSent: {
        type: Number,
        default: 0,
      },
    },

    // Approval workflow (if required)
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectionReason: String,

    // Timestamps
    startedAt: Date,
    completedAt: Date,
    cancelledAt: Date,

    // Notification preferences
    notifications: {
      notifyOnSend: { type: Boolean, default: true },
      notifyOnComplete: { type: Boolean, default: true },
      notifyOnFailure: { type: Boolean, default: true },
    },

    // Metadata
    tags: [String],
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
campaignSchema.index({ businessId: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ type: 1 });
campaignSchema.index({ scheduledDate: 1 });
campaignSchema.index({ 'recurring.nextOccurrence': 1 });
campaignSchema.index({ createdAt: -1 });

// Virtual for progress percentage
campaignSchema.virtual('progressPercentage').get(function () {
  if (this.stats.totalRecipients === 0) return 0;
  return Math.round((this.stats.sentCount / this.stats.totalRecipients) * 100);
});

// Virtual for remaining budget
campaignSchema.virtual('remainingBudget').get(function () {
  return this.budget.total - this.budget.spent;
});

// Pre-save to update stats
campaignSchema.pre('save', function (next) {
  if (this.isModified('recipients')) {
    this.stats.totalRecipients = this.recipients.length;
    this.stats.sentCount = this.recipients.filter(r => r.status !== 'pending').length;
    this.stats.deliveredCount = this.recipients.filter(r => r.status === 'delivered' || r.status === 'redeemed').length;
    this.stats.failedCount = this.recipients.filter(r => r.status === 'failed').length;
    this.stats.redeemedCount = this.recipients.filter(r => r.status === 'redeemed').length;
  }
  next();
});

// Method to add recipients
campaignSchema.methods.addRecipients = async function (recipientList) {
  for (const recipient of recipientList) {
    const exists = this.recipients.find(
      r => (r.userId && r.userId.toString() === recipient.userId?.toString()) ||
           (r.email && r.email === recipient.email)
    );
    if (!exists) {
      this.recipients.push({
        userId: recipient.userId,
        email: recipient.email,
        name: recipient.name,
        phone: recipient.phone,
        status: 'pending',
      });
    }
  }
  return this.save();
};

// Method to remove recipient
campaignSchema.methods.removeRecipient = async function (recipientId) {
  this.recipients = this.recipients.filter(
    r => r._id.toString() !== recipientId.toString()
  );
  return this.save();
};

// Method to update recipient status
campaignSchema.methods.updateRecipientStatus = async function (recipientId, status, data = {}) {
  const recipient = this.recipients.id(recipientId);
  if (recipient) {
    recipient.status = status;
    if (data.purchaseId) recipient.purchaseId = data.purchaseId;
    if (status === 'sent') recipient.sentAt = new Date();
    if (status === 'delivered') recipient.deliveredAt = new Date();
    if (status === 'failed') recipient.failureReason = data.failureReason;

    // Update spent amount
    if (status === 'sent') {
      this.budget.spent += this.amount;
      this.stats.totalAmountSent += this.amount;
    }
  }
  return this.save();
};

// Method to start campaign
campaignSchema.methods.start = async function () {
  if (this.status === 'draft' || this.status === 'scheduled') {
    this.status = 'active';
    this.startedAt = new Date();
  }
  return this.save();
};

// Method to pause campaign
campaignSchema.methods.pause = async function () {
  if (this.status === 'active') {
    this.status = 'paused';
  }
  return this.save();
};

// Method to resume campaign
campaignSchema.methods.resume = async function () {
  if (this.status === 'paused') {
    this.status = 'active';
  }
  return this.save();
};

// Method to complete campaign
campaignSchema.methods.complete = async function () {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Method to cancel campaign
campaignSchema.methods.cancel = async function (reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  if (reason) {
    this.metadata = this.metadata || new Map();
    this.metadata.set('cancellationReason', reason);
  }
  return this.save();
};

// Method to approve campaign
campaignSchema.methods.approve = async function (approverId) {
  this.approvalStatus = 'approved';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject campaign
campaignSchema.methods.reject = async function (approverId, reason) {
  this.approvalStatus = 'rejected';
  this.approvedBy = approverId;
  this.approvedAt = new Date();
  this.rejectionReason = reason;
  return this.save();
};

// Method to calculate next occurrence for recurring campaigns
campaignSchema.methods.calculateNextOccurrence = function () {
  if (!this.recurring || this.scheduleType !== 'recurring') return null;

  const now = new Date();
  const next = new Date(this.recurring.nextOccurrence || now);

  switch (this.recurring.frequency) {
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (this.recurring.dayOfMonth) {
        next.setDate(this.recurring.dayOfMonth);
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (this.recurring.dayOfMonth) {
        next.setDate(this.recurring.dayOfMonth);
      }
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      if (this.recurring.month !== undefined) {
        next.setMonth(this.recurring.month);
      }
      if (this.recurring.dayOfMonth) {
        next.setDate(this.recurring.dayOfMonth);
      }
      break;
  }

  return next;
};

// Static method to get scheduled campaigns due for execution
campaignSchema.statics.getDueCampaigns = async function () {
  const now = new Date();

  return this.find({
    $or: [
      // Scheduled campaigns that are due
      {
        status: 'scheduled',
        scheduleType: 'scheduled',
        scheduledDate: { $lte: now },
      },
      // Recurring campaigns that are due
      {
        status: { $in: ['active', 'scheduled'] },
        scheduleType: 'recurring',
        'recurring.nextOccurrence': { $lte: now },
      },
    ],
  }).populate('businessId giftCardId createdBy');
};

// Static method to get business campaigns
campaignSchema.statics.getBusinessCampaigns = async function (businessId, options = {}) {
  const { status, type, page = 1, limit = 20 } = options;

  const filter = { businessId };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const campaigns = await this.find(filter)
    .populate('giftCardId', 'name brandName image')
    .populate('createdBy', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    campaigns,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get campaign statistics for a business
campaignSchema.statics.getBusinessCampaignStats = async function (businessId, period = 'month') {
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
  }

  const result = await this.aggregate([
    {
      $match: {
        businessId: new mongoose.Types.ObjectId(businessId),
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalCampaigns: { $sum: 1 },
        totalBudget: { $sum: '$budget.total' },
        totalSpent: { $sum: '$budget.spent' },
        totalRecipients: { $sum: '$stats.totalRecipients' },
        totalDelivered: { $sum: '$stats.deliveredCount' },
        totalRedeemed: { $sum: '$stats.redeemedCount' },
      },
    },
  ]);

  return result[0] || {
    totalCampaigns: 0,
    totalBudget: 0,
    totalSpent: 0,
    totalRecipients: 0,
    totalDelivered: 0,
    totalRedeemed: 0,
  };
};

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
