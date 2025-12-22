const Business = require('../../models/Business');
const User = require('../../models/User');
const Campaign = require('../../models/Campaign');
const Transaction = require('../../models/Transaction');
const { uploadToS3, deleteFromS3 } = require('../../config/aws');
const { createCustomer } = require('../../config/stripe');
const { sendEmail } = require('../../utils/email');
const { parseCSV } = require('../../utils/helpers');

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
}

module.exports = new BusinessService();
