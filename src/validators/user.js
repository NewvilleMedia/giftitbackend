const { body, param, query } = require('express-validator');

const updateProfileValidator = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('address.street')
    .optional()
    .trim()
    .isLength({ max: 200 }),
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 50 }),
  body('address.zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 }),
  body('address.country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('Country must be a 2-letter code'),
];

const updatePreferencesValidator = [
  body('preferences.notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),
  body('preferences.notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),
  body('preferences.notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean'),
  body('preferences.currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be a 3-letter code'),
  body('preferences.language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be a valid locale code'),
];

const addPaymentMethodValidator = [
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
  body('setAsDefault')
    .optional()
    .isBoolean()
    .withMessage('setAsDefault must be a boolean'),
];

const removePaymentMethodValidator = [
  param('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
];

const addDeviceTokenValidator = [
  body('token')
    .notEmpty()
    .withMessage('Device token is required'),
  body('platform')
    .isIn(['ios', 'android', 'web'])
    .withMessage('Platform must be ios, android, or web'),
];

const walletCreditValidator = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
];

const userIdValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

module.exports = {
  updateProfileValidator,
  updatePreferencesValidator,
  addPaymentMethodValidator,
  removePaymentMethodValidator,
  addDeviceTokenValidator,
  walletCreditValidator,
  userIdValidator,
  paginationValidator,
};
