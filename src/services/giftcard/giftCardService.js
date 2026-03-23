const GiftCard = require('../../models/GiftCard');
const GiftCardPurchase = require('../../models/GiftCardPurchase');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const runaApi = require('../../utils/runaApi');
const { createPaymentIntent } = require('../../config/stripe');
const { sendEmail } = require('../../utils/email');
const { sendPushNotification } = require('../../utils/pushNotification');
const { generateOrderId } = require('../../utils/helpers');

class GiftCardService {
  // Sync gift cards from Runa
  async syncGiftCardsFromRuna() {
    try {
      let afterCursor = null;
      let hasMore = true;
      let totalSynced = 0;

      while (hasMore) {
        const result = await runaApi.getCatalog({ limit: 500, after: afterCursor });

        if (!result.success) {
          throw new Error(result.error);
        }

        const products = result.data;

        if (!products || products.length === 0) {
          break;
        }

        for (const product of products) {
          const giftCardData = runaApi.mapProductToGiftCard(product);

          await GiftCard.findOneAndUpdate(
            { provider: 'runa', providerId: product.code },
            { $set: { ...giftCardData, lastSyncedAt: new Date() } },
            { upsert: true, new: true }
          );

          totalSynced++;
        }

        hasMore = result.pagination?.hasMore || false;
        afterCursor = result.pagination?.after;
      }

      return { message: `Synced ${totalSynced} gift cards` };
    } catch (error) {
      console.error('Gift card sync error:', error);
      throw error;
    }
  }

  // Get all gift cards with filters
  async getGiftCards(options = {}) {
    // Parse query params as integers
    const parsedOptions = {
      ...options,
      page: options.page ? parseInt(options.page, 10) : 1,
      limit: options.limit ? parseInt(options.limit, 10) : 20,
    };
    return GiftCard.searchCards(options.q, parsedOptions);
  }

  // Get gift card by ID
  async getGiftCardById(giftCardId) {
    const giftCard = await GiftCard.findById(giftCardId);

    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    return giftCard;
  }

  // Get gift cards by category
  async getGiftCardsByCategory(category, limit = 20) {
    if (category === 'popular') {
      return GiftCard.getPopular(limit);
    }

    if (category === 'featured') {
      return GiftCard.getFeatured(limit);
    }

    return GiftCard.getByCategory(category, limit);
  }

  // Get featured gift cards
  async getFeaturedGiftCards(limit = 10) {
    return GiftCard.getFeatured(limit);
  }

  // Get popular gift cards
  async getPopularGiftCards(limit = 20) {
    return GiftCard.getPopular(limit);
  }

  // Get all categories with counts
  async getCategories() {
    const categories = await GiftCard.aggregate([
      { $match: { isActive: true, isAvailable: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return categories.map((cat) => ({
      name: cat._id,
      count: cat.count,
    }));
  }

  // Purchase gift card
  async purchaseGiftCard(userId, purchaseData) {
    const {
      giftCardId,
      amount,
      quantity = 1,
      recipientType = 'self',
      recipientEmail,
      recipientName,
      recipientPhone,
      personalMessage,
      deliveryDate,
      deliveryMethod = 'email',
      paymentMethodId,
      useWalletBalance = false,
    } = purchaseData;

    // Get gift card
    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    if (!giftCard.checkAvailability()) {
      throw new Error('Gift card is not available');
    }

    // Validate amount
    if (giftCard.priceType === 'fixed') {
      if (!giftCard.fixedAmounts.includes(amount)) {
        throw new Error('Invalid amount for this gift card');
      }
    } else {
      if (amount < giftCard.minAmount || amount > giftCard.maxAmount) {
        throw new Error(`Amount must be between $${giftCard.minAmount} and $${giftCard.maxAmount}`);
      }
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate total
    const discount = giftCard.discount ? (amount * giftCard.discount) / 100 : 0;
    const totalPaid = (amount - discount) * quantity;

    let paymentIntent = null;
    let paymentMethod = 'card';

    // Handle wallet balance payment
    if (useWalletBalance) {
      const walletBalance = user.wallet?.balance || 0;
      if (walletBalance < totalPaid) {
        throw new Error(`Insufficient wallet balance. You have $${walletBalance.toFixed(2)} but need $${totalPaid.toFixed(2)}`);
      }
      // Deduct from wallet
      user.wallet.balance -= totalPaid;
      await user.save();
      paymentMethod = 'wallet';
    } else if (paymentMethodId === 'business_account') {
      // Business-initiated gift — charge the business's Stripe customer
      const Business = require('../../models/Business');
      const business = await Business.findById(purchaseData.businessId);
      if (!business || !business.stripeCustomerId) {
        throw new Error('Business does not have a payment method on file');
      }
      paymentIntent = await createPaymentIntent(
        totalPaid,
        giftCard.currency,
        business.stripeCustomerId,
        {
          type: 'business_gift_card_purchase',
          giftCardId: giftCardId.toString(),
          businessId: business._id.toString(),
          userId: userId.toString(),
        }
      );
      paymentMethod = 'business_account';
    } else if (paymentMethodId) {
      // Create payment intent with Stripe
      paymentIntent = await createPaymentIntent(
        totalPaid,
        giftCard.currency,
        user.stripeCustomerId,
        {
          type: 'gift_card_purchase',
          giftCardId: giftCardId.toString(),
          userId: userId.toString(),
        }
      );
    } else {
      throw new Error('Payment method or wallet balance required');
    }

    // Determine recipient
    let recipientId = null;
    if (recipientType === 'gift' && recipientEmail) {
      const recipient = await User.findOne({ email: recipientEmail });
      if (recipient) {
        recipientId = recipient._id;
      }
    }

    // Create purchase record
    const purchase = await GiftCardPurchase.create({
      buyerId: userId,
      giftCardId,
      amount,
      quantity,
      currency: giftCard.currency,
      discount,
      totalPaid,
      recipientType,
      recipientId,
      recipientEmail: recipientType === 'gift' ? recipientEmail : user.email,
      recipientPhone: recipientType === 'gift' ? recipientPhone : user.phone,
      recipientName: recipientType === 'gift' ? recipientName : user.fullName,
      personalMessage,
      deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
      deliveryMethod,
      provider: giftCard.provider,
      status: useWalletBalance ? 'completed' : 'processing',
      paymentMethod,
      paymentIntentId: paymentIntent?.id || null,
      paymentStatus: useWalletBalance ? 'succeeded' : 'pending',
    });

    // Create transaction record
    await Transaction.createPurchaseTransaction({
      userId,
      amount: totalPaid,
      status: useWalletBalance ? 'completed' : 'pending',
      paymentIntentId: paymentIntent?.id || null,
      paymentMethodId: useWalletBalance ? 'wallet' : paymentMethodId,
      purchaseId: purchase._id,
      description: `Purchase of ${giftCard.name} gift card`,
    });

    // Order from Runa
    try {
      const runaOrder = await runaApi.createOrder({
        productId: giftCard.providerProductId,
        amount,
        quantity,
        currency: giftCard.currency,
        recipientEmail: recipientType === 'gift' ? recipientEmail : user.email,
        recipientName: recipientType === 'gift' ? recipientName : user.fullName,
        senderName: user.fullName,
        senderEmail: user.email,
        personalMessage,
        webhookUrl: `${process.env.APP_URL}/api/webhooks/runa`,
      });

      if (runaOrder.success) {
        purchase.providerOrderId = runaOrder.orderId;
        purchase.providerStatus = 'pending';
        await purchase.save();
      }
    } catch (error) {
      console.error('Runa order error:', error);
      // Continue with purchase, handle provider order later
    }

    const response = {
      purchase: {
        id: purchase._id,
        orderId: generateOrderId(),
        amount,
        totalPaid,
        status: purchase.status,
        paymentMethod,
        giftCard: {
          name: giftCard.name,
          brandName: giftCard.brandName,
          image: giftCard.image,
        },
      },
    };

    // Only include paymentIntent for card payments
    if (paymentIntent) {
      response.paymentIntent = {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      };
    }

    // Include updated wallet balance for wallet payments
    if (useWalletBalance) {
      response.walletBalance = user.wallet.balance;
    }

    return response;
  }

  // Complete purchase (after payment confirmation)
  async completePurchase(purchaseId, redemptionCodes = []) {
    const purchase = await GiftCardPurchase.findById(purchaseId)
      .populate('giftCardId')
      .populate('buyerId');

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Add redemption codes
    if (redemptionCodes.length > 0) {
      purchase.redemptionCodes = redemptionCodes.map((code) => ({
        code: code.code,
        pin: code.pin,
        barcode: code.barcode,
        qrCode: code.qrCode,
        link: code.link,
        expiresAt: code.expiresAt,
        remainingBalance: purchase.amount,
      }));
    }

    purchase.status = 'completed';
    purchase.paymentStatus = 'succeeded';
    await purchase.save();

    // Update transaction
    await Transaction.findOneAndUpdate(
      { purchaseId: purchase._id },
      { status: 'completed', completedAt: new Date() }
    );

    // Decrement inventory
    await purchase.giftCardId.decrementInventory(purchase.quantity);

    // Send delivery if immediate
    if (!purchase.deliveryDate || new Date(purchase.deliveryDate) <= new Date()) {
      await this.deliverGiftCard(purchase);
    }

    return purchase;
  }

  // Deliver gift card
  async deliverGiftCard(purchase) {
    const giftCard = purchase.giftCardId;
    const buyer = purchase.buyerId;

    // Send email to recipient
    if (purchase.recipientEmail) {
      const redeemUrl = `${process.env.FRONTEND_URL}/redeem/${purchase._id}`;
      const firstCode = purchase.redemptionCodes?.[0];

      await sendEmail(purchase.recipientEmail, 'giftCardReceived', {
        recipientName: purchase.recipientName || 'there',
        senderName: buyer.fullName,
        giftCardName: giftCard.name,
        amount: purchase.amount,
        personalMessage: purchase.personalMessage,
        cardCode: firstCode?.code || '',
        cardPin: firstCode?.pin || '',
        claimCode: purchase.claimCode || null,
        redeemUrl,
      });
    }

    // Send push notification if recipient is a user
    if (purchase.recipientId) {
      const recipient = await User.findById(purchase.recipientId);
      if (recipient && recipient.deviceTokens.length > 0) {
        for (const deviceToken of recipient.deviceTokens) {
          await sendPushNotification(deviceToken.token, {
            title: '🎁 You received a gift card!',
            body: `${buyer.fullName} sent you a ${giftCard.name} gift card worth $${purchase.amount}`,
          }, {
            purchaseId: purchase._id.toString(),
            type: 'gift_received',
          });
        }
      }
    }

    // Notify sender
    await sendEmail(buyer.email, 'giftCardDelivered', {
      senderName: buyer.firstName,
      recipientName: purchase.recipientName,
      giftCardName: giftCard.name,
      amount: purchase.amount,
      viewUrl: `${process.env.FRONTEND_URL}/purchases/${purchase._id}`,
    });

    await purchase.markAsDelivered();

    return purchase;
  }

  // Get user purchases
  async getUserPurchases(userId, options = {}) {
    return GiftCardPurchase.getUserPurchases(userId, options);
  }

  // Get purchase by ID
  async getPurchaseById(purchaseId, userId) {
    const purchase = await GiftCardPurchase.findById(purchaseId)
      .populate('giftCardId')
      .populate('buyerId', 'firstName lastName email');

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Check if user has access
    if (purchase.buyerId._id.toString() !== userId.toString() &&
        purchase.recipientId?.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    return purchase;
  }

  // Get received gift cards
  async getReceivedGiftCards(userId, userEmail, options = {}) {
    return GiftCardPurchase.getReceivedGiftCards(userId, userEmail, options);
  }

  // Update balance tracking
  async updateBalanceTracking(purchaseId, codeIndex, spentAmount, notes, userId) {
    const purchase = await GiftCardPurchase.findById(purchaseId);

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Check access
    if (purchase.buyerId.toString() !== userId.toString() &&
        purchase.recipientId?.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await purchase.redeemCode(codeIndex || 0, spentAmount);

    return purchase;
  }

  // Cancel purchase
  async cancelPurchase(purchaseId, userId, reason = '') {
    const purchase = await GiftCardPurchase.findById(purchaseId);

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    if (purchase.buyerId.toString() !== userId.toString()) {
      throw new Error('Access denied');
    }

    await purchase.cancel(reason);

    return { message: 'Purchase cancelled' };
  }
}

module.exports = new GiftCardService();
