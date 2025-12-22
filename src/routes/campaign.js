const express = require('express');
const router = express.Router();
const campaignService = require('../services/campaign');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createCampaignValidator,
  updateCampaignValidator,
  campaignIdValidator,
  addRecipientsValidator,
  removeRecipientValidator,
  approveCampaignValidator,
  rejectCampaignValidator,
  campaignListValidator,
  validate,
} = require('../validators');

// Get business campaigns
router.get(
  '/business/:businessId',
  authenticate,
  campaignListValidator,
  validate,
  asyncHandler(async (req, res) => {
    const options = {
      status: req.query.status,
      type: req.query.type,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await campaignService.getBusinessCampaigns(
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

// Create campaign
router.post(
  '/business/:businessId',
  authenticate,
  createCampaignValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.createCampaign(
      req.params.businessId,
      req.userId,
      req.body
    );
    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: { campaign },
    });
  })
);

// Get campaign by ID
router.get(
  '/:campaignId',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.getCampaignById(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      data: { campaign },
    });
  })
);

// Update campaign
router.put(
  '/:campaignId',
  authenticate,
  updateCampaignValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.updateCampaign(
      req.params.campaignId,
      req.userId,
      req.body
    );
    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign },
    });
  })
);

// Add recipients
router.post(
  '/:campaignId/recipients',
  authenticate,
  addRecipientsValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.addRecipients(
      req.params.campaignId,
      req.userId,
      req.body.recipients
    );
    res.json({
      success: true,
      message: 'Recipients added successfully',
      data: { campaign },
    });
  })
);

// Add recipients from CSV
router.post(
  '/:campaignId/recipients/csv',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.addRecipientsFromCSV(
      req.params.campaignId,
      req.userId,
      req.body.csvContent
    );
    res.json({
      success: true,
      message: 'Recipients added from CSV',
      data: { campaign },
    });
  })
);

// Add all employees as recipients
router.post(
  '/:campaignId/recipients/all-employees',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.addAllEmployees(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      message: 'All employees added as recipients',
      data: { campaign },
    });
  })
);

// Add employees by department
router.post(
  '/:campaignId/recipients/department',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.addEmployeesByDepartment(
      req.params.campaignId,
      req.userId,
      req.body.department
    );
    res.json({
      success: true,
      message: 'Department employees added as recipients',
      data: { campaign },
    });
  })
);

// Remove recipient
router.delete(
  '/:campaignId/recipients/:recipientId',
  authenticate,
  removeRecipientValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.removeRecipient(
      req.params.campaignId,
      req.userId,
      req.params.recipientId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Start campaign
router.post(
  '/:campaignId/start',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const campaign = await campaignService.startCampaign(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      message: 'Campaign started',
      data: { campaign },
    });
  })
);

// Pause campaign
router.post(
  '/:campaignId/pause',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.pauseCampaign(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Resume campaign
router.post(
  '/:campaignId/resume',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.resumeCampaign(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Cancel campaign
router.post(
  '/:campaignId/cancel',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.cancelCampaign(
      req.params.campaignId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Approve campaign
router.post(
  '/:campaignId/approve',
  authenticate,
  approveCampaignValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.approveCampaign(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Reject campaign
router.post(
  '/:campaignId/reject',
  authenticate,
  rejectCampaignValidator,
  validate,
  asyncHandler(async (req, res) => {
    const result = await campaignService.rejectCampaign(
      req.params.campaignId,
      req.userId,
      req.body.reason
    );
    res.json({
      success: true,
      ...result,
    });
  })
);

// Get campaign statistics
router.get(
  '/:campaignId/stats',
  authenticate,
  campaignIdValidator,
  validate,
  asyncHandler(async (req, res) => {
    const stats = await campaignService.getCampaignStats(
      req.params.campaignId,
      req.userId
    );
    res.json({
      success: true,
      data: { stats },
    });
  })
);

module.exports = router;
