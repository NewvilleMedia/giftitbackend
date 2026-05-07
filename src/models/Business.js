const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      maxlength: [100, 'Business name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, 'Business email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    logo: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    industry: {
      type: String,
      enum: [
        'technology',
        'finance',
        'healthcare',
        'retail',
        'manufacturing',
        'hospitality',
        'education',
        'other',
      ],
      default: 'other',
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'],
      default: '1-10',
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'US' },
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    employees: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      department: String,
      position: String,
      addedAt: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'pending',
      },
    }],
    stripeCustomerId: {
      type: String,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    billing: {
      plan: {
        type: String,
        enum: ['free', 'starter', 'professional', 'enterprise'],
        default: 'free',
      },
      stripeSubscriptionId: String,
      billingEmail: String,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
    budget: {
      monthly: {
        type: Number,
        default: 0,
      },
      spent: {
        type: Number,
        default: 0,
      },
      lastResetDate: {
        type: Date,
        default: Date.now,
      },
    },
    settings: {
      allowEmployeePurchases: { type: Boolean, default: false },
      requireApproval: { type: Boolean, default: true },
      maxGiftCardValue: { type: Number, default: 500 },
      defaultCurrency: { type: String, default: 'USD' },
      notificationPreferences: {
        emailOnPurchase: { type: Boolean, default: true },
        emailOnRedemption: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Suspension tracking
    suspendedAt: {
      type: Date,
      default: null,
    },
    suspendReason: {
      type: String,
      default: null,
    },
    verificationDocuments: [{
      type: { type: String },
      url: String,
      uploadedAt: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
      },
    }],
    taxInfo: {
      taxId: String,
      taxExempt: { type: Boolean, default: false },
      taxExemptDocument: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
businessSchema.index({ slug: 1 });
businessSchema.index({ ownerId: 1 });
businessSchema.index({ 'employees.userId': 1 });
businessSchema.index({ industry: 1 });
businessSchema.index({ isActive: 1 });
businessSchema.index({ createdAt: -1 });

// Virtual for employee count
businessSchema.virtual('employeeCount').get(function () {
  return this.employees ? this.employees.length : 0;
});

// Pre-save middleware to generate slug
businessSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  }
  next();
});

// Method to add employee
businessSchema.methods.addEmployee = function (userId, department = '', position = '') {
  const exists = this.employees.find(
    (emp) => emp.userId.toString() === userId.toString()
  );
  if (exists) {
    throw new Error('Employee already exists');
  }
  this.employees.push({ userId, department, position });
  return this.save();
};

// Method to remove employee
businessSchema.methods.removeEmployee = function (userId) {
  this.employees = this.employees.filter(
    (emp) => emp.userId.toString() !== userId.toString()
  );
  return this.save();
};

// Method to update employee status
businessSchema.methods.updateEmployeeStatus = function (userId, status) {
  const employee = this.employees.find(
    (emp) => emp.userId.toString() === userId.toString()
  );
  if (employee) {
    employee.status = status;
  }
  return this.save();
};

// Method to check if user is admin
businessSchema.methods.isAdmin = function (userId) {
  return (
    this.ownerId.toString() === userId.toString() ||
    this.admins.some((admin) => admin.toString() === userId.toString())
  );
};

// Method to reset monthly budget
businessSchema.methods.resetMonthlyBudget = function () {
  this.budget.spent = 0;
  this.budget.lastResetDate = new Date();
  return this.save();
};

const Business = mongoose.model('Business', businessSchema);

module.exports = Business;
