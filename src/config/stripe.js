const Stripe = require('stripe');

// Initialize Stripe only if API key is provided
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const checkStripeConfigured = () => {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables.');
  }
};

// Create a customer
const createCustomer = async (email, name, metadata = {}) => {
  return await stripe.customers.create({
    email,
    name,
    metadata,
  });
};

// Get customer by ID
const getCustomer = async (customerId) => {
  return await stripe.customers.retrieve(customerId);
};

// Update customer
const updateCustomer = async (customerId, data) => {
  return await stripe.customers.update(customerId, data);
};

// Create payment intent
const createPaymentIntent = async (amount, currency = 'usd', customerId, metadata = {}) => {
  return await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    customer: customerId,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  });
};

// Confirm payment intent
const confirmPaymentIntent = async (paymentIntentId, paymentMethodId) => {
  return await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
};

// Create setup intent for saving cards
const createSetupIntent = async (customerId) => {
  return await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });
};

// Attach payment method to customer
const attachPaymentMethod = async (paymentMethodId, customerId) => {
  return await stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
};

// Detach payment method
const detachPaymentMethod = async (paymentMethodId) => {
  return await stripe.paymentMethods.detach(paymentMethodId);
};

// List customer payment methods
const listPaymentMethods = async (customerId, type = 'card') => {
  return await stripe.paymentMethods.list({
    customer: customerId,
    type,
  });
};

// Set default payment method
const setDefaultPaymentMethod = async (customerId, paymentMethodId) => {
  return await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
};

// Create refund
const createRefund = async (paymentIntentId, amount = null) => {
  const params = { payment_intent: paymentIntentId };
  if (amount) {
    params.amount = Math.round(amount * 100);
  }
  return await stripe.refunds.create(params);
};

// Create subscription
const createSubscription = async (customerId, priceId, metadata = {}) => {
  return await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata,
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });
};

// Cancel subscription
const cancelSubscription = async (subscriptionId) => {
  return await stripe.subscriptions.cancel(subscriptionId);
};

// Pause subscription
const pauseSubscription = async (subscriptionId) => {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: { behavior: 'void' },
  });
};

// Resume subscription
const resumeSubscription = async (subscriptionId) => {
  return await stripe.subscriptions.update(subscriptionId, {
    pause_collection: '',
  });
};

// Webhook signature verification
const verifyWebhookSignature = (payload, signature) => {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

module.exports = {
  stripe,
  checkStripeConfigured,
  createCustomer,
  getCustomer,
  updateCustomer,
  createPaymentIntent,
  confirmPaymentIntent,
  createSetupIntent,
  attachPaymentMethod,
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  createRefund,
  createSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  verifyWebhookSignature,
};
