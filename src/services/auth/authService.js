const crypto = require('crypto');
const User = require('../../models/User');
const {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../../middleware/auth');
const { sendEmail } = require('../../utils/email');
const { generateRandomString, hashString } = require('../../utils/helpers');
const { createCustomer } = require('../../config/stripe');

class AuthService {
  // Register new user
  async register(userData) {
    const { email, password, firstName, lastName, phone } = userData;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Create Stripe customer
    let stripeCustomerId = null;
    try {
      const stripeCustomer = await createCustomer(email, `${firstName} ${lastName}`);
      stripeCustomerId = stripeCustomer.id;
    } catch (error) {
      console.error('Stripe customer creation failed:', error);
    }

    // Generate email verification token
    const verificationToken = generateRandomString(32);
    const hashedToken = hashString(verificationToken);

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      stripeCustomerId,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail(email, 'emailVerification', {
      firstName,
      verificationUrl,
    });

    // Send welcome email
    await sendEmail(email, 'welcome', { firstName });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  // Login user
  async login(email, password, deviceInfo = {}) {
    // Find user with password
    const user = await User.findByEmailWithPassword(email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      throw new Error('Account is locked. Please try again later.');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incrementLoginAttempts();
      throw new Error('Invalid email or password');
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Add device token if provided
    if (deviceInfo.token && deviceInfo.platform) {
      const existingToken = user.deviceTokens.find(
        (dt) => dt.token === deviceInfo.token
      );
      if (!existingToken) {
        user.deviceTokens.push({
          token: deviceInfo.token,
          platform: deviceInfo.platform,
        });
        await user.save();
      }
    }

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  // Refresh access token
  async refreshToken(token) {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    const accessToken = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    return { accessToken, refreshToken };
  }

  // Verify email
  async verifyEmail(token) {
    const hashedToken = hashString(token);

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }

  // Resend verification email
  async resendVerificationEmail(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.isEmailVerified) {
      throw new Error('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = generateRandomString(32);
    const hashedToken = hashString(verificationToken);

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    await sendEmail(user.email, 'emailVerification', {
      firstName: user.firstName,
      verificationUrl,
    });

    return { message: 'Verification email sent' };
  }

  // Forgot password
  async forgotPassword(email) {
    const user = await User.findOne({ email });

    if (!user) {
      // Return success even if user not found (security)
      return { message: 'If an account exists, a password reset email has been sent' };
    }

    // Generate reset token
    const resetToken = generateRandomString(32);
    const hashedToken = hashString(resetToken);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await sendEmail(email, 'passwordReset', {
      firstName: user.firstName,
      resetUrl,
    });

    return { message: 'If an account exists, a password reset email has been sent' };
  }

  // Reset password
  async resetPassword(token, newPassword) {
    const hashedToken = hashString(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Send confirmation email
    await sendEmail(user.email, 'passwordChanged', {
      firstName: user.firstName,
    });

    return { message: 'Password reset successfully' };
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('User not found');
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    // Send confirmation email
    await sendEmail(user.email, 'passwordChanged', {
      firstName: user.firstName,
    });

    return { message: 'Password changed successfully' };
  }

  // Logout (remove device token)
  async logout(userId, deviceToken = null) {
    if (deviceToken) {
      await User.findByIdAndUpdate(userId, {
        $pull: { deviceTokens: { token: deviceToken } },
      });
    }
    return { message: 'Logged out successfully' };
  }

  // Get current user
  async getCurrentUser(userId) {
    const user = await User.findById(userId)
      .populate('businessId', 'name slug logo');

    if (!user) {
      throw new Error('User not found');
    }

    return this.sanitizeUser(user);
  }

  // Sanitize user data (remove sensitive fields)
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

module.exports = new AuthService();
