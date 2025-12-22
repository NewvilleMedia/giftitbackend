const User = require('../../models/User');
const Business = require('../../models/Business');
const GiftCard = require('../../models/GiftCard');
const GiftCardPurchase = require('../../models/GiftCardPurchase');
const Subscription = require('../../models/Subscription');
const Transaction = require('../../models/Transaction');
const Campaign = require('../../models/Campaign');
const runaApi = require('../../utils/runaApi');

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
}

module.exports = new AdminService();
