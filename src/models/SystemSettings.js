const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
    },
    category: {
      type: String,
      enum: ['general', 'payments', 'notifications', 'security', 'features', 'limits', 'branding'],
      default: 'general',
    },
    isPublic: {
      type: Boolean,
      default: false, // If true, can be fetched without auth
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
systemSettingsSchema.index({ key: 1 }, { unique: true });
systemSettingsSchema.index({ category: 1 });

// Static method to get setting by key
systemSettingsSchema.statics.get = async function (key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set a setting
systemSettingsSchema.statics.set = async function (key, value, options = {}) {
  const { description, category, isPublic, updatedBy } = options;

  return this.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        ...(description && { description }),
        ...(category && { category }),
        ...(isPublic !== undefined && { isPublic }),
        ...(updatedBy && { lastUpdatedBy: updatedBy }),
      },
    },
    { upsert: true, new: true }
  );
};

// Static method to get all settings by category
systemSettingsSchema.statics.getByCategory = async function (category) {
  return this.find({ category }).sort({ key: 1 });
};

// Static method to get all settings
systemSettingsSchema.statics.getAll = async function (publicOnly = false) {
  const filter = publicOnly ? { isPublic: true } : {};
  return this.find(filter).sort({ category: 1, key: 1 });
};

// Static method to get multiple settings at once
systemSettingsSchema.statics.getMany = async function (keys) {
  const settings = await this.find({ key: { $in: keys } });

  const result = {};
  for (const setting of settings) {
    result[setting.key] = setting.value;
  }

  return result;
};

// Static method to initialize default settings
systemSettingsSchema.statics.initializeDefaults = async function () {
  const defaults = [
    // General
    { key: 'app_name', value: 'GiftIt', category: 'general', description: 'Application name' },
    { key: 'support_email', value: 'support@giftit.com', category: 'general', description: 'Support email address' },
    { key: 'maintenance_mode', value: false, category: 'general', description: 'Enable maintenance mode' },

    // Payments
    { key: 'min_purchase_amount', value: 5, category: 'payments', description: 'Minimum purchase amount in USD' },
    { key: 'max_purchase_amount', value: 500, category: 'payments', description: 'Maximum purchase amount in USD' },
    { key: 'wallet_max_balance', value: 10000, category: 'payments', description: 'Maximum wallet balance in USD' },
    { key: 'wallet_min_add', value: 10, category: 'payments', description: 'Minimum amount to add to wallet' },
    { key: 'wallet_max_add', value: 1000, category: 'payments', description: 'Maximum amount to add to wallet' },

    // Notifications
    { key: 'email_notifications_enabled', value: true, category: 'notifications', description: 'Enable email notifications' },
    { key: 'push_notifications_enabled', value: true, category: 'notifications', description: 'Enable push notifications' },
    { key: 'sms_notifications_enabled', value: false, category: 'notifications', description: 'Enable SMS notifications' },

    // Security
    { key: 'max_login_attempts', value: 5, category: 'security', description: 'Max failed login attempts before lockout' },
    { key: 'lockout_duration_minutes', value: 30, category: 'security', description: 'Account lockout duration in minutes' },
    { key: 'password_min_length', value: 8, category: 'security', description: 'Minimum password length' },
    { key: 'session_timeout_days', value: 7, category: 'security', description: 'Session timeout in days' },

    // Features
    { key: 'subscriptions_enabled', value: true, category: 'features', description: 'Enable subscription feature' },
    { key: 'business_accounts_enabled', value: true, category: 'features', description: 'Enable business accounts' },
    { key: 'referral_program_enabled', value: false, category: 'features', description: 'Enable referral program' },
    { key: 'promo_codes_enabled', value: true, category: 'features', description: 'Enable promo codes' },

    // Limits
    { key: 'daily_purchase_limit', value: 5000, category: 'limits', description: 'Daily purchase limit per user in USD' },
    { key: 'monthly_purchase_limit', value: 25000, category: 'limits', description: 'Monthly purchase limit per user in USD' },
    { key: 'max_gift_cards_per_order', value: 10, category: 'limits', description: 'Maximum gift cards per order' },

    // Branding
    { key: 'primary_color', value: '#00D632', category: 'branding', description: 'Primary brand color', isPublic: true },
    { key: 'logo_url', value: '', category: 'branding', description: 'Logo URL', isPublic: true },
    { key: 'favicon_url', value: '', category: 'branding', description: 'Favicon URL', isPublic: true },
  ];

  for (const setting of defaults) {
    await this.findOneAndUpdate(
      { key: setting.key },
      { $setOnInsert: setting },
      { upsert: true }
    );
  }

  return { message: 'Default settings initialized' };
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
