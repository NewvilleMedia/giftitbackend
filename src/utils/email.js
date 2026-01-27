const { Resend } = require('resend');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Email templates
const templates = {
  welcome: (data) => ({
    subject: `Welcome to ${process.env.APP_NAME}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Welcome to ${process.env.APP_NAME}!</h1>
        <p>Hi ${data.firstName},</p>
        <p>Thank you for joining ${process.env.APP_NAME}! We're excited to have you on board.</p>
        <p>Start exploring our gift card marketplace and discover amazing deals.</p>
        <a href="${process.env.FRONTEND_URL}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Get Started</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The ${process.env.APP_NAME} Team</p>
      </div>
    `,
  }),

  emailVerification: (data) => ({
    subject: `Verify your email - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Verify Your Email</h1>
        <p>Hi ${data.firstName},</p>
        <p>Please click the button below to verify your email address:</p>
        <a href="${data.verificationUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Verify Email</a>
        <p style="margin-top: 20px; color: #666;">This link expires in 24 hours.</p>
        <p style="color: #666;">If you didn't create an account, please ignore this email.</p>
      </div>
    `,
  }),

  passwordReset: (data) => ({
    subject: `Reset your password - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Reset Your Password</h1>
        <p>Hi ${data.firstName},</p>
        <p>You requested to reset your password. Use the code below to reset it:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${data.resetCode}</span>
        </div>
        <p style="color: #666;">This code expires in 1 hour.</p>
        <p style="color: #666;">If you didn't request this, please ignore this email.</p>
      </div>
    `,
  }),

  passwordChanged: (data) => ({
    subject: `Password changed - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Password Changed</h1>
        <p>Hi ${data.firstName},</p>
        <p>Your password has been successfully changed.</p>
        <p style="color: #666;">If you didn't make this change, please contact support immediately.</p>
      </div>
    `,
  }),

  giftCardReceived: (data) => ({
    subject: `You received a gift card! - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">🎁 You've Got a Gift!</h1>
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.senderName}</strong> sent you a <strong>${data.giftCardName}</strong> gift card worth <strong>$${data.amount}</strong>!</p>
        ${data.personalMessage ? `<p style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; font-style: italic;">"${data.personalMessage}"</p>` : ''}
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Card Code:</strong> ${data.cardCode}</p>
          ${data.cardPin ? `<p style="margin: 10px 0 0 0;"><strong>PIN:</strong> ${data.cardPin}</p>` : ''}
        </div>
        <a href="${data.redeemUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">View Gift Card</a>
        <p style="margin-top: 30px; color: #666;">Enjoy your gift!</p>
      </div>
    `,
  }),

  giftCardDelivered: (data) => ({
    subject: `Your gift card was delivered! - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Gift Card Delivered ✓</h1>
        <p>Hi ${data.senderName},</p>
        <p>Your <strong>${data.giftCardName}</strong> gift card worth <strong>$${data.amount}</strong> has been delivered to <strong>${data.recipientName}</strong>.</p>
        <a href="${data.viewUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">View Details</a>
      </div>
    `,
  }),

  subscriptionReminder: (data) => ({
    subject: `Upcoming subscription delivery - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Subscription Reminder</h1>
        <p>Hi ${data.firstName},</p>
        <p>Your subscription for <strong>${data.giftCardName}</strong> ($${data.amount}) will be processed tomorrow.</p>
        <p>Recipient: <strong>${data.recipientName}</strong></p>
        <a href="${data.manageUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Manage Subscription</a>
      </div>
    `,
  }),

  purchaseConfirmation: (data) => ({
    subject: `Purchase Confirmation - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Purchase Confirmed! 🎉</h1>
        <p>Hi ${data.firstName},</p>
        <p>Your purchase of <strong>${data.giftCardName}</strong> has been confirmed.</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Amount:</strong> $${data.amount}</p>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          ${data.cardCode ? `<p><strong>Card Code:</strong> ${data.cardCode}</p>` : ''}
          ${data.cardPin ? `<p><strong>PIN:</strong> ${data.cardPin}</p>` : ''}
          ${data.recipientName !== data.firstName ? `<p><strong>Recipient:</strong> ${data.recipientName}</p>` : ''}
        </div>
        <a href="${data.viewUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">View Purchase</a>
      </div>
    `,
  }),

  businessWelcome: (data) => ({
    subject: `Welcome to ${process.env.APP_NAME} Business!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">Welcome to ${process.env.APP_NAME} Business!</h1>
        <p>Hi ${data.firstName},</p>
        <p>Your business account for <strong>${data.businessName}</strong> has been created successfully.</p>
        <p>You can now:</p>
        <ul>
          <li>Manage employee gift card distributions</li>
          <li>Create campaigns for special occasions</li>
          <li>Track spending and analytics</li>
        </ul>
        <a href="${process.env.ADMIN_URL}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">Go to Dashboard</a>
      </div>
    `,
  }),

  campaignNotification: (data) => ({
    subject: `${data.subject} - ${process.env.APP_NAME}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #00D632;">${data.title}</h1>
        <p>${data.message}</p>
        ${data.actionUrl ? `<a href="${data.actionUrl}" style="display: inline-block; background-color: #00D632; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px;">${data.actionText || 'View Details'}</a>` : ''}
      </div>
    `,
  }),
};

// Send email function using Resend
const sendEmail = async (to, template, data) => {
  try {
    const { subject, html } = templates[template](data);

    const { data: result, error } = await resend.emails.send({
      from: `${process.env.APP_NAME} <${process.env.EMAIL_FROM}>`,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent:', result.id);
    return { success: true, messageId: result.id };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error: error.message };
  }
};

// Send bulk emails
const sendBulkEmails = async (recipients, template, getData) => {
  const results = [];

  for (const recipient of recipients) {
    const data = typeof getData === 'function' ? getData(recipient) : getData;
    const result = await sendEmail(recipient.email, template, data);
    results.push({ email: recipient.email, ...result });

    // Add small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
};

// Verify email connection (for Resend, just check if API key exists)
const verifyConnection = async () => {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('Resend API key not configured');
      return false;
    }
    console.log('Resend email service configured');
    return true;
  } catch (error) {
    console.error('Email service configuration failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmails,
  verifyConnection,
  templates,
};
