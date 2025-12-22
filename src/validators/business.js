const { body, param, query } = require('express-validator');

const createBusinessValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ max: 100 })
    .withMessage('Business name cannot exceed 100 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please provide a valid phone number'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  body('industry')
    .optional()
    .isIn(['technology', 'finance', 'healthcare', 'retail', 'manufacturing', 'hospitality', 'education', 'other'])
    .withMessage('Invalid industry'),
  body('size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'])
    .withMessage('Invalid company size'),
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
    .isLength({ min: 2, max: 2 }),
];

const updateBusinessValidator = [
  param('businessId')
    .isMongoId()
    .withMessage('Invalid business ID'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .toLowerCase(),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/),
  body('website')
    .optional()
    .isURL(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
  body('industry')
    .optional()
    .isIn(['technology', 'finance', 'healthcare', 'retail', 'manufacturing', 'hospitality', 'education', 'other']),
  body('size')
    .optional()
    .isIn(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']),
];

const businessIdValidator = [
  param('businessId')
    .isMongoId()
    .withMessage('Invalid business ID'),
];

const addEmployeeValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .toLowerCase(),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 }),
];

const bulkAddEmployeesValidator = [
  body('employees')
    .isArray({ min: 1 })
    .withMessage('Employees array is required'),
  body('employees.*.email')
    .isEmail()
    .withMessage('Please provide valid email addresses'),
  body('employees.*.firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required'),
  body('employees.*.lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required'),
  body('employees.*.department')
    .optional()
    .trim(),
  body('employees.*.position')
    .optional()
    .trim(),
];

const updateEmployeeValidator = [
  param('employeeId')
    .isMongoId()
    .withMessage('Invalid employee ID'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('position')
    .optional()
    .trim()
    .isLength({ max: 100 }),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'pending'])
    .withMessage('Invalid status'),
];

const removeEmployeeValidator = [
  param('employeeId')
    .isMongoId()
    .withMessage('Invalid employee ID'),
];

const updateSettingsValidator = [
  body('settings.allowEmployeePurchases')
    .optional()
    .isBoolean(),
  body('settings.requireApproval')
    .optional()
    .isBoolean(),
  body('settings.maxGiftCardValue')
    .optional()
    .isFloat({ min: 1 })
    .withMessage('Max gift card value must be at least $1'),
  body('settings.defaultCurrency')
    .optional()
    .isLength({ min: 3, max: 3 }),
  body('settings.notificationPreferences.emailOnPurchase')
    .optional()
    .isBoolean(),
  body('settings.notificationPreferences.emailOnRedemption')
    .optional()
    .isBoolean(),
  body('settings.notificationPreferences.weeklyReport')
    .optional()
    .isBoolean(),
];

const setBudgetValidator = [
  body('monthly')
    .isFloat({ min: 0 })
    .withMessage('Monthly budget must be a positive number'),
];

const addAdminValidator = [
  body('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

const removeAdminValidator = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID'),
];

module.exports = {
  createBusinessValidator,
  updateBusinessValidator,
  businessIdValidator,
  addEmployeeValidator,
  bulkAddEmployeesValidator,
  updateEmployeeValidator,
  removeEmployeeValidator,
  updateSettingsValidator,
  setBudgetValidator,
  addAdminValidator,
  removeAdminValidator,
};
