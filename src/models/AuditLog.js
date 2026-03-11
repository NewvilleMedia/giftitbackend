const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    userRole: {
      type: String,
      enum: ['user', 'business', 'admin', 'superadmin'],
      required: true,
    },

    // What action was performed
    action: {
      type: String,
      required: true,
      enum: [
        // User actions
        'user.create',
        'user.update',
        'user.delete',
        'user.ban',
        'user.unban',
        'user.role_change',

        // Business actions
        'business.create',
        'business.update',
        'business.verify',
        'business.suspend',
        'business.unsuspend',

        // Gift card actions
        'giftcard.update',
        'giftcard.sync',
        'giftcard.feature',
        'giftcard.unfeature',

        // Transaction actions
        'transaction.refund',
        'transaction.void',

        // Campaign actions
        'campaign.approve',
        'campaign.reject',
        'campaign.cancel',

        // System actions
        'settings.update',
        'promocode.create',
        'promocode.update',
        'promocode.delete',
        'notification.broadcast',

        // Auth actions
        'auth.login',
        'auth.logout',
        'auth.password_reset',
      ],
    },

    // What resource was affected
    resourceType: {
      type: String,
      required: true,
      enum: ['user', 'business', 'giftcard', 'transaction', 'campaign', 'settings', 'promocode', 'notification'],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    resourceName: {
      type: String,
    },

    // Details of the change
    description: {
      type: String,
      required: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    // Request context
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },

    // Status
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userRole: 1, createdAt: -1 });

// Static method to create audit log
auditLogSchema.statics.log = async function (data) {
  return this.create(data);
};

// Static method to get logs with filters
auditLogSchema.statics.getLogs = async function (options = {}) {
  const {
    userId,
    action,
    resourceType,
    resourceId,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = options;

  const filter = {};

  if (userId) filter.userId = userId;
  if (action) filter.action = action;
  if (resourceType) filter.resourceType = resourceType;
  if (resourceId) filter.resourceId = resourceId;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const logs = await this.find(filter)
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(filter);

  return {
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function (userId, limit = 20) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
