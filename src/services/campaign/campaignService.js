const Campaign = require('../../models/Campaign');
const Business = require('../../models/Business');
const GiftCard = require('../../models/GiftCard');
const User = require('../../models/User');
const giftCardService = require('../giftcard');
const { sendEmail } = require('../../utils/email');
const { sendPushNotification, notificationTemplates } = require('../../utils/pushNotification');
const { parseCSV } = require('../../utils/helpers');

class CampaignService {
  // Create campaign
  async createCampaign(businessId, userId, campaignData) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    // Validate gift card
    const giftCard = await GiftCard.findById(campaignData.giftCardId);
    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    // Calculate budget
    const recipientCount = campaignData.recipients?.length || 0;
    const budgetTotal = campaignData.budget?.total || campaignData.amount * recipientCount;

    // Check business budget
    if (business.budget.monthly > 0) {
      const remainingBudget = business.budget.monthly - business.budget.spent;
      if (budgetTotal > remainingBudget) {
        throw new Error('Campaign budget exceeds remaining monthly budget');
      }
    }

    const campaign = await Campaign.create({
      businessId,
      createdBy: userId,
      name: campaignData.name,
      description: campaignData.description,
      type: campaignData.type,
      giftCardId: campaignData.giftCardId,
      amount: campaignData.amount,
      currency: giftCard.currency,
      personalMessage: campaignData.personalMessage,
      recipientType: campaignData.recipientType || 'custom_list',
      department: campaignData.department,
      recipients: (campaignData.recipients || []).map((r) => ({
        userId: r.userId,
        email: r.email,
        name: r.name,
        phone: r.phone,
        status: 'pending',
      })),
      scheduleType: campaignData.scheduleType || 'immediate',
      scheduledDate: campaignData.scheduledDate ? new Date(campaignData.scheduledDate) : null,
      recurring: campaignData.recurring,
      budget: {
        total: budgetTotal,
        perRecipient: campaignData.amount,
      },
      requiresApproval: business.settings.requireApproval,
      tags: campaignData.tags,
      status: campaignData.scheduleType === 'scheduled' ? 'scheduled' : 'draft',
    });

    // If immediate and doesn't require approval, start campaign
    if (campaignData.scheduleType === 'immediate' && !business.settings.requireApproval) {
      await this.startCampaign(campaign._id, userId);
    }

    return campaign;
  }

  // Get campaign by ID
  async getCampaignById(campaignId, userId) {
    const campaign = await Campaign.findById(campaignId)
      .populate('giftCardId', 'name brandName image category')
      .populate('createdBy', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName email');

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    return campaign;
  }

  // Get business campaigns
  async getBusinessCampaigns(businessId, userId, options = {}) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    return Campaign.getBusinessCampaigns(businessId, options);
  }

  // Update campaign
  async updateCampaign(campaignId, userId, updateData) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error('Cannot update active or completed campaign');
    }

    const allowedFields = [
      'name',
      'description',
      'personalMessage',
      'scheduledDate',
      'tags',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        campaign[field] = updateData[field];
      }
    }

    if (updateData.budget?.total) {
      campaign.budget.total = updateData.budget.total;
    }

    await campaign.save();

    return campaign;
  }

  // Add recipients to campaign
  async addRecipients(campaignId, userId, recipients) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error('Cannot add recipients to active campaign');
    }

    await campaign.addRecipients(recipients);

    // Update budget
    campaign.budget.total = campaign.amount * campaign.recipients.length;
    await campaign.save();

    return campaign;
  }

  // Add recipients from CSV
  async addRecipientsFromCSV(campaignId, userId, csvContent) {
    const { data } = parseCSV(csvContent, true);

    const recipients = data.map((row) => ({
      email: row.email || row.Email,
      name: row.name || row.Name || `${row.firstName || row.first_name || ''} ${row.lastName || row.last_name || ''}`.trim(),
      phone: row.phone || row.Phone,
    })).filter((r) => r.email);

    return this.addRecipients(campaignId, userId, recipients);
  }

  // Add all employees as recipients
  async addAllEmployees(campaignId, userId) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId)
      .populate('employees.userId', 'firstName lastName email phone');

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const recipients = business.employees
      .filter((emp) => emp.status === 'active')
      .map((emp) => ({
        userId: emp.userId._id,
        email: emp.userId.email,
        name: `${emp.userId.firstName} ${emp.userId.lastName}`,
        phone: emp.userId.phone,
      }));

    return this.addRecipients(campaignId, userId, recipients);
  }

  // Add employees by department
  async addEmployeesByDepartment(campaignId, userId, department) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId)
      .populate('employees.userId', 'firstName lastName email phone');

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const recipients = business.employees
      .filter((emp) => emp.status === 'active' && emp.department === department)
      .map((emp) => ({
        userId: emp.userId._id,
        email: emp.userId.email,
        name: `${emp.userId.firstName} ${emp.userId.lastName}`,
        phone: emp.userId.phone,
      }));

    return this.addRecipients(campaignId, userId, recipients);
  }

  // Remove recipient from campaign
  async removeRecipient(campaignId, userId, recipientId) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    await campaign.removeRecipient(recipientId);

    return { message: 'Recipient removed' };
  }

  // Start campaign
  async startCampaign(campaignId, userId) {
    const campaign = await Campaign.findById(campaignId)
      .populate('giftCardId')
      .populate('businessId');

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = campaign.businessId;
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (campaign.status === 'active') {
      throw new Error('Campaign is already active');
    }

    if (campaign.requiresApproval && campaign.approvalStatus !== 'approved') {
      throw new Error('Campaign requires approval before starting');
    }

    if (campaign.recipients.length === 0) {
      throw new Error('Campaign has no recipients');
    }

    await campaign.start();

    // Process recipients
    await this.processCampaignRecipients(campaign);

    return campaign;
  }

  // Process campaign recipients
  async processCampaignRecipients(campaign) {
    const giftCard = campaign.giftCardId;
    const business = await Business.findById(campaign.businessId);

    for (const recipient of campaign.recipients) {
      if (recipient.status !== 'pending') continue;

      try {
        // Purchase gift card for recipient
        const purchaseData = {
          giftCardId: giftCard._id,
          amount: campaign.amount,
          recipientType: 'gift',
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          recipientPhone: recipient.phone,
          personalMessage: campaign.personalMessage,
          deliveryMethod: 'email',
          paymentMethodId: business.billing.paymentMethodId || 'business_account',
        };

        // Use business account for payment
        const purchase = await giftCardService.purchaseGiftCard(
          campaign.createdBy,
          { ...purchaseData, businessId: campaign.businessId }
        );

        await campaign.updateRecipientStatus(recipient._id, 'sent', {
          purchaseId: purchase.purchase.id,
        });
      } catch (error) {
        await campaign.updateRecipientStatus(recipient._id, 'failed', {
          failureReason: error.message,
        });
      }
    }

    // Check if all recipients processed
    const allProcessed = campaign.recipients.every((r) => r.status !== 'pending');
    if (allProcessed) {
      await campaign.complete();

      // Notify campaign creator
      const creator = await User.findById(campaign.createdBy);
      if (creator) {
        await sendEmail(creator.email, 'campaignNotification', {
          subject: 'Campaign Completed',
          title: `Campaign "${campaign.name}" Completed`,
          message: `Your campaign has finished sending ${campaign.stats.sentCount} gift cards.`,
          actionUrl: `${process.env.ADMIN_URL}/campaigns/${campaign._id}`,
          actionText: 'View Results',
        });
      }
    }

    return campaign;
  }

  // Pause campaign
  async pauseCampaign(campaignId, userId) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    await campaign.pause();

    return { message: 'Campaign paused' };
  }

  // Resume campaign
  async resumeCampaign(campaignId, userId) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    await campaign.resume();

    // Continue processing
    await this.processCampaignRecipients(campaign);

    return { message: 'Campaign resumed' };
  }

  // Cancel campaign
  async cancelCampaign(campaignId, userId, reason = '') {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    await campaign.cancel(reason);

    return { message: 'Campaign cancelled' };
  }

  // Approve campaign
  async approveCampaign(campaignId, approverId) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(approverId)) {
      throw new Error('Access denied');
    }

    await campaign.approve(approverId);

    // If immediate, start campaign
    if (campaign.scheduleType === 'immediate') {
      await this.startCampaign(campaignId, approverId);
    }

    return { message: 'Campaign approved' };
  }

  // Reject campaign
  async rejectCampaign(campaignId, approverId, reason) {
    const campaign = await Campaign.findById(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const business = await Business.findById(campaign.businessId);
    if (!business.isAdmin(approverId)) {
      throw new Error('Access denied');
    }

    await campaign.reject(approverId, reason);

    // Notify creator
    const creator = await User.findById(campaign.createdBy);
    if (creator) {
      await sendEmail(creator.email, 'campaignNotification', {
        subject: 'Campaign Rejected',
        title: `Campaign "${campaign.name}" Rejected`,
        message: `Your campaign was rejected. Reason: ${reason}`,
        actionUrl: `${process.env.ADMIN_URL}/campaigns/${campaign._id}`,
        actionText: 'View Campaign',
      });
    }

    return { message: 'Campaign rejected' };
  }

  // Process scheduled campaigns (called by cron job)
  async processScheduledCampaigns() {
    const dueCampaigns = await Campaign.getDueCampaigns();
    const results = [];

    for (const campaign of dueCampaigns) {
      try {
        if (campaign.scheduleType === 'recurring') {
          // Create new occurrence
          campaign.recurring.occurrenceCount += 1;
          campaign.recurring.nextOccurrence = campaign.calculateNextOccurrence();

          // Check max occurrences
          if (campaign.recurring.maxOccurrences &&
              campaign.recurring.occurrenceCount >= campaign.recurring.maxOccurrences) {
            await campaign.complete();
            continue;
          }

          await campaign.save();
        }

        await this.processCampaignRecipients(campaign);

        results.push({
          campaignId: campaign._id,
          status: 'success',
        });
      } catch (error) {
        results.push({
          campaignId: campaign._id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  // Get campaign statistics
  async getCampaignStats(campaignId, userId) {
    const campaign = await this.getCampaignById(campaignId, userId);

    return {
      totalRecipients: campaign.stats.totalRecipients,
      sentCount: campaign.stats.sentCount,
      deliveredCount: campaign.stats.deliveredCount,
      failedCount: campaign.stats.failedCount,
      redeemedCount: campaign.stats.redeemedCount,
      totalAmountSent: campaign.stats.totalAmountSent,
      progressPercentage: campaign.progressPercentage,
      remainingBudget: campaign.remainingBudget,
    };
  }
}

module.exports = new CampaignService();
