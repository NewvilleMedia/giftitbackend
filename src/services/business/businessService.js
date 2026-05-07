const Business = require('../../models/Business');
const User = require('../../models/User');
const Campaign = require('../../models/Campaign');
const Transaction = require('../../models/Transaction');
const GiftCard = require('../../models/GiftCard');
const GiftCardPurchase = require('../../models/GiftCardPurchase');
const { uploadToS3, deleteFromS3 } = require('../../config/aws');
const { stripe } = require('../../config/stripe');
const { createCustomer } = require('../../config/stripe');
const { sendEmail } = require('../../utils/email');
const { parseCSV } = require('../../utils/helpers');
const giftCardService = require('../giftcard');

// Generate a unique, human-readable claim code like "GIFT-A3X9"
async function generateClaimCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 0, 1 for readability
  const maxRetries = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let code = 'GIFT-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check for uniqueness
    const existing = await GiftCardPurchase.findOne({ claimCode: code });
    if (!existing) {
      return code;
    }
  }

  throw new Error('Failed to generate unique claim code after multiple attempts');
}

class BusinessService {
  // Create business
  async createBusiness(ownerId, businessData) {
    const {
      name,
      email,
      phone,
      website,
      description,
      industry,
      size,
      address,
    } = businessData;

    // Check if owner already has a business
    const existingBusiness = await Business.findOne({ ownerId });
    if (existingBusiness) {
      throw new Error('You already have a business account');
    }

    // Get owner
    const owner = await User.findById(ownerId);
    if (!owner) {
      throw new Error('User not found');
    }

    // Create Stripe customer for business
    let stripeCustomerId = null;
    try {
      const stripeCustomer = await createCustomer(email, name, { type: 'business' });
      stripeCustomerId = stripeCustomer.id;
    } catch (error) {
      console.error('Stripe business customer creation failed:', error);
    }

    // Create business
    const business = await Business.create({
      name,
      email,
      phone,
      website,
      description,
      industry,
      size,
      address,
      ownerId,
      stripeCustomerId,
    });

    // Update user role and link to business
    owner.role = 'business';
    owner.businessId = business._id;
    await owner.save();

    // Send welcome email
    await sendEmail(email, 'businessWelcome', {
      firstName: owner.firstName,
      businessName: name,
    });

    return business;
  }

  // Get business by ID
  async getBusinessById(businessId) {
    const business = await Business.findById(businessId)
      .populate('ownerId', 'firstName lastName email')
      .populate('admins', 'firstName lastName email');

    if (!business) {
      throw new Error('Business not found');
    }

    return business;
  }

  // Get business by owner
  async getBusinessByOwner(ownerId) {
    const business = await Business.findOne({ ownerId })
      .populate('ownerId', 'firstName lastName email')
      .populate('admins', 'firstName lastName email');

    return business;
  }

  // Update business
  async updateBusiness(businessId, userId, updateData) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const allowedFields = [
      'name',
      'email',
      'phone',
      'website',
      'description',
      'industry',
      'size',
      'address',
    ];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        business[field] = updateData[field];
      }
    }

    await business.save();

    return business;
  }

  // Update business logo
  async updateLogo(businessId, userId, file) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    // Delete old logo
    if (business.logo) {
      try {
        const oldKey = business.logo.split('/').slice(-2).join('/');
        await deleteFromS3(oldKey);
      } catch (error) {
        console.error('Error deleting old logo:', error);
      }
    }

    // Upload new logo
    const result = await uploadToS3(file, 'business-logos');

    business.logo = result.cloudFrontUrl || result.location;
    await business.save();

    return { logo: business.logo };
  }

  // Update business settings
  async updateSettings(businessId, userId, settings) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    business.settings = { ...business.settings, ...settings };
    await business.save();

    return business.settings;
  }

  // Set monthly budget
  async setBudget(businessId, userId, monthlyBudget) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    business.budget.monthly = monthlyBudget;
    await business.save();

    return business.budget;
  }

  // Add admin
  async addAdmin(businessId, ownerId, userId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (business.ownerId.toString() !== ownerId.toString()) {
      throw new Error('Only the owner can add admins');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (business.admins.includes(userId)) {
      throw new Error('User is already an admin');
    }

    business.admins.push(userId);
    await business.save();

    // Update user
    user.businessId = businessId;
    user.role = 'business';
    await user.save();

    return { message: 'Admin added successfully' };
  }

  // Remove admin
  async removeAdmin(businessId, ownerId, userId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (business.ownerId.toString() !== ownerId.toString()) {
      throw new Error('Only the owner can remove admins');
    }

    business.admins = business.admins.filter(
      (adminId) => adminId.toString() !== userId.toString()
    );
    await business.save();

    return { message: 'Admin removed successfully' };
  }

  // Add employee
  async addEmployee(businessId, userId, employeeData) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const { email, firstName, lastName, department, position } = employeeData;

    // Check if user exists
    let employee = await User.findOne({ email });

    if (!employee) {
      // Create a pending user account
      employee = await User.create({
        email,
        firstName,
        lastName,
        password: Math.random().toString(36).slice(-12), // Temporary password
        businessId,
        role: 'user',
      });

      // TODO: Send invitation email
    }

    await business.addEmployee(employee._id, department, position);

    return { message: 'Employee added successfully' };
  }

  // Add employees in bulk
  async addEmployeesBulk(businessId, userId, employees) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const results = [];

    for (const empData of employees) {
      try {
        let employee = await User.findOne({ email: empData.email });

        if (!employee) {
          employee = await User.create({
            email: empData.email,
            firstName: empData.firstName,
            lastName: empData.lastName,
            password: Math.random().toString(36).slice(-12),
            businessId,
            role: 'user',
          });
        }

        await business.addEmployee(employee._id, empData.department, empData.position);

        results.push({ email: empData.email, status: 'success' });
      } catch (error) {
        results.push({ email: empData.email, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  // Add employees from CSV
  async addEmployeesFromCSV(businessId, userId, csvContent) {
    const { data } = parseCSV(csvContent, true);

    const employees = data.map((row) => ({
      email: row.email || row.Email,
      firstName: row.firstName || row.first_name || row['First Name'],
      lastName: row.lastName || row.last_name || row['Last Name'],
      department: row.department || row.Department,
      position: row.position || row.Position || row.title || row.Title,
    }));

    return this.addEmployeesBulk(businessId, userId, employees);
  }

  // Update employee
  async updateEmployee(businessId, userId, employeeId, updateData) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const employee = business.employees.find(
      (emp) => emp.userId.toString() === employeeId.toString()
    );

    if (!employee) {
      throw new Error('Employee not found');
    }

    if (updateData.department) employee.department = updateData.department;
    if (updateData.position) employee.position = updateData.position;
    if (updateData.status) employee.status = updateData.status;

    await business.save();

    return { message: 'Employee updated successfully' };
  }

  // Remove employee
  async removeEmployee(businessId, userId, employeeId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    await business.removeEmployee(employeeId);

    return { message: 'Employee removed successfully' };
  }

  // Get employees
  async getEmployees(businessId, userId, options = {}) {
    const business = await Business.findById(businessId)
      .populate('employees.userId', 'firstName lastName email avatar');

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    let employees = business.employees;

    // Filter by status
    if (options.status) {
      employees = employees.filter((emp) => emp.status === options.status);
    }

    // Filter by department
    if (options.department) {
      employees = employees.filter((emp) => emp.department === options.department);
    }

    return employees;
  }

  // Get business statistics
  async getBusinessStats(businessId, userId, period = 'month') {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    // Get campaign stats
    const campaignStats = await Campaign.getBusinessCampaignStats(businessId, period);

    // Get transaction stats
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          businessId: business._id,
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    return {
      employeeCount: business.employeeCount,
      budget: business.budget,
      campaigns: campaignStats,
      transactions: transactionStats[0] || { totalSpent: 0, transactionCount: 0 },
    };
  }

  // Get departments
  async getDepartments(businessId, userId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const departments = [...new Set(
      business.employees
        .map((emp) => emp.department)
        .filter((dept) => dept)
    )];

    return departments;
  }

  // ==================== TRANSACTIONS ====================

  async getTransactions(businessId, userId, options = {}) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const { type, status, startDate, endDate, page = 1, limit = 20 } = options;

    const filter = { businessId: business._id };

    if (type) filter.type = type;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .populate('userId', 'firstName lastName email')
      .populate('purchaseId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transaction.countDocuments(filter);

    // Calculate summary
    const summary = await Transaction.aggregate([
      { $match: { businessId: business._id, status: 'completed' } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary,
    };
  }

  // ==================== INVOICES ====================

  async getInvoices(businessId, userId, options = {}) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (!business.stripeCustomerId) {
      return { invoices: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }

    const { page = 1, limit = 20, status } = options;

    try {
      const params = {
        customer: business.stripeCustomerId,
        limit: limit,
      };

      if (status) {
        params.status = status;
      }

      const stripeInvoices = await stripe.invoices.list(params);

      const invoices = stripeInvoices.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        createdAt: new Date(invoice.created * 1000),
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        description: invoice.description,
        lines: invoice.lines?.data?.map((line) => ({
          description: line.description,
          amount: line.amount / 100,
          quantity: line.quantity,
        })),
      }));

      return {
        invoices,
        pagination: {
          page,
          limit,
          total: stripeInvoices.data.length,
          hasMore: stripeInvoices.has_more,
        },
      };
    } catch (error) {
      console.error('Error fetching Stripe invoices:', error);
      return { invoices: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  }

  async getInvoiceById(businessId, userId, invoiceId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);

      // Verify the invoice belongs to this business
      if (invoice.customer !== business.stripeCustomerId) {
        throw new Error('Invoice not found');
      }

      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        createdAt: new Date(invoice.created * 1000),
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        description: invoice.description,
        lines: invoice.lines?.data?.map((line) => ({
          description: line.description,
          amount: line.amount / 100,
          quantity: line.quantity,
        })),
      };
    } catch (error) {
      throw new Error('Invoice not found');
    }
  }

  // ==================== PAYMENT METHODS ====================

  async getPaymentMethods(businessId, userId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (!business.stripeCustomerId) {
      return { paymentMethods: [], defaultPaymentMethodId: null };
    }

    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: business.stripeCustomerId,
        type: 'card',
      });

      // Get the customer to find default payment method
      const customer = await stripe.customers.retrieve(business.stripeCustomerId);
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

      return {
        paymentMethods: paymentMethods.data.map((pm) => ({
          id: pm.id,
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          isDefault: pm.id === defaultPaymentMethodId,
        })),
        defaultPaymentMethodId,
      };
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return { paymentMethods: [], defaultPaymentMethodId: null };
    }
  }

  async createSetupIntent(businessId, userId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    // Create Stripe customer if doesn't exist
    if (!business.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: business.email,
        name: business.name,
        metadata: { businessId: businessId.toString() },
      });
      business.stripeCustomerId = customer.id;
      await business.save();
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: business.stripeCustomerId,
      payment_method_types: ['card'],
    });

    return {
      clientSecret: setupIntent.client_secret,
      customerId: business.stripeCustomerId,
    };
  }

  async addPaymentMethod(businessId, userId, paymentMethodId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    // Create Stripe customer if doesn't exist
    if (!business.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: business.email,
        name: business.name,
        metadata: { businessId: businessId.toString() },
      });
      business.stripeCustomerId = customer.id;
      await business.save();
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: business.stripeCustomerId,
    });

    // If this is the first payment method, set it as default
    const paymentMethods = await stripe.paymentMethods.list({
      customer: business.stripeCustomerId,
      type: 'card',
    });

    if (paymentMethods.data.length === 1) {
      await stripe.customers.update(business.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
      business.billing = business.billing || {};
      business.billing.paymentMethodId = paymentMethodId;
      await business.save();
    }

    return { message: 'Payment method added successfully' };
  }

  async removePaymentMethod(businessId, userId, paymentMethodId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    try {
      // Detach payment method
      await stripe.paymentMethods.detach(paymentMethodId);

      // If this was the default, clear it
      if (business.billing?.paymentMethodId === paymentMethodId) {
        business.billing.paymentMethodId = null;
        await business.save();
      }

      return { message: 'Payment method removed successfully' };
    } catch (error) {
      throw new Error('Failed to remove payment method');
    }
  }

  async setDefaultPaymentMethod(businessId, userId, paymentMethodId) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    if (!business.stripeCustomerId) {
      throw new Error('No Stripe customer found');
    }

    // Update default payment method in Stripe
    await stripe.customers.update(business.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Update in our database
    business.billing = business.billing || {};
    business.billing.paymentMethodId = paymentMethodId;
    await business.save();

    return { message: 'Default payment method updated' };
  }

  // ==================== EMPLOYEE INVITE ====================

  async resendEmployeeInvite(businessId, userId, employeeId) {
    const business = await Business.findById(businessId)
      .populate('employees.userId', 'firstName lastName email');

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const employee = business.employees.find(
      (emp) => emp.userId._id.toString() === employeeId.toString()
    );

    if (!employee) {
      throw new Error('Employee not found');
    }

    const user = employee.userId;

    // Generate a temporary password for the employee
    const tempPassword = Math.random().toString(36).slice(-12);
    const userDoc = await User.findById(employeeId);
    userDoc.password = tempPassword;
    userDoc.mustChangePassword = true;
    await userDoc.save();

    // Send invitation email
    await sendEmail(user.email, 'employeeInvite', {
      firstName: user.firstName,
      businessName: business.name,
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
    });

    return { message: 'Invitation sent successfully' };
  }

  // ==================== QUICK SEND GIFT ====================

  async sendQuickGift(businessId, userId, giftData) {
    const business = await Business.findById(businessId);

    if (!business) {
      throw new Error('Business not found');
    }

    if (!business.isAdmin(userId)) {
      throw new Error('Access denied');
    }

    const {
      employeeId,
      recipientEmail,
      recipientName,
      giftCardId,
      amount,
      personalMessage,
    } = giftData;

    // Validate gift card
    const giftCard = await GiftCard.findById(giftCardId);
    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    // Validate amount
    if (giftCard.priceType === 'fixed') {
      if (!giftCard.fixedAmounts.includes(amount)) {
        throw new Error('Invalid amount for this gift card');
      }
    } else {
      if (amount < giftCard.minAmount || amount > giftCard.maxAmount) {
        throw new Error(`Amount must be between $${giftCard.minAmount} and $${giftCard.maxAmount}`);
      }
    }

    // Check business budget
    if (business.budget.monthly > 0) {
      const remainingBudget = business.budget.monthly - business.budget.spent;
      if (amount > remainingBudget) {
        throw new Error('Insufficient budget');
      }
    }

    // If employeeId provided, get employee details
    let recipientInfo = { email: recipientEmail, name: recipientName };
    if (employeeId) {
      // employeeId might be the subdocument _id or the userId — try both
      const employee = business.employees.find(
        (emp) => emp._id.toString() === employeeId.toString() ||
                 emp.userId.toString() === employeeId.toString()
      );
      const userIdToLookup = employee ? employee.userId : employeeId;
      const empUser = await User.findById(userIdToLookup);
      if (empUser) {
        recipientInfo = {
          email: empUser.email,
          name: `${empUser.firstName} ${empUser.lastName}`,
        };
      }
    }

    if (!recipientInfo.email) {
      throw new Error('Recipient email is required');
    }

    // Create the purchase
    const purchaseData = {
      giftCardId,
      amount,
      recipientType: 'gift',
      recipientEmail: recipientInfo.email,
      recipientName: recipientInfo.name,
      personalMessage: personalMessage || `A gift from ${business.name}`,
      deliveryMethod: 'email',
      paymentMethodId: 'business_account',
      businessId: business._id,
    };

    const result = await giftCardService.purchaseGiftCard(userId, purchaseData);

    // Generate and save claim code on the purchase
    const claimCode = await generateClaimCode();
    const purchaseDoc = await GiftCardPurchase.findById(result.purchase.id);
    if (purchaseDoc) {
      purchaseDoc.claimCode = claimCode;
      await purchaseDoc.save();
    }

    // Update business spending
    business.budget.spent += amount;
    await business.save();

    // Create transaction record
    await Transaction.create({
      userId,
      businessId: business._id,
      type: 'purchase',
      amount,
      netAmount: amount,
      currency: 'USD',
      status: 'completed',
      paymentProvider: 'stripe',
      purchaseId: result.purchase._id,
      description: `Quick gift to ${recipientInfo.name} (${recipientInfo.email})`,
    });

    // Send gift card email immediately (don't wait for Runa webhook)
    try {
      const GiftCard = require('../../models/GiftCard');
      const giftCardDoc = await GiftCard.findById(giftCardId);
      const senderUser = await User.findById(userId);

      console.log('=== SENDING GIFT CARD EMAIL ===');
      console.log('To:', recipientInfo.email);
      console.log('Claim code:', claimCode);
      console.log('Amount:', amount);

      const emailResult = await sendEmail(recipientInfo.email, 'giftCardReceived', {
        recipientName: recipientInfo.name || 'there',
        senderName: senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : business.name,
        giftCardName: giftCardDoc ? giftCardDoc.name : 'Gift Card',
        amount,
        personalMessage: personalMessage || `A gift from ${business.name}`,
        claimCode,
      });
      console.log('Email result:', emailResult);
    } catch (emailError) {
      console.error('Failed to send gift card email:', emailError);
      // Don't fail the whole operation if email fails
    }

    return {
      message: 'Gift sent successfully',
      purchase: result.purchase,
      claimCode,
      recipient: recipientInfo,
    };
  }

  async topUpWallet(businessId, userId, amount, paymentMethodId) {
    const business = await Business.findById(businessId);
    if (!business) throw new Error('Business not found');
    if (!business.isAdmin(userId)) throw new Error('Access denied');

    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 1 || dollars > 50000) {
      throw new Error('Amount must be between $1 and $50,000');
    }
    if (!paymentMethodId) throw new Error('Payment method is required');

    if (!business.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: business.email,
        name: business.name,
        metadata: { businessId: businessId.toString() },
      });
      business.stripeCustomerId = customer.id;
      await business.save();
    }

    const cents = Math.round(dollars * 100);

    const transaction = await Transaction.create({
      userId,
      businessId,
      type: 'wallet_credit',
      amount: dollars,
      netAmount: dollars,
      currency: 'USD',
      status: 'pending',
      paymentProvider: 'stripe',
      description: `Wallet top-up for ${business.name}`,
      metadata: { kind: 'business_wallet_topup', businessId: businessId.toString() },
    });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: cents,
        currency: 'usd',
        customer: business.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        description: `GiftIt wallet top-up — ${business.name}`,
        metadata: {
          kind: 'business_wallet_topup',
          businessId: businessId.toString(),
          transactionId: transaction._id.toString(),
        },
      });
    } catch (err) {
      transaction.status = 'failed';
      transaction.failureReason = err.message;
      transaction.failureCode = err.code;
      await transaction.save();
      // Stripe error with payment_intent attached (e.g. authentication_required)
      const pi = err.payment_intent || err.raw?.payment_intent;
      if (pi) {
        transaction.paymentIntentId = pi.id;
        await transaction.save();
        return {
          status: pi.status,
          requiresAction: pi.status === 'requires_action',
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id,
          transactionId: transaction._id,
        };
      }
      throw err;
    }

    transaction.paymentIntentId = paymentIntent.id;

    if (paymentIntent.status === 'succeeded') {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      await transaction.save();

      business.walletBalance = (business.walletBalance || 0) + dollars;
      await business.save();

      return {
        status: 'succeeded',
        walletBalance: business.walletBalance,
        amount: dollars,
        paymentIntentId: paymentIntent.id,
        transactionId: transaction._id,
      };
    }

    // requires_action / processing — return clientSecret so frontend can confirm
    await transaction.save();
    return {
      status: paymentIntent.status,
      requiresAction: paymentIntent.status === 'requires_action',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction._id,
    };
  }
}

module.exports = new BusinessService();
