const User = require('../../models/User');
const Transaction = require('../../models/Transaction');
const { uploadToS3, deleteFromS3 } = require('../../config/aws');
const {
  createCustomer,
  attachPaymentMethod,
  detachPaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
  createPaymentIntent,
} = require('../../config/stripe');
const { generateAffiliateCode } = require('../../utils/helpers');

class UserService {
  // Get user profile
  async getProfile(userId) {
    const user = await User.findById(userId)
      .populate('businessId', 'name slug logo')
      .populate('referredBy', 'firstName lastName email');

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  // Update user profile
  async updateProfile(userId, updateData) {
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'dateOfBirth',
      'address',
      'preferences',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'address' || field === 'preferences') {
          updates[field] = { ...updateData[field] };
        } else {
          updates[field] = updateData[field];
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('businessId', 'name slug logo');

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  // Update avatar
  async updateAvatar(userId, file) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Delete old avatar if exists
    if (user.avatar) {
      try {
        const oldKey = user.avatar.split('/').slice(-2).join('/');
        await deleteFromS3(oldKey);
      } catch (error) {
        console.error('Error deleting old avatar:', error);
      }
    }

    // Upload new avatar
    const result = await uploadToS3(file, 'avatars');

    user.avatar = result.cloudFrontUrl || result.location;
    await user.save();

    return { avatar: user.avatar };
  }

  // Delete avatar
  async deleteAvatar(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.avatar) {
      try {
        const key = user.avatar.split('/').slice(-2).join('/');
        await deleteFromS3(key);
      } catch (error) {
        console.error('Error deleting avatar:', error);
      }
    }

    user.avatar = null;
    await user.save();

    return { message: 'Avatar deleted' };
  }

  // Get payment methods
  async getPaymentMethods(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.stripeCustomerId) {
      return { paymentMethods: [] };
    }

    const methods = await listPaymentMethods(user.stripeCustomerId);

    return {
      paymentMethods: methods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
        isDefault: pm.id === user.defaultPaymentMethodId,
      })),
    };
  }

  // Add payment method
  async addPaymentMethod(userId, paymentMethodId, setAsDefault = false) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Create Stripe customer if doesn't exist
    if (!user.stripeCustomerId) {
      const customer = await createCustomer(user.email, user.fullName);
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    // Attach payment method to customer
    await attachPaymentMethod(paymentMethodId, user.stripeCustomerId);

    // Set as default if requested or first payment method
    if (setAsDefault || !user.defaultPaymentMethodId) {
      await setDefaultPaymentMethod(user.stripeCustomerId, paymentMethodId);
      user.defaultPaymentMethodId = paymentMethodId;
      await user.save();
    }

    return { message: 'Payment method added successfully' };
  }

  // Remove payment method
  async removePaymentMethod(userId, paymentMethodId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    await detachPaymentMethod(paymentMethodId);

    // Update default if needed
    if (user.defaultPaymentMethodId === paymentMethodId) {
      const methods = await listPaymentMethods(user.stripeCustomerId);
      if (methods.data.length > 0) {
        user.defaultPaymentMethodId = methods.data[0].id;
        await setDefaultPaymentMethod(user.stripeCustomerId, methods.data[0].id);
      } else {
        user.defaultPaymentMethodId = null;
      }
      await user.save();
    }

    return { message: 'Payment method removed successfully' };
  }

  // Set default payment method
  async setDefaultPaymentMethod(userId, paymentMethodId) {
    const user = await User.findById(userId);

    if (!user || !user.stripeCustomerId) {
      throw new Error('User not found or no payment methods');
    }

    await setDefaultPaymentMethod(user.stripeCustomerId, paymentMethodId);
    user.defaultPaymentMethodId = paymentMethodId;
    await user.save();

    return { message: 'Default payment method updated' };
  }

  // Get wallet balance
  async getWalletBalance(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      balance: user.wallet.balance,
      currency: user.wallet.currency,
    };
  }

  // Add funds to wallet
  async addWalletFunds(userId, amount, paymentMethodId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.stripeCustomerId) {
      throw new Error('No payment methods available');
    }

    // Create payment intent
    const paymentIntent = await createPaymentIntent(
      amount,
      user.wallet.currency,
      user.stripeCustomerId,
      { type: 'wallet_credit', userId: userId.toString() }
    );

    // For simplicity, assuming payment succeeds
    // In production, handle payment confirmation via webhook
    const balanceBefore = user.wallet.balance;
    user.wallet.balance += amount;
    await user.save();

    // Create transaction record
    await Transaction.createWalletTransaction({
      userId,
      type: 'wallet_credit',
      amount,
      description: 'Wallet credit',
      balanceBefore,
      balanceAfter: user.wallet.balance,
    });

    return {
      balance: user.wallet.balance,
      currency: user.wallet.currency,
      transactionId: paymentIntent.id,
    };
  }

  // Deduct wallet balance
  async deductWalletBalance(userId, amount, description = 'Purchase') {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const balanceBefore = user.wallet.balance;
    user.wallet.balance -= amount;
    await user.save();

    // Create transaction record
    const transaction = await Transaction.createWalletTransaction({
      userId,
      type: 'wallet_debit',
      amount,
      description,
      balanceBefore,
      balanceAfter: user.wallet.balance,
    });

    return {
      balance: user.wallet.balance,
      transactionId: transaction._id,
    };
  }

  // Get or create affiliate code
  async getAffiliateCode(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.affiliateCode) {
      user.affiliateCode = generateAffiliateCode();
      await user.save();
    }

    return { affiliateCode: user.affiliateCode };
  }

  // Get referral stats
  async getReferralStats(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const referrals = await User.countDocuments({ referredBy: userId });

    return {
      affiliateCode: user.affiliateCode,
      totalReferrals: referrals,
    };
  }

  // Add device token
  async addDeviceToken(userId, token, platform) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Remove existing token if present
    user.deviceTokens = user.deviceTokens.filter((dt) => dt.token !== token);

    // Add new token
    user.deviceTokens.push({ token, platform });
    await user.save();

    return { message: 'Device token added' };
  }

  // Remove device token
  async removeDeviceToken(userId, token) {
    await User.findByIdAndUpdate(userId, {
      $pull: { deviceTokens: { token } },
    });

    return { message: 'Device token removed' };
  }

  // Deactivate account
  async deactivateAccount(userId) {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    return { message: 'Account deactivated' };
  }

  // Delete account
  async deleteAccount(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Delete avatar if exists
    if (user.avatar) {
      try {
        const key = user.avatar.split('/').slice(-2).join('/');
        await deleteFromS3(key);
      } catch (error) {
        console.error('Error deleting avatar:', error);
      }
    }

    await User.findByIdAndDelete(userId);

    return { message: 'Account deleted' };
  }

  // Sanitize user data
  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;

    delete userObj.password;
    delete userObj.emailVerificationToken;
    delete userObj.emailVerificationExpires;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpires;
    delete userObj.loginAttempts;
    delete userObj.lockUntil;

    return userObj;
  }
}

module.exports = new UserService();
