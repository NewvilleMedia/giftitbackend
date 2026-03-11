const User = require('../../models/User');
const Business = require('../../models/Business');
const GiftCard = require('../../models/GiftCard');
const GiftCardPurchase = require('../../models/GiftCardPurchase');
const Subscription = require('../../models/Subscription');
const Transaction = require('../../models/Transaction');
const Campaign = require('../../models/Campaign');
const Notification = require('../../models/Notification');
const AuditLog = require('../../models/AuditLog');
const PromoCode = require('../../models/PromoCode');
const SystemSettings = require('../../models/SystemSettings');
const runaApi = require('../../utils/runaApi');
const { sendEmail } = require('../../utils/email');
const { sendPushNotification } = require('../../utils/pushNotification');
const { stripe } = require('../../config/stripe');

class AdminService {
  // Dashboard statistics
  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      totalBusinesses,
      totalGiftCards,
      totalPurchases,
      totalSubscriptions,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Business.countDocuments(),
      GiftCard.countDocuments({ isActive: true }),
      GiftCardPurchase.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Transaction.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Get revenue by period
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyRevenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          type: 'purchase',
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      businesses: {
        total: totalBusinesses,
      },
      giftCards: {
        total: totalGiftCards,
      },
      purchases: {
        total: totalPurchases,
      },
      subscriptions: {
        active: totalSubscriptions,
      },
      revenue: {
        total: recentTransactions[0]?.totalAmount || 0,
        transactions: recentTransactions[0]?.count || 0,
        monthly: monthlyRevenue,
      },
    };
  }

  // User management
  async getUsers(options = {}) {
    const { search, role, status, page = 1, limit = 20 } = options;

    const filter = {};

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) filter.role = role;
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;

    const users = await User.find(filter)
      .select('-password -emailVerificationToken -passwordResetToken')
      .populate('businessId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(filter);

    return {
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getUserById(userId) {
    const user = await User.findById(userId)
      .select('-password -emailVerificationToken -passwordResetToken')
      .populate('businessId');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateUser(userId, updateData) {
    const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'role', 'isActive', 'isEmailVerified'];

    const updates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    }

    const user = await User.findByIdAndUpdate(userId, updates, { new: true })
      .select('-password -emailVerificationToken -passwordResetToken');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async deleteUser(userId) {
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return { message: 'User deleted' };
  }

  // Business management
  async getBusinesses(options = {}) {
    const { search, industry, verified, page = 1, limit = 20 } = options;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (industry) filter.industry = industry;
    if (verified !== undefined) filter.isVerified = verified;

    const businesses = await Business.find(filter)
      .populate('ownerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Business.countDocuments(filter);

    return {
      businesses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async verifyBusiness(businessId) {
    const business = await Business.findByIdAndUpdate(
      businessId,
      { isVerified: true },
      { new: true }
    );

    if (!business) {
      throw new Error('Business not found');
    }

    return business;
  }

  // Gift card management
  async getGiftCards(options = {}) {
    const { search, category, provider, active, page = 1, limit = 20 } = options;

    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brandName: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) filter.category = category;
    if (provider) filter.provider = provider;
    if (active !== undefined) filter.isActive = active;

    const giftCards = await GiftCard.find(filter)
      .sort({ popularity: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await GiftCard.countDocuments(filter);

    return {
      giftCards,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async updateGiftCard(giftCardId, updateData) {
    const allowedFields = ['isActive', 'isAvailable', 'featured', 'displayOrder', 'category', 'tags'];

    const updates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = updateData[field];
      }
    }

    const giftCard = await GiftCard.findByIdAndUpdate(giftCardId, updates, { new: true });

    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    return giftCard;
  }

  async syncGiftCards() {
    // Sync from Runa
    const result = await runaApi.getCatalog({ limit: 100 });

    if (!result.success) {
      throw new Error(result.error);
    }

    let synced = 0;

    for (const product of result.data) {
      const giftCardData = runaApi.mapProductToGiftCard(product);

      await GiftCard.findOneAndUpdate(
        { provider: 'runa', providerId: product.id },
        { $set: { ...giftCardData, lastSyncedAt: new Date() } },
        { upsert: true }
      );

      synced++;
    }

    return { message: `Synced ${synced} gift cards from Runa` };
  }

  // Transaction management
  async getTransactions(options = {}) {
    const { type, status, startDate, endDate, page = 1, limit = 20 } = options;

    const filter = {};

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('businessId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transaction.countDocuments(filter);

    return {
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Campaign management
  async getCampaigns(options = {}) {
    const { status, type, page = 1, limit = 20 } = options;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;

    const campaigns = await Campaign.find(filter)
      .populate('businessId', 'name')
      .populate('giftCardId', 'name brandName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Campaign.countDocuments(filter);

    return {
      campaigns,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // Reports
  async getRevenueReport(period = 'month') {
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const revenue = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          type: 'purchase',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          fees: { $sum: '$fee' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totals = await Transaction.aggregate([
      {
        $match: {
          status: 'completed',
          type: 'purchase',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalFees: { $sum: '$fee' },
          totalTransactions: { $sum: 1 },
          avgTransaction: { $avg: '$amount' },
        },
      },
    ]);

    return {
      daily: revenue,
      totals: totals[0] || {
        totalRevenue: 0,
        totalFees: 0,
        totalTransactions: 0,
        avgTransaction: 0,
      },
    };
  }

  async getUserGrowthReport(period = 'month') {
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const growth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return growth;
  }

  async getGiftCardReport() {
    const topGiftCards = await GiftCard.find({ isActive: true })
      .sort({ totalSold: -1 })
      .limit(20)
      .select('name brandName category totalSold popularity');

    const byCategory = await GiftCard.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalSold: { $sum: '$totalSold' },
        },
      },
      { $sort: { totalSold: -1 } },
    ]);

    return {
      topGiftCards,
      byCategory,
    };
  }

  // ==================== USER BAN/UNBAN ====================

  async banUser(userId, adminId, reason = '') {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === 'superadmin') {
      throw new Error('Cannot ban a superadmin');
    }

    user.isActive = false;
    user.bannedAt = new Date();
    user.banReason = reason;
    await user.save();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'user.ban',
      resourceType: 'user',
      resourceId: userId,
      resourceName: `${user.firstName} ${user.lastName}`,
      description: `Banned user: ${user.email}. Reason: ${reason || 'No reason provided'}`,
      newValue: { isActive: false, bannedAt: user.bannedAt, banReason: reason },
    });

    // Send notification email to user
    try {
      await sendEmail(user.email, 'accountBanned', {
        firstName: user.firstName,
        reason: reason || 'Violation of terms of service',
      });
    } catch (error) {
      console.error('Failed to send ban notification email:', error);
    }

    return { message: 'User banned successfully', user };
  }

  async unbanUser(userId, adminId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = true;
    user.bannedAt = undefined;
    user.banReason = undefined;
    await user.save();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'user.unban',
      resourceType: 'user',
      resourceId: userId,
      resourceName: `${user.firstName} ${user.lastName}`,
      description: `Unbanned user: ${user.email}`,
      newValue: { isActive: true },
    });

    // Send notification email to user
    try {
      await sendEmail(user.email, 'accountUnbanned', {
        firstName: user.firstName,
      });
    } catch (error) {
      console.error('Failed to send unban notification email:', error);
    }

    return { message: 'User unbanned successfully', user };
  }

  // ==================== BUSINESS SUSPEND/UNSUSPEND ====================

  async suspendBusiness(businessId, adminId, reason = '') {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    business.isActive = false;
    business.suspendedAt = new Date();
    business.suspendReason = reason;
    await business.save();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'business.suspend',
      resourceType: 'business',
      resourceId: businessId,
      resourceName: business.name,
      description: `Suspended business: ${business.name}. Reason: ${reason || 'No reason provided'}`,
      newValue: { isActive: false, suspendedAt: business.suspendedAt, suspendReason: reason },
    });

    // Notify business owner
    const owner = await User.findById(business.ownerId);
    if (owner) {
      try {
        await sendEmail(owner.email, 'businessSuspended', {
          firstName: owner.firstName,
          businessName: business.name,
          reason: reason || 'Violation of terms of service',
        });
      } catch (error) {
        console.error('Failed to send suspension notification email:', error);
      }
    }

    return { message: 'Business suspended successfully', business };
  }

  async unsuspendBusiness(businessId, adminId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    business.isActive = true;
    business.suspendedAt = undefined;
    business.suspendReason = undefined;
    await business.save();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'business.unsuspend',
      resourceType: 'business',
      resourceId: businessId,
      resourceName: business.name,
      description: `Unsuspended business: ${business.name}`,
      newValue: { isActive: true },
    });

    // Notify business owner
    const owner = await User.findById(business.ownerId);
    if (owner) {
      try {
        await sendEmail(owner.email, 'businessUnsuspended', {
          firstName: owner.firstName,
          businessName: business.name,
        });
      } catch (error) {
        console.error('Failed to send unsuspend notification email:', error);
      }
    }

    return { message: 'Business unsuspended successfully', business };
  }

  // ==================== TRANSACTION REFUND ====================

  async refundTransaction(transactionId, adminId, reason = '') {
    const transaction = await Transaction.findById(transactionId)
      .populate('userId', 'firstName lastName email wallet');

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (transaction.status === 'refunded') {
      throw new Error('Transaction already refunded');
    }

    if (transaction.status !== 'completed') {
      throw new Error('Can only refund completed transactions');
    }

    const user = transaction.userId;
    let stripeRefund = null;

    // If paid via Stripe, process refund
    if (transaction.paymentIntentId) {
      try {
        stripeRefund = await stripe.refunds.create({
          payment_intent: transaction.paymentIntentId,
          reason: 'requested_by_customer',
        });
      } catch (error) {
        throw new Error(`Stripe refund failed: ${error.message}`);
      }
    }

    // Update transaction
    transaction.status = 'refunded';
    transaction.refundedAt = new Date();
    transaction.refundReason = reason;
    transaction.refundId = stripeRefund?.id;
    await transaction.save();

    // If wallet was debited, credit it back
    if (transaction.type === 'wallet_debit' || transaction.paymentMethod === 'wallet') {
      const userDoc = await User.findById(user._id);
      userDoc.wallet.balance += transaction.amount;
      await userDoc.save();
    }

    // Create refund transaction record
    await Transaction.create({
      userId: user._id,
      businessId: transaction.businessId,
      type: 'refund',
      amount: transaction.amount,
      currency: transaction.currency,
      status: 'completed',
      paymentProvider: transaction.paymentProvider,
      refundId: stripeRefund?.id,
      description: `Refund for transaction ${transaction._id}. Reason: ${reason || 'Admin initiated'}`,
      relatedTransactionId: transaction._id,
    });

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'transaction.refund',
      resourceType: 'transaction',
      resourceId: transactionId,
      description: `Refunded transaction ${transactionId} for $${transaction.amount}. Reason: ${reason || 'No reason provided'}`,
      previousValue: { status: 'completed' },
      newValue: { status: 'refunded', refundedAt: transaction.refundedAt },
    });

    // Notify user
    try {
      await sendEmail(user.email, 'refundProcessed', {
        firstName: user.firstName,
        amount: transaction.amount,
        currency: transaction.currency,
        reason: reason || 'Refund requested',
      });
    } catch (error) {
      console.error('Failed to send refund notification email:', error);
    }

    return { message: 'Transaction refunded successfully', transaction };
  }

  // ==================== SYSTEM SETTINGS ====================

  async getSettings(category = null) {
    if (category) {
      return SystemSettings.getByCategory(category);
    }
    return SystemSettings.getAll();
  }

  async updateSettings(settings, adminId) {
    const admin = await User.findById(adminId);
    const updatedSettings = [];

    for (const [key, value] of Object.entries(settings)) {
      const setting = await SystemSettings.set(key, value, { updatedBy: adminId });
      updatedSettings.push(setting);
    }

    // Log audit
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'settings.update',
      resourceType: 'settings',
      description: `Updated ${Object.keys(settings).length} system settings`,
      newValue: settings,
    });

    return updatedSettings;
  }

  async initializeSettings() {
    return SystemSettings.initializeDefaults();
  }

  // ==================== AUDIT LOGS ====================

  async getAuditLogs(options = {}) {
    return AuditLog.getLogs(options);
  }

  // ==================== BROADCAST NOTIFICATIONS ====================

  async broadcastNotification(adminId, notificationData) {
    const { title, message, targetAudience, channels, scheduledFor } = notificationData;

    let filter = {};

    switch (targetAudience) {
      case 'all':
        filter = { isActive: true };
        break;
      case 'users':
        filter = { isActive: true, role: 'user' };
        break;
      case 'business':
        filter = { isActive: true, role: 'business' };
        break;
      case 'verified':
        filter = { isActive: true, isEmailVerified: true };
        break;
      default:
        filter = { isActive: true };
    }

    const users = await User.find(filter).select('_id email firstName deviceTokens');

    const notifications = [];

    for (const user of users) {
      // Create in-app notification
      const notification = await Notification.create({
        userId: user._id,
        type: 'promotional',
        title,
        message,
        body: message,
        priority: 'normal',
        channels: {
          inApp: { enabled: true },
          push: { enabled: channels?.includes('push') },
          email: { enabled: channels?.includes('email') },
        },
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
      });

      notifications.push(notification);

      // Send push notification if enabled and not scheduled
      if (channels?.includes('push') && !scheduledFor && user.deviceTokens?.length > 0) {
        try {
          for (const deviceToken of user.deviceTokens) {
            await sendPushNotification(deviceToken.token, {
              title,
              body: message,
              data: { type: 'promotional', notificationId: notification._id.toString() },
            });
          }
        } catch (error) {
          console.error(`Failed to send push to user ${user._id}:`, error);
        }
      }

      // Send email if enabled and not scheduled
      if (channels?.includes('email') && !scheduledFor) {
        try {
          await sendEmail(user.email, 'promotional', {
            firstName: user.firstName,
            title,
            message,
          });
        } catch (error) {
          console.error(`Failed to send email to user ${user._id}:`, error);
        }
      }
    }

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'notification.broadcast',
      resourceType: 'notification',
      description: `Broadcast notification to ${users.length} users. Title: ${title}`,
      metadata: { targetAudience, channels, userCount: users.length },
    });

    return {
      message: `Notification sent to ${users.length} users`,
      notificationCount: notifications.length,
    };
  }

  // ==================== PROMO CODES ====================

  async getPromoCodes(options = {}) {
    return PromoCode.getActiveCodes(options);
  }

  async getPromoCodeById(promoCodeId) {
    const promoCode = await PromoCode.findById(promoCodeId)
      .populate('createdBy', 'firstName lastName email');

    if (!promoCode) {
      throw new Error('Promo code not found');
    }

    return promoCode;
  }

  async createPromoCode(adminId, promoCodeData) {
    const existingCode = await PromoCode.findOne({ code: promoCodeData.code.toUpperCase() });
    if (existingCode) {
      throw new Error('Promo code already exists');
    }

    const promoCode = await PromoCode.create({
      ...promoCodeData,
      code: promoCodeData.code.toUpperCase(),
      createdBy: adminId,
    });

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'promocode.create',
      resourceType: 'promocode',
      resourceId: promoCode._id,
      resourceName: promoCode.code,
      description: `Created promo code: ${promoCode.code}`,
      newValue: promoCodeData,
    });

    return promoCode;
  }

  async updatePromoCode(promoCodeId, adminId, updateData) {
    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) {
      throw new Error('Promo code not found');
    }

    const previousValue = promoCode.toObject();

    const allowedFields = [
      'name',
      'description',
      'discountType',
      'discountValue',
      'maxDiscountAmount',
      'usageLimit',
      'perUserLimit',
      'minimumPurchaseAmount',
      'startDate',
      'endDate',
      'applicableCategories',
      'isActive',
      'tags',
      'notes',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        promoCode[field] = updateData[field];
      }
    }

    await promoCode.save();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'promocode.update',
      resourceType: 'promocode',
      resourceId: promoCodeId,
      resourceName: promoCode.code,
      description: `Updated promo code: ${promoCode.code}`,
      previousValue,
      newValue: updateData,
    });

    return promoCode;
  }

  async deletePromoCode(promoCodeId, adminId) {
    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) {
      throw new Error('Promo code not found');
    }

    await promoCode.deleteOne();

    // Log audit
    const admin = await User.findById(adminId);
    await AuditLog.log({
      userId: adminId,
      userEmail: admin.email,
      userRole: admin.role,
      action: 'promocode.delete',
      resourceType: 'promocode',
      resourceId: promoCodeId,
      resourceName: promoCode.code,
      description: `Deleted promo code: ${promoCode.code}`,
    });

    return { message: 'Promo code deleted successfully' };
  }

  async validatePromoCode(code, userId, purchaseAmount) {
    return PromoCode.validateCode(code, userId, purchaseAmount);
  }
}

module.exports = new AdminService();
