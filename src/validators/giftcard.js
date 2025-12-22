const { body, param, query } = require('express-validator');

const searchGiftCardsValidator = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query cannot exceed 100 characters'),
  query('category')
    .optional()
    .isIn(['amazon', 'retail', 'restaurants', 'coffee', 'pets', 'travel', 'gas', 'entertainment', 'health', 'sports', 'gifts', 'other'])
    .withMessage('Invalid category'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),
  query('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  query('sort')
    .optional()
    .isIn(['popularity', 'newest', 'name', 'rating'])
    .withMessage('Invalid sort option'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const giftCardIdValidator = [
  param('giftCardId')
    .isMongoId()
    .withMessage('Invalid gift card ID'),
];

const purchaseGiftCardValidator = [
  body('giftCardId')
    .isMongoId()
    .withMessage('Invalid gift card ID'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1'),
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Quantity must be between 1 and 10'),
  body('recipientType')
    .optional()
    .isIn(['self', 'gift', 'business'])
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
  body('deliveryDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid delivery date'),
  body('deliveryMethod')
    .optional()
    .isIn(['email', 'sms', 'in_app', 'all'])
    .withMessage('Invalid delivery method'),
  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required'),
];

const purchaseIdValidator = [
  param('purchaseId')
    .isMongoId()
    .withMessage('Invalid purchase ID'),
];

const redeemValidator = [
  body('purchaseId')
    .isMongoId()
    .withMessage('Invalid purchase ID'),
  body('codeIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Code index must be a non-negative integer'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
];

const updateBalanceValidator = [
  body('purchaseId')
    .isMongoId()
    .withMessage('Invalid purchase ID'),
  body('codeIndex')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Code index must be a non-negative integer'),
  body('spentAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Spent amount must be greater than 0'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters'),
];

const categoryValidator = [
  param('category')
    .isIn(['amazon', 'retail', 'restaurants', 'coffee', 'pets', 'travel', 'gas', 'entertainment', 'health', 'sports', 'gifts', 'other', 'popular', 'featured'])
    .withMessage('Invalid category'),
];

module.exports = {
  searchGiftCardsValidator,
  giftCardIdValidator,
  purchaseGiftCardValidator,
  purchaseIdValidator,
  redeemValidator,
  updateBalanceValidator,
  categoryValidator,
};
