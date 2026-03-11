const express = require('express');
const router = express.Router();
const businessService = require('../services/business');
const { authenticate, isBusinessAdmin } = require('../middleware/auth');
const { uploadSingle, handleUploadError } = require('../middleware/upload');
const { asyncHandler } = require('../middleware/errorHandler');
const {
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
  validate,
} = require('../validators');

// Create business
router.post(
  '/',
  authenticate,
  createBusinessValidator,
  validate,
  asyncHandler(async (req, res) => {
    const business = await businessService.createBusiness(req.userId, req.body);
    res.status(201).json({
      success: true,
      message: 'Business created successfully',
      data: { business },
    });
  })
);

// Get current user's business
router.get(
  '/my',
  authenticate,
  asyncHandler(async (req, res) => {
    const business = await businessService.getBusinessByOwner(req.userId);
    res.json({
      success: true,
      data: { business },
    });
  })
);

// Get business by ID
router.get(
  '/:businessId',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const business = await businessService.getBusinessById(req.params.businessId);
    res.json({
      success: true,
      data: { business },
    });
  })
);

// Update business
router.put(
  '/:businessId',
  authenticate,
  updateBusinessValidator,
  validate,
  asyncHandler(async (req, res) => {
    const business = await businessService.updateBusiness(
      req.params.businessId,
      req.userId,
      req.body
    );
    res.json({
      success: true,
      message: 'Business updated successfully',
      data: { business },
    });
  })
);

// Update business logo
router.post(
  '/:businessId/logo',
  authenticate,
  businessIdValidator,
  validate,
  ...uploadSingle('logo', 'business-logos'),
  handleUploadError,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }
    const result = await businessService.updateLogo(
      req.params.businessId,
      req.userId,
      req.file
    );
    res.json({
      success: true,
      message: 'Logo updated successfully',
      data: result,
    });
  })
);

// Update business settings
router.put(
  '/:businessId/settings',
  authenticate,
  businessIdValidator,
  updateSettingsValidator,
  validate,
  asyncHandler(async (req, res) => {
    const settings = await businessService.updateSettings(
      req.params.businessId,
      req.userId,
      req.body.settings
    );
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings },
    });
  })
);

// Set budget
router.put(
  '/:businessId/budget',
  authenticate,
  businessIdValidator,
  setBudgetValidator,
  validate,
  asyncHandler(async (req, res) => {
    const budget = await businessService.setBudget(
      req.params.businessId,
      req.userId,
      req.body.monthly
    );
    res.json({
      success: true,
      message: 'Budget updated successfully',
      data: { budget },
    });
  })
);

// Get employees
router.get(
  '/:businessId/employees',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      department: req.query.department,
    };
    const employees = await businessService.getEmployees(
      req.params.businessId,
      req.userId,
      options
    );
    res.json({
      success: true,
      data: { employees },
    });
  })
);

// Add employee
router.post(
  '/:businessId/employees',
  authenticate,
  businessIdValidator,
  addEmployeeValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.addEmployee(
      req.params.businessId,
      req.userId,
      req.body
    );
    res.status(201).json({
      success: true,
      ...result,
    });
  })
);

// Add employees in bulk
router.post(
  '/:businessId/employees/bulk',
  authenticate,
  businessIdValidator,
  bulkAddEmployeesValidator,
  validate,
  asyncHandler(async (req, res) => {
    const results = await businessService.addEmployeesBulk(
      req.params.businessId,
      req.userId,
      req.body.employees
    );
    res.status(201).json({
      success: true,
      data: { results },
    });
  })
);

// Add employees from CSV
router.post(
  '/:businessId/employees/csv',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const results = await businessService.addEmployeesFromCSV(
      req.params.businessId,
      req.userId,
      req.body.csvContent
    );
    res.status(201).json({
      success: true,
      data: { results },
    });
  })
);

// Update employee
router.put(
  '/:businessId/employees/:employeeId',
  authenticate,
  businessIdValidator,
  updateEmployeeValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.updateEmployee(
      req.params.businessId,
      req.userId,
      req.params.employeeId,
      req.body
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Remove employee
router.delete(
  '/:businessId/employees/:employeeId',
  authenticate,
  businessIdValidator,
  removeEmployeeValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.removeEmployee(
      req.params.businessId,
      req.userId,
      req.params.employeeId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Add admin
router.post(
  '/:businessId/admins',
  authenticate,
  businessIdValidator,
  addAdminValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.addAdmin(
      req.params.businessId,
      req.userId,
      req.body.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Remove admin
router.delete(
  '/:businessId/admins/:userId',
  authenticate,
  businessIdValidator,
  removeAdminValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.removeAdmin(
      req.params.businessId,
      req.userId,
      req.params.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get departments
router.get(
  '/:businessId/departments',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const departments = await businessService.getDepartments(
      req.params.businessId,
      req.userId
    );
    res.json({
      success: true,
      data: { departments },
    });
  })
);

// Get business statistics
router.get(
  '/:businessId/stats',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const period = req.query.period || 'month';
    const stats = await businessService.getBusinessStats(
      req.params.businessId,
      req.userId,
      period
    );
    res.json({
      success: true,
      data: { stats },
    });
  })
);

// ==================== TRANSACTIONS ====================

router.get(
  '/:businessId/transactions',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      type: req.query.type,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await businessService.getTransactions(
      req.params.businessId,
      req.userId,
      options
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

// ==================== INVOICES ====================

router.get(
  '/:businessId/invoices',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      status: req.query.status,
    };
    const result = await businessService.getInvoices(
      req.params.businessId,
      req.userId,
      options
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

router.get(
  '/:businessId/invoices/:invoiceId',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const invoice = await businessService.getInvoiceById(
      req.params.businessId,
      req.userId,
      req.params.invoiceId
    );
    res.json({
      success: true,
      data: { invoice },
    });
  })
);

// ==================== PAYMENT METHODS ====================

router.get(
  '/:businessId/payment-methods',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.getPaymentMethods(
      req.params.businessId,
      req.userId
    );
    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/:businessId/payment-methods',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.addPaymentMethod(
      req.params.businessId,
      req.userId,
      req.body.paymentMethodId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

router.delete(
  '/:businessId/payment-methods/:paymentMethodId',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.removePaymentMethod(
      req.params.businessId,
      req.userId,
      req.params.paymentMethodId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

router.put(
  '/:businessId/payment-methods/:paymentMethodId/default',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.setDefaultPaymentMethod(
      req.params.businessId,
      req.userId,
      req.params.paymentMethodId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== RESEND EMPLOYEE INVITE ====================

router.post(
  '/:businessId/employees/:employeeId/resend-invite',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.resendEmployeeInvite(
      req.params.businessId,
      req.userId,
      req.params.employeeId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// ==================== QUICK SEND GIFT ====================

router.post(
  '/:businessId/send-gift',
  authenticate,
  businessIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await businessService.sendQuickGift(
      req.params.businessId,
      req.userId,
      req.body
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

module.exports = router;
