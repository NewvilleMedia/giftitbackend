const { body, param, query } = require('express-validator');

const createSubscriptionValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Subscription name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('giftCardId')
    .isMongoId()
    .withMessage('Invalid gift card ID'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1'),
  body('frequency')
    .isIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Invalid frequency'),
  body('recipientType')
    .optional()
    .isIn(['self', 'other'])
    .withMessage('Invalid recipient type'),
  body('recipientEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid recipient email'),
  body('recipientName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Recipient name cannot exceed 100 characters'),
  body('recipientPhone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Invalid recipient phone number'),
  body('personalMessage')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Personal message cannot exceed 500 characters'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date'),
  body('dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 28 })
    .withMessage('Day of month must be between 1 and 28'),
  body('dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('maxDeliveries')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max deliveries must be at least 1'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
  body('notifyBeforeDelivery')
    .optional()
    .isBoolean()
    .withMessage('Notify before delivery must be a boolean'),
];

const updateSubscriptionValidator = [
  param('subscriptionId')
    .isMongoId()
    .withMessage('Invalid subscription ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1'),
  body('frequency')
    .optional()
    .isIn(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually'])
    .withMessage('Invalid frequency'),
  body('recipientType')
    .optional()
    .isIn(['self', 'other'])
    .withMessage('Invalid recipient type'),
  body('recipientEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid recipient email'),
  body('recipientName')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('personalMessage')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('paymentMethodId')
    .optional()
    .notEmpty()
    .withMessage('Payment method ID cannot be empty'),
  body('notifyBeforeDelivery')
    .optional()
    .isBoolean(),
];

const subscriptionIdValidator = [
  param('subscriptionId')
    .isMongoId()
    .withMessage('Invalid subscription ID'),
];

const pauseSubscriptionValidator = [
  param('subscriptionId')
    .isMongoId()
    .withMessage('Invalid subscription ID'),
  body('until')
    .optional()
    .isISO8601()
    .withMessage('Invalid pause until date'),
];

const cancelSubscriptionValidator = [
  param('subscriptionId')
    .isMongoId()
    .withMessage('Invalid subscription ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

const subscriptionListValidator = [
  query('status')
    .optional()
    .isIn(['active', 'paused', 'cancelled', 'completed', 'failed'])
    .withMessage('Invalid status'),
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
  createSubscriptionValidator,
  updateSubscriptionValidator,
  subscriptionIdValidator,
  pauseSubscriptionValidator,
  cancelSubscriptionValidator,
  subscriptionListValidator,
};
