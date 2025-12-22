const { validationResult } = require('express-validator');

// Validation result handler middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

const authValidators = require('./auth');
const userValidators = require('./user');
const giftcardValidators = require('./giftcard');
const subscriptionValidators = require('./subscription');
const businessValidators = require('./business');
const campaignValidators = require('./campaign');

module.exports = {
  validate,
  ...authValidators,
  ...userValidators,
  ...giftcardValidators,
  ...subscriptionValidators,
  ...businessValidators,
  ...campaignValidators,
};
