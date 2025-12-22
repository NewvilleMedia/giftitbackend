const { body, param, query } = require('express-validator');

const createCampaignValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Campaign name is required')
    .isLength({ max: 100 })
    .withMessage('Campaign name cannot exceed 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('type')
    .isIn(['birthday', 'holiday', 'anniversary', 'recognition', 'milestone', 'onboarding', 'custom'])
    .withMessage('Invalid campaign type'),
  body('giftCardId')
    .isMongoId()
    .withMessage('Invalid gift card ID'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be at least $1'),
  body('personalMessage')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Personal message cannot exceed 500 characters'),
  body('recipientType')
    .optional()
    .isIn(['all_employees', 'department', 'custom_list', 'csv_upload'])
    .withMessage('Invalid recipient type'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('recipients')
    .optional()
    .isArray()
    .withMessage('Recipients must be an array'),
  body('recipients.*.email')
    .optional()
    .isEmail()
    .withMessage('Invalid recipient email'),
  body('recipients.*.name')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('scheduleType')
    .optional()
    .isIn(['immediate', 'scheduled', 'recurring'])
    .withMessage('Invalid schedule type'),
  body('scheduledDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid scheduled date'),
  body('recurring.frequency')
    .optional()
    .isIn(['monthly', 'quarterly', 'annually'])
    .withMessage('Invalid recurring frequency'),
  body('recurring.dayOfMonth')
    .optional()
    .isInt({ min: 1, max: 28 })
    .withMessage('Day of month must be between 1 and 28'),
  body('recurring.month')
    .optional()
    .isInt({ min: 0, max: 11 })
    .withMessage('Month must be between 0 and 11'),
  body('budget.total')
    .isFloat({ min: 1 })
    .withMessage('Budget total must be at least $1'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateCampaignValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('personalMessage')
    .optional()
    .trim()
    .isLength({ max: 500 }),
  body('scheduledDate')
    .optional()
    .isISO8601(),
  body('budget.total')
    .optional()
    .isFloat({ min: 1 }),
];

const campaignIdValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
];

const addRecipientsValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
  body('recipients')
    .isArray({ min: 1 })
    .withMessage('Recipients array is required'),
  body('recipients.*.email')
    .isEmail()
    .withMessage('Invalid recipient email'),
  body('recipients.*.name')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('recipients.*.phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/),
];

const removeRecipientValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
  param('recipientId')
    .isMongoId()
    .withMessage('Invalid recipient ID'),
];

const approveCampaignValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
];

const rejectCampaignValidator = [
  param('campaignId')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

const campaignListValidator = [
  query('status')
    .optional()
    .isIn(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'])
    .withMessage('Invalid status'),
  query('type')
    .optional()
    .isIn(['birthday', 'holiday', 'anniversary', 'recognition', 'milestone', 'onboarding', 'custom'])
    .withMessage('Invalid campaign type'),
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
  createCampaignValidator,
  updateCampaignValidator,
  campaignIdValidator,
  addRecipientsValidator,
  removeRecipientValidator,
  approveCampaignValidator,
  rejectCampaignValidator,
  campaignListValidator,
};
