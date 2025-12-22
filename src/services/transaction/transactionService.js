const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const Business = require('../../models/Business');

class TransactionService {
  // Get user transactions
  async getUserTransactions(userId, options = {}) {
    return Transaction.getUserTransactions(userId, options);
  }

  // Get business transactions
  async getBusinessTransactions(businessId, userId, options = {}) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    return Transaction.getBusinessTransactions(businessId, options);
  }

  // Get transaction by ID
  async getTransactionById(transactionId, userId) {
    const transaction = await Transaction.findById(transactionId)
      .populate('purchaseId')
      .populate('subscriptionId')
      .populate('campaignId');

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Check access
    if (transaction.userId.toString() !== userId.toString()) {
      // Check if user is business admin
      if (transaction.businessId) {
        const business = await Business.findById(transaction.businessId);
        if (!business || !business.isAdmin(userId)) {
          throw new Error('Access denied');
        }
      } else {
        throw new Error('Access denied');
      }
    }

    return transaction;
  }

  // Get transaction summary
  async getTransactionSummary(userId, period = 'month') {
    return Transaction.getTransactionSummary(userId, period);
  }

  // Get business transaction summary
  async getBusinessTransactionSummary(businessId, userId, period = 'month') {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const mongoose = require('mongoose');
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

    const result = await Transaction.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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
  }

  // Get spending analytics
  async getSpendingAnalytics(userId, period = 'month') {
    const mongoose = require('mongoose');
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

    // Get spending by day/week/month
    const groupBy = period === 'week' ? { $dayOfWeek: '$createdAt' } :
                    period === 'month' ? { $dayOfMonth: '$createdAt' } :
                    { $month: '$createdAt' };

    const spendingByPeriod = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'purchase',
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupBy,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get total spending
    const totalSpending = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          type: 'purchase',
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
        },
      },
    ]);

    return {
      periodData: spendingByPeriod,
      summary: totalSpending[0] || { total: 0, count: 0, avgAmount: 0 },
    };
  }

  // Export transactions
  async exportTransactions(userId, options = {}) {
    const { startDate, endDate, format = 'json' } = options;

    const filter = { userId };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('purchaseId', 'giftCardId amount')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const headers = ['Date', 'Type', 'Description', 'Amount', 'Status', 'Reference'];
      const rows = transactions.map((t) => [
        new Date(t.createdAt).toISOString(),
        t.type,
        t.description,
        t.amount,
        t.status,
        t.purchaseId?._id || t.subscriptionId || t.campaignId || '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      return { format: 'csv', data: csv };
    }

    return { format: 'json', data: transactions };
  }

  // Get recent activity
  async getRecentActivity(userId, limit = 10) {
    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return transactions.map((t) => ({
      id: t._id,
      type: t.type,
      description: t.description,
      amount: t.amount,
      status: t.status,
      date: t.createdAt,
    }));
  }
}

module.exports = new TransactionService();
