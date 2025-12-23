const axios = require('axios');
require('dotenv').config();

// Runa API client
class RunaApiClient {
  constructor() {
    this.client = null;
  }

  // Lazy initialize the client to ensure env vars are loaded
  getClient() {
    if (!this.client) {
      const apiKey = process.env.RUNA_API_KEY || '';
      const isPlayground = apiKey.toLowerCase().startsWith('xx');

      this.baseUrl = process.env.RUNA_API_URL ||
        (isPlayground ? 'https://playground.runa.io/v2' : 'https://api.runa.io/v2');
      this.apiKey = apiKey;

      console.log('Initializing Runa API client:', { baseUrl: this.baseUrl, hasApiKey: !!apiKey });

      this.client = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'X-Api-Key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      // Add response interceptor for error handling
      this.client.interceptors.response.use(
        (response) => response,
        (error) => {
          console.error('Runa API Error:', {
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url,
          });
          throw error;
        }
      );
    }
    return this.client;
  }

  // Get catalog of available gift cards
  async getCatalog(options = {}) {
    try {
      const params = {
        limit: options.limit || 500,
        is_orderable: true,
      };

      // Add country filter (Runa uses countries_redeemable_in)
      if (options.country) {
        params.countries_redeemable_in = options.country;
      }

      // Add category filter (Runa uses categories)
      if (options.category) {
        params.categories = options.category;
      }

      // Cursor-based pagination
      if (options.after) {
        params.after = options.after;
      }

      const response = await this.getClient().get('/product', { params });
      return {
        success: true,
        data: response.data.catalog || response.data.products || response.data,
        pagination: {
          before: response.data.before,
          after: response.data.after,
          hasMore: !!response.data.after,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get single product details
  async getProduct(productCode) {
    try {
      const response = await this.getClient().get(`/product/${productCode}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get product inventory/availability
  async getProductAvailability(productId) {
    try {
      const response = await this.getClient().get(`/products/${productId}/availability`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Create an order (purchase gift cards)
  async createOrder(orderData) {
    try {
      const payload = {
        product_id: orderData.productId,
        amount: orderData.amount,
        quantity: orderData.quantity || 1,
        currency: orderData.currency || 'USD',
        recipient: {
          email: orderData.recipientEmail,
          name: orderData.recipientName,
          message: orderData.personalMessage,
        },
        sender: {
          name: orderData.senderName,
          email: orderData.senderEmail,
        },
        delivery: {
          method: orderData.deliveryMethod || 'email',
          scheduled_at: orderData.scheduledDelivery || null,
        },
        metadata: orderData.metadata || {},
        webhook_url: orderData.webhookUrl,
      };

      const response = await this.getClient().post('/orders', payload);
      return {
        success: true,
        data: response.data,
        orderId: response.data.id || response.data.order_id,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  // Get order details
  async getOrder(orderId) {
    try {
      const response = await this.getClient().get(`/orders/${orderId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get order status
  async getOrderStatus(orderId) {
    try {
      const response = await this.getClient().get(`/orders/${orderId}/status`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get redemption code for an order
  async getRedemptionCode(orderId) {
    try {
      const response = await this.getClient().get(`/orders/${orderId}/codes`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Cancel an order (if possible)
  async cancelOrder(orderId, reason = '') {
    try {
      const response = await this.getClient().post(`/orders/${orderId}/cancel`, { reason });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Resend order delivery
  async resendOrder(orderId, email = null) {
    try {
      const payload = email ? { email } : {};
      const response = await this.getClient().post(`/orders/${orderId}/resend`, payload);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get account balance
  async getBalance() {
    try {
      const response = await this.getClient().get('/account/balance');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get transaction history
  async getTransactions(options = {}) {
    try {
      const params = {
        page: options.page || 1,
        limit: options.limit || 50,
        start_date: options.startDate,
        end_date: options.endDate,
      };

      const response = await this.getClient().get('/transactions', { params });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Get available categories
  async getCategories() {
    try {
      const response = await this.getClient().get('/categories');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  // Validate webhook signature
  validateWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return signature === expectedSignature;
  }

  // Map Runa product to our GiftCard schema
  mapProductToGiftCard(product) {
    const giftCard = product.gift_card || {};
    const denominations = giftCard.denominations || {};
    const assets = giftCard.assets || {};
    const contentResources = giftCard.content_resources || {};

    // Parse fixed amounts from available_list or generate from min/max
    let fixedAmounts = [];
    if (denominations.type === 'fixed' && denominations.available_list) {
      fixedAmounts = denominations.available_list
        .map(v => parseFloat(v))
        .filter(v => !isNaN(v));
    }

    return {
      provider: 'runa',
      providerId: product.code,
      providerProductId: product.code,
      brandName: product.name,
      name: product.name,
      description: null, // Fetch from content_resources URL if needed
      image: assets.card_image_url,
      brandLogo: assets.icon_image_url,
      category: this.mapCategory(product.categories?.[0]),
      priceType: denominations.type === 'fixed' ? 'fixed' : 'variable',
      fixedAmounts: fixedAmounts,
      minAmount: parseFloat(denominations.minimum_value) || 5,
      maxAmount: parseFloat(denominations.maximum_value) || 500,
      currency: product.currency || 'USD',
      countries: product.countries_redeemable_in || ['US'],
      redemptionType: giftCard.redeemable_at || 'online',
      redemptionInstructions: contentResources.redemption_instructions_markdown_url,
      termsAndConditions: contentResources.terms_consumer_markdown_url,
      isAvailable: product.is_orderable !== false && product.state === 'LIVE',
    };
  }

  // Map Runa category to our category enum
  mapCategory(runaCategory) {
    const categoryMap = {
      'shopping': 'retail',
      'food': 'restaurants',
      'coffee': 'coffee',
      'pet': 'pets',
      'travel': 'travel',
      'gas': 'gas',
      'entertainment': 'entertainment',
      'health': 'health',
      'sports': 'sports',
      'gifts': 'gifts',
      'amazon': 'amazon',
    };

    const lowerCategory = (runaCategory || '').toLowerCase();
    for (const [key, value] of Object.entries(categoryMap)) {
      if (lowerCategory.includes(key)) {
        return value;
      }
    }
    return 'other';
  }
}

// Singleton instance
const runaClient = new RunaApiClient();

module.exports = runaClient;
