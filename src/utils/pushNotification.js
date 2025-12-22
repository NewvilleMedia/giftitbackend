const admin = require('firebase-admin');

// Initialize Firebase Admin (only if credentials are provided)
let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) return true;

  try {
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      firebaseInitialized = true;
      console.log('Firebase Admin initialized');
      return true;
    }
    console.warn('Firebase credentials not provided');
    return false;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return false;
  }
};

// Send push notification to single device
const sendPushNotification = async (token, notification, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...data,
        click_action: data.actionUrl || '',
      },
      apns: {
        payload: {
          aps: {
            badge: data.badge || 1,
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'giftit_notifications',
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Push notification error:', error);

    // Handle invalid token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Invalid token', invalidToken: true };
    }

    return { success: false, error: error.message };
  }
};

// Send push notification to multiple devices
const sendMulticastPushNotification = async (tokens, notification, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || tokens.length === 0) {
    return { success: false, error: 'No tokens provided' };
  }

  try {
    const message = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...data,
        click_action: data.actionUrl || '',
      },
      apns: {
        payload: {
          aps: {
            badge: data.badge || 1,
            sound: 'default',
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'giftit_notifications',
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    const results = {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens: [],
    };

    // Collect invalid tokens
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        if (resp.error.code === 'messaging/invalid-registration-token' ||
            resp.error.code === 'messaging/registration-token-not-registered') {
          results.invalidTokens.push(tokens[idx]);
        }
      }
    });

    return { success: true, ...results };
  } catch (error) {
    console.error('Multicast push notification error:', error);
    return { success: false, error: error.message };
  }
};

// Send push notification to topic
const sendTopicPushNotification = async (topic, notification, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
      },
      data: {
        ...data,
        click_action: data.actionUrl || '',
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Topic push notification error:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe token to topic
const subscribeToTopic = async (tokens, topic) => {
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error('Topic subscription error:', error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe token from topic
const unsubscribeFromTopic = async (tokens, topic) => {
  if (!initializeFirebase()) {
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error('Topic unsubscription error:', error);
    return { success: false, error: error.message };
  }
};

// Notification templates
const notificationTemplates = {
  giftReceived: (data) => ({
    title: '🎁 You received a gift card!',
    body: `${data.senderName} sent you a ${data.giftCardName} gift card worth $${data.amount}`,
  }),

  giftDelivered: (data) => ({
    title: 'Gift card delivered ✓',
    body: `Your gift card to ${data.recipientName} has been delivered`,
  }),

  subscriptionReminder: (data) => ({
    title: 'Subscription reminder',
    body: `Your ${data.giftCardName} ($${data.amount}) subscription will be processed tomorrow`,
  }),

  subscriptionProcessed: (data) => ({
    title: 'Subscription processed ✓',
    body: `Your ${data.giftCardName} ($${data.amount}) has been sent`,
  }),

  paymentSuccess: (data) => ({
    title: 'Payment successful',
    body: `Your payment of $${data.amount} has been processed`,
  }),

  paymentFailed: (data) => ({
    title: 'Payment failed',
    body: `Your payment of $${data.amount} could not be processed. Please update your payment method.`,
  }),

  campaignStarted: (data) => ({
    title: 'Campaign started',
    body: `Your campaign "${data.campaignName}" has started sending gift cards`,
  }),

  campaignCompleted: (data) => ({
    title: 'Campaign completed',
    body: `Your campaign "${data.campaignName}" has been completed. ${data.sentCount} gift cards sent.`,
  }),
};

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendMulticastPushNotification,
  sendTopicPushNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
  notificationTemplates,
};
