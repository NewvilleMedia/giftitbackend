const express = require('express');
const router = express.Router();
const { verifyWebhookSignature } = require('../config/stripe');
const giftCardService = require('../services/giftcard');
const notificationService = require('../services/notification');
const Transaction = require('../models/Transaction');
const GiftCardPurchase = require('../models/GiftCardPurchase');
const Business = require('../models/Business');
const { asyncHandler } = require('../middleware/errorHandler');

// Stripe webhook
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    let event;
    try {
      event = verifyWebhookSignature(req.body, signature);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        // Update transaction
        const transaction = await Transaction.findOne({
          paymentIntentId: paymentIntent.id,
        });

        if (transaction) {
          // Wallet top-up: credit the business wallet (idempotent — only if not already completed)
          const isWalletTopUp =
            paymentIntent.metadata?.kind === 'business_wallet_topup' ||
            transaction.metadata?.get?.('kind') === 'business_wallet_topup' ||
            transaction.metadata?.kind === 'business_wallet_topup';

          if (isWalletTopUp && transaction.status !== 'completed' && transaction.businessId) {
            const business = await Business.findById(transaction.businessId);
            if (business) {
              business.walletBalance = (business.walletBalance || 0) + transaction.amount;
              await business.save();
            }
          }

          await transaction.complete();

          // Complete purchase if it's a gift card purchase
          if (transaction.purchaseId) {
            await giftCardService.completePurchase(transaction.purchaseId);
          }

          // Notify user
          await notificationService.notifyPaymentSuccess(
            transaction.userId,
            transaction.amount
          );
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        // Update transaction
        const transaction = await Transaction.findOne({
          paymentIntentId: paymentIntent.id,
        });

        if (transaction) {
          await transaction.fail(
            paymentIntent.last_payment_error?.message || 'Payment failed',
            paymentIntent.last_payment_error?.code
          );

          // Update purchase status
          if (transaction.purchaseId) {
            await GiftCardPurchase.findByIdAndUpdate(transaction.purchaseId, {
              status: 'failed',
              paymentStatus: 'failed',
            });
          }

          // Notify user
          await notificationService.notifyPaymentFailed(
            transaction.userId,
            transaction.amount,
            paymentIntent.last_payment_error?.message || 'Payment failed'
          );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Handle Stripe subscription events
        const subscription = event.data.object;
        console.log(`Subscription ${event.type}:`, subscription.id);
        break;
      }

      case 'invoice.payment_succeeded': {
        // Handle successful invoice payment
        const invoice = event.data.object;
        console.log('Invoice paid:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        // Handle failed invoice payment
        const invoice = event.data.object;
        console.log('Invoice payment failed:', invoice.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  })
);

// Runa webhook
router.post(
  '/runa',
  asyncHandler(async (req, res) => {
    const { event_type, data } = req.body;

    console.log('Runa webhook received:', event_type);

    switch (event_type) {
      case 'order.completed': {
        // Order has been fulfilled
        const orderId = data.order_id;
        const purchase = await GiftCardPurchase.findOne({
          providerOrderId: orderId,
        });

        if (purchase) {
          purchase.providerStatus = 'completed';
          purchase.redemptionCodes = data.codes?.map((code) => ({
            code: code.code,
            pin: code.pin,
            barcode: code.barcode,
            link: code.link,
            expiresAt: code.expires_at,
            remainingBalance: purchase.amount,
          })) || [];

          await purchase.save();

          // Deliver gift card
          await giftCardService.deliverGiftCard(purchase);
        }
        break;
      }

      case 'order.failed': {
        // Order failed
        const orderId = data.order_id;
        const purchase = await GiftCardPurchase.findOne({
          providerOrderId: orderId,
        });

        if (purchase) {
          purchase.providerStatus = 'failed';
          purchase.status = 'failed';
          purchase.notes = data.failure_reason;
          await purchase.save();
        }
        break;
      }

      case 'order.delivered': {
        // Order has been delivered
        const orderId = data.order_id;
        const purchase = await GiftCardPurchase.findOne({
          providerOrderId: orderId,
        });

        if (purchase) {
          await purchase.markAsDelivered();
        }
        break;
      }

      default:
        console.log(`Unhandled Runa event: ${event_type}`);
    }

    res.json({ received: true });
  })
);

module.exports = router;
