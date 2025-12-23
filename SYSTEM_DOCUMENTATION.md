# GiftIt - Complete System Documentation

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Backend API](#backend-api)
4. [iOS Application](#ios-application)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Third-Party Integrations](#third-party-integrations)
8. [Authentication & Security](#authentication--security)
9. [User Flows](#user-flows)
10. [Business Features](#business-features)

---

## Overview

**GiftIt** is a digital gift card marketplace platform that allows consumers to purchase, send, and manage gift cards from hundreds of brands. The platform consists of:

- **Backend API**: Node.js/Express REST API with MongoDB
- **iOS App**: Native SwiftUI application
- **Gift Card Provider**: Runa API integration for real gift card fulfillment

### Key Features
- Browse and purchase gift cards from 100+ brands
- Send gift cards to others via email
- Recurring gift card subscriptions
- Digital wallet for managing owned cards
- Business accounts for employee rewards/campaigns
- Real-time notifications (push + email)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        iOS Application                          │
│                    (SwiftUI - Native iOS)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Backend API Server                          │
│                 (Node.js + Express + MongoDB)                   │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   Auth   │  │Gift Cards│  │  Users   │  │Campaigns │       │
│  │  Service │  │  Service │  │  Service │  │  Service │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  Stripe  │  │   Runa   │  │ Firebase │  │   AWS    │
    │ Payments │  │Gift Cards│  │   Push   │  │   S3     │
    └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Technology Stack

| Component | Technology |
|-----------|------------|
| Backend Runtime | Node.js 18+ |
| Web Framework | Express.js 5.x |
| Database | MongoDB (Mongoose ODM) |
| Authentication | JWT (jsonwebtoken) |
| Payments | Stripe |
| Gift Card Provider | Runa API |
| Push Notifications | Firebase Admin SDK |
| File Storage | AWS S3 |
| Email | Nodemailer |
| iOS App | SwiftUI (Swift 6) |

---

## Backend API

### Project Structure

```
giftitbackend/
├── src/
│   ├── app.js                 # Express app entry point
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   ├── aws.js             # AWS S3 configuration
│   │   └── stripe.js          # Stripe configuration
│   ├── middleware/
│   │   ├── auth.js            # JWT authentication
│   │   ├── errorHandler.js    # Global error handling
│   │   ├── rateLimiter.js     # Rate limiting
│   │   └── upload.js          # File upload (Multer + S3)
│   ├── models/
│   │   ├── User.js            # User schema
│   │   ├── GiftCard.js        # Gift card catalog
│   │   ├── GiftCardPurchase.js# Purchase records
│   │   ├── Transaction.js     # Financial transactions
│   │   ├── Subscription.js    # Recurring subscriptions
│   │   ├── Business.js        # Business accounts
│   │   ├── Campaign.js        # Business campaigns
│   │   └── Notification.js    # Push notifications
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── user.js            # User management
│   │   ├── giftcard.js        # Gift card browsing
│   │   ├── subscription.js    # Subscription management
│   │   ├── business.js        # Business operations
│   │   ├── campaign.js        # Campaign management
│   │   ├── transaction.js     # Transaction history
│   │   ├── notification.js    # Notifications
│   │   ├── admin.js           # Admin operations
│   │   └── webhook.js         # Stripe/Runa webhooks
│   ├── services/
│   │   ├── auth/              # Authentication logic
│   │   ├── user/              # User operations
│   │   ├── giftcard/          # Gift card operations
│   │   ├── subscription/      # Subscription logic
│   │   ├── business/          # Business logic
│   │   ├── campaign/          # Campaign execution
│   │   ├── transaction/       # Transaction handling
│   │   ├── notification/      # Push notifications
│   │   └── admin/             # Admin operations
│   ├── utils/
│   │   ├── runaApi.js         # Runa API client
│   │   ├── email.js           # Email templates/sending
│   │   ├── pushNotification.js# Firebase push
│   │   └── helpers.js         # Utility functions
│   ├── validators/            # Input validation
│   └── jobs/
│       └── scheduler.js       # Cron jobs
├── package.json
└── .env
```

### Environment Variables

```env
# Server
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/giftit

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Runa API
RUNA_API_KEY=xxx
RUNA_API_URL=https://playground.runa.io/v2

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=giftit-uploads

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=xxx
FIREBASE_PRIVATE_KEY=xxx
FIREBASE_CLIENT_EMAIL=xxx

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=xxx
SMTP_PASS=xxx
EMAIL_FROM=noreply@giftit.com
```

---

## iOS Application

### Project Structure

```
GiftIt/
├── GiftItApp.swift            # App entry point
├── ContentView.swift          # Root view controller
├── Models/
│   ├── AuthManager.swift      # Authentication state
│   └── MockData.swift         # Data models & mock data
├── Views/
│   ├── Auth/
│   │   └── AuthView.swift     # Login, SignUp, ForgotPassword
│   ├── Home/
│   │   └── HomeView.swift     # Home tab with featured cards
│   ├── Browse/
│   │   ├── BrowseView.swift   # Gift card catalog
│   │   └── GiftCardDetailView.swift # Card details + purchase flow
│   ├── Wallet/
│   │   ├── WalletView.swift   # User's owned cards
│   │   └── OwnedCardDetailView.swift # Card redemption
│   ├── Profile/
│   │   └── ProfileView.swift  # Profile + all settings
│   ├── MainTabView.swift      # Tab bar navigation
│   └── Components/
│       ├── GiftCardCell.swift # Reusable card cell
│       └── BalanceHeader.swift
├── Utils/
│   └── Theme.swift            # Colors, typography, spacing
└── Services/
    └── APIConfig.swift        # API configuration
```

### App Architecture

- **State Management**: `@Observable` (Swift 6 Observation framework)
- **Navigation**: `NavigationStack` with `navigationDestination`
- **UI Framework**: SwiftUI with custom theming
- **Color Scheme**: Light mode only (forced via `.preferredColorScheme(.light)`)

### Theme System

```swift
struct AppTheme {
    struct Colors {
        static let primary = Color(hex: "00D632")      // Green
        static let background = Color(hex: "FFFFFF")   // White
        static let cardBackground = Color(hex: "F2F2F7")
        static let textPrimary = Color(hex: "000000")
        static let textSecondary = Color(hex: "6B6B6B")
        static let error = Color(hex: "FF3B30")
    }

    struct Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    struct CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
    }
}
```

### Main App Screens

| Tab | Screen | Description |
|-----|--------|-------------|
| Home | HomeView | Featured cards, quick actions, personalized recommendations |
| Browse | BrowseView | Full catalog with search, filters, categories |
| Wallet | WalletView | Owned gift cards with balances |
| Profile | ProfileView | Settings, payment methods, purchase history |

---

## Data Models

### User Model
```javascript
{
  email: String,              // Unique, required
  password: String,           // Hashed with bcrypt
  firstName: String,
  lastName: String,
  phone: String,
  avatar: String,             // S3 URL
  role: 'user' | 'business' | 'admin' | 'superadmin',
  isEmailVerified: Boolean,
  isActive: Boolean,
  wallet: {
    balance: Number,
    currency: String
  },
  stripeCustomerId: String,
  defaultPaymentMethodId: String,
  preferences: {
    notifications: { email, push, sms },
    currency: String,
    language: String
  },
  deviceTokens: [{ token, platform, createdAt }],
  businessId: ObjectId,       // If business user
  affiliateCode: String,
  referredBy: ObjectId
}
```

### GiftCard Model (Catalog)
```javascript
{
  provider: 'runa' | 'tremendous' | 'tango' | 'internal',
  providerId: String,
  providerProductId: String,
  brandName: String,
  brandSlug: String,
  brandLogo: String,
  name: String,
  description: String,
  image: String,
  category: 'retail' | 'restaurants' | 'coffee' | 'entertainment' | ...,
  priceType: 'fixed' | 'variable',
  fixedAmounts: [Number],     // For fixed price cards
  minAmount: Number,          // For variable cards
  maxAmount: Number,
  currency: String,
  discount: Number,           // Percentage
  isAvailable: Boolean,
  countries: [String],
  redemptionType: 'code' | 'link' | 'barcode' | 'qr',
  redemptionInstructions: String,
  popularity: Number,
  totalSold: Number,
  featured: Boolean
}
```

### GiftCardPurchase Model
```javascript
{
  buyerId: ObjectId,
  giftCardId: ObjectId,
  amount: Number,
  quantity: Number,
  totalPaid: Number,
  discount: Number,

  // Recipient info
  recipientType: 'self' | 'gift' | 'business',
  recipientId: ObjectId,
  recipientEmail: String,
  recipientName: String,
  personalMessage: String,
  deliveryDate: Date,

  // Provider info
  provider: String,
  providerOrderId: String,
  providerStatus: String,

  // Redemption codes
  redemptionCodes: [{
    code: String,
    pin: String,
    barcode: String,
    link: String,
    expiresAt: Date,
    isRedeemed: Boolean,
    remainingBalance: Number
  }],

  status: 'pending' | 'processing' | 'completed' | 'delivered' |
          'partially_redeemed' | 'fully_redeemed' | 'cancelled' | 'refunded',
  paymentMethod: 'card' | 'wallet' | 'bank',
  paymentIntentId: String,
  paymentStatus: String,
  deliveryMethod: 'email' | 'sms' | 'in_app',
  deliveryStatus: String
}
```

### Subscription Model
```javascript
{
  userId: ObjectId,
  name: String,
  giftCardId: ObjectId,
  amount: Number,

  // Recipient
  recipientType: 'self' | 'other',
  recipientEmail: String,
  recipientName: String,
  personalMessage: String,

  // Schedule
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually',
  dayOfMonth: Number,
  startDate: Date,
  nextDeliveryDate: Date,
  lastDeliveryDate: Date,
  endDate: Date,

  // Payment
  paymentMethodId: String,
  stripeSubscriptionId: String,

  status: 'active' | 'paused' | 'cancelled' | 'completed' | 'failed',
  totalDeliveries: Number,
  maxDeliveries: Number,
  consecutiveFailures: Number,

  deliveryHistory: [{
    purchaseId: ObjectId,
    deliveredAt: Date,
    amount: Number,
    status: String
  }]
}
```

### Business Model
```javascript
{
  name: String,
  slug: String,
  email: String,
  phone: String,
  website: String,
  logo: String,
  description: String,
  industry: 'technology' | 'finance' | 'retail' | ...,
  size: '1-10' | '11-50' | '51-200' | ...,
  address: { street, city, state, zipCode, country },

  ownerId: ObjectId,
  admins: [ObjectId],
  employees: [{
    userId: ObjectId,
    department: String,
    position: String,
    status: 'active' | 'inactive' | 'pending'
  }],

  stripeCustomerId: String,
  billing: {
    plan: 'free' | 'starter' | 'professional' | 'enterprise',
    stripeSubscriptionId: String
  },

  budget: {
    monthly: Number,
    spent: Number,
    lastResetDate: Date
  },

  settings: {
    allowEmployeePurchases: Boolean,
    requireApproval: Boolean,
    maxGiftCardValue: Number
  },

  isVerified: Boolean,
  isActive: Boolean
}
```

### Campaign Model
```javascript
{
  businessId: ObjectId,
  createdBy: ObjectId,
  name: String,
  description: String,
  type: 'birthday' | 'holiday' | 'anniversary' | 'recognition' |
        'milestone' | 'onboarding' | 'custom',

  giftCardId: ObjectId,
  amount: Number,
  personalMessage: String,

  recipientType: 'all_employees' | 'department' | 'custom_list' | 'csv_upload',
  recipients: [{
    userId: ObjectId,
    email: String,
    name: String,
    status: 'pending' | 'sent' | 'delivered' | 'failed' | 'redeemed',
    purchaseId: ObjectId,
    sentAt: Date
  }],

  scheduleType: 'immediate' | 'scheduled' | 'recurring',
  scheduledDate: Date,
  recurring: {
    frequency: 'monthly' | 'quarterly' | 'annually',
    dayOfMonth: Number,
    nextOccurrence: Date
  },

  budget: { total, spent, perRecipient },
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled',

  stats: {
    totalRecipients: Number,
    sentCount: Number,
    deliveredCount: Number,
    failedCount: Number,
    redeemedCount: Number,
    totalAmountSent: Number
  },

  requiresApproval: Boolean,
  approvalStatus: 'pending' | 'approved' | 'rejected'
}
```

---

## API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login with email/password |
| POST | `/refresh-token` | Refresh access token |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password/:token` | Reset password |
| POST | `/verify-email/:token` | Verify email address |
| POST | `/resend-verification` | Resend verification email |
| POST | `/change-password` | Change password (authenticated) |
| POST | `/logout` | Logout (remove device token) |
| GET | `/me` | Get current user |

### Users (`/api/v1/user`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update profile |
| PUT | `/avatar` | Upload avatar |
| DELETE | `/avatar` | Remove avatar |
| GET | `/wallet` | Get wallet balance |
| POST | `/wallet/add-funds` | Add funds to wallet |
| GET | `/payment-methods` | List payment methods |
| POST | `/payment-methods` | Add payment method |
| DELETE | `/payment-methods/:id` | Remove payment method |
| PUT | `/preferences` | Update preferences |
| POST | `/device-token` | Register device token |
| DELETE | `/device-token` | Remove device token |

### Gift Cards (`/api/v1/gift-cards`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all gift cards |
| GET | `/search` | Search gift cards |
| GET | `/categories` | Get all categories |
| GET | `/featured` | Get featured cards |
| GET | `/popular` | Get popular cards |
| GET | `/category/:category` | Get cards by category |
| GET | `/:id` | Get card details |
| POST | `/purchase` | Purchase gift card |
| GET | `/purchases` | Get user purchases |
| GET | `/purchases/:id` | Get purchase details |
| GET | `/received` | Get received gift cards |
| PUT | `/purchases/:id/balance` | Update balance tracking |
| POST | `/purchases/:id/cancel` | Cancel purchase |

### Subscriptions (`/api/v1/subscriptions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List user subscriptions |
| POST | `/` | Create subscription |
| GET | `/:id` | Get subscription details |
| PUT | `/:id` | Update subscription |
| POST | `/:id/pause` | Pause subscription |
| POST | `/:id/resume` | Resume subscription |
| POST | `/:id/cancel` | Cancel subscription |

### Business (`/api/v1/businesses`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create business |
| GET | `/me` | Get current business |
| PUT | `/:id` | Update business |
| GET | `/:id/employees` | List employees |
| POST | `/:id/employees` | Add employee |
| DELETE | `/:id/employees/:userId` | Remove employee |
| GET | `/:id/transactions` | Get transactions |
| GET | `/:id/stats` | Get business stats |

### Campaigns (`/api/v1/campaigns`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List business campaigns |
| POST | `/` | Create campaign |
| GET | `/:id` | Get campaign details |
| PUT | `/:id` | Update campaign |
| POST | `/:id/start` | Start campaign |
| POST | `/:id/pause` | Pause campaign |
| POST | `/:id/resume` | Resume campaign |
| POST | `/:id/cancel` | Cancel campaign |
| POST | `/:id/recipients` | Add recipients |
| DELETE | `/:id/recipients/:recipientId` | Remove recipient |

### Transactions (`/api/v1/transactions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List transactions |
| GET | `/:id` | Get transaction details |
| GET | `/summary` | Get transaction summary |

### Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List notifications |
| PUT | `/:id/read` | Mark as read |
| PUT | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete notification |

### Webhooks (`/api/v1/webhooks`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stripe` | Stripe webhook handler |
| POST | `/runa` | Runa webhook handler |

### Admin (`/api/v1/admin`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List all users |
| GET | `/users/:id` | Get user details |
| PUT | `/users/:id` | Update user |
| POST | `/users/:id/ban` | Ban user |
| GET | `/gift-cards/sync` | Sync from Runa |
| PUT | `/gift-cards/:id` | Update gift card |
| GET | `/transactions` | All transactions |
| GET | `/stats` | Platform statistics |

---

## Third-Party Integrations

### Runa API (Gift Card Provider)

**Base URL**: `https://api.runa.io/v2` (production) or `https://playground.runa.io/v2` (sandbox)

**Authentication**: API Key via `X-Api-Key` header

**Key Operations**:
- `GET /product` - Get gift card catalog
- `POST /orders` - Create order (purchase)
- `GET /orders/:id` - Get order status
- `GET /orders/:id/codes` - Get redemption codes
- `POST /orders/:id/cancel` - Cancel order
- `GET /account/balance` - Check account balance

**Webhook Events**:
- `order.completed` - Order fulfilled
- `order.failed` - Order failed
- `order.delivered` - Gift card delivered

### Stripe (Payments)

**Key Features Used**:
- Payment Intents for card payments
- Customers for user management
- Payment Methods for saved cards
- Webhooks for payment events

**Webhook Events**:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `customer.subscription.updated`

### Firebase (Push Notifications)

**Service**: Firebase Cloud Messaging (FCM)

**Notification Types**:
- Gift card received
- Order completed
- Subscription reminder
- Promotional notifications

### AWS S3 (File Storage)

**Usage**:
- User avatars
- Business logos
- Verification documents

---

## Authentication & Security

### JWT Authentication

```javascript
// Access Token (7 days)
{
  userId: ObjectId,
  role: 'user' | 'business' | 'admin',
  iat: timestamp,
  exp: timestamp
}

// Refresh Token (30 days)
{
  userId: ObjectId,
  type: 'refresh',
  iat: timestamp,
  exp: timestamp
}
```

### Security Features

1. **Password Hashing**: bcrypt with 12 salt rounds
2. **Rate Limiting**: Per-IP and per-user limits
3. **Account Lockout**: 5 failed attempts = 2 hour lockout
4. **Input Validation**: express-validator on all inputs
5. **CORS**: Restricted origins
6. **Helmet**: Security headers
7. **Email Verification**: Required for full access
8. **Webhook Validation**: Signature verification

### Rate Limits

| Endpoint Type | Limit |
|--------------|-------|
| Authentication | 5 requests/minute |
| API (General) | 100 requests/minute |
| Purchase | 10 requests/minute |
| Webhook | Unlimited |

---

## User Flows

### Purchase Flow (iOS App)

```
1. Browse → Select Gift Card
2. GiftCardDetailView
   - Select amount (fixed or variable)
   - Toggle "Send as a gift"
   - Tap "Purchase" / "Continue to Gift"
3. GiftRecipientView (if gift)
   - Enter recipient name
   - Enter recipient email
   - Add personal message (optional)
   - Tap "Continue to Payment"
4. CheckoutView
   - View order summary
   - Select payment method (Visa, Apple Pay, Wallet)
   - View price breakdown
   - Tap "Pay $X.XX"
   - Show processing animation
5. PurchaseSuccessView
   - Checkmark animation
   - Card preview
   - "View in Wallet" / "Done" buttons
```

### Authentication Flow

```
1. App Launch → ContentView
2. Check authManager.isLoggedIn
3. If not logged in → LoginView
   - Email/password fields
   - "Sign In" button (loading state)
   - "Forgot Password?" link
   - "Sign Up" link
4. If logged in → MainTabView
   - Home, Browse, Wallet, Profile tabs
```

### Gift Card Redemption Flow

```
1. Open Wallet tab
2. Select owned gift card
3. View OwnedCardDetailView
   - Card image and amount
   - Remaining balance
   - Redemption code + PIN
   - Copy code button
   - Track spending
   - View redemption instructions
```

---

## Business Features

### Campaign Types

| Type | Description | Use Case |
|------|-------------|----------|
| Birthday | Automatic birthday gifts | Employee birthdays |
| Holiday | Seasonal/holiday gifts | Christmas, New Year |
| Anniversary | Work anniversary rewards | Tenure milestones |
| Recognition | Spot recognition awards | Performance rewards |
| Milestone | Company achievement gifts | Goals reached |
| Onboarding | New hire welcome gifts | Employee orientation |
| Custom | Ad-hoc campaigns | Any purpose |

### Campaign Scheduling

- **Immediate**: Sends right away
- **Scheduled**: One-time future date
- **Recurring**: Monthly, quarterly, or annually

### Budget Management

- Monthly budget limits
- Per-campaign budgets
- Spending tracking
- Automatic budget reset

### Approval Workflow

1. Create campaign (draft)
2. Submit for approval
3. Admin reviews
4. Approve or reject
5. Campaign activates (if approved)

---

## Running the System

### Backend

```bash
# Install dependencies
cd giftitbackend
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Sync gift cards from Runa
npm run sync-giftcards

# Start development server
npm run dev

# Start production server
npm start
```

### iOS App

```bash
# Open in Xcode
cd GiftIt
open GiftIt.xcodeproj

# Build and run on simulator
# Or connect device and run
```

---

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Version Information

- **Backend Version**: 1.0.0
- **iOS App Version**: 1.0.0
- **API Version**: v1
- **Last Updated**: December 21, 2025
