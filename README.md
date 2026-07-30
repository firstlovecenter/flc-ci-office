# FLC Accounts - CI OFFICE & Multi-Level Governance System

A comprehensive accounting system designed for church organizations with hierarchical department structures and role-based access control.

> **📚 Full Documentation**: See [docs/INDEX.md](./docs/INDEX.md) for complete technical documentation organized by topic.

## Table of Contents
- [Documentation](#-documentation)
- [Features Overview](#features-overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Key Features Explained](#key-features-explained)
- [API Routes](#api-routes)
- [Database Schema](#database-schema)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [Security Considerations](#security-considerations)
- [Implemented Features](#implemented-features-)
- [Future Enhancements](#future-enhancements)

---

## 📖 Documentation

This project has extensive documentation organized by topic. For developers joining the project, start with:

### Quick References
- **[Quick Reference Guide](./docs/quick-reference.md)** - Common tasks and commands
- **[Documentation Index](./docs/INDEX.md)** - Complete documentation hub

### Architecture & Technical Design
- [Currency System Architecture](./docs/architecture/currency-system-status.md) - Multi-currency conversion system

### Features & Capabilities  
- [Approval Workflow](./docs/features/approval-workflow.md) - Transaction approval system
- [Audit Logging](./docs/features/audit-logging.md) - Enhanced audit trail with field-level tracking
- [Push Notifications](./docs/features/push-notifications.md) - PWA push notification system
- [Push Notifications Implementation](./docs/features/push-notifications-implementation.md) - Technical implementation details

### Roles & Permissions
- [Role Management](./docs/roles/role-management.md) - Role system overview
- [Multiple Admins](./docs/roles/multiple-admins.md) - Multi-admin support per department
- [Multiple Roles](./docs/roles/multiple-roles.md) - Users with multiple role-department combinations

### Migration Notes
- [Multi-Department Migration](./docs/migrations/multi-department-migration.md) - UserRole system migration
- [Session Fix](./docs/migrations/session-fix-summary.md) - Session management updates
- [Email Removal](./docs/migrations/email-removal-summary.md) - SMS-only transition
- [Phone Migration](./docs/migrations/phone-migration.md) - Phone field implementation

### User Guides
- [Multi-Currency User Guide](./docs/guides/multi-currency-user-guide.md) - End-user currency guide

---

## Features Overview

### Core Functionality
- **Church hierarchy**: HQ → Oversight → Campus (campus is the lowest church level). Bank accounts attach under campuses and are not a church level (see [Multi-Department Migration](./docs/migrations/multi-department-migration.md))
- **Role-Based Access Control (RBAC)**: Managers, holders, and account holders with granular permissions (see [Role Management](./docs/roles/role-management.md))
- **Transaction Management**: Deposit and withdrawal tracking with file attachments
- **Transaction Approval Workflow**: Account holders submit withdrawal requests, managers approve/reject (see [Approval Workflow](./docs/features/approval-workflow.md))
- **Multi-Currency Support**: Track transactions in multiple currencies with automatic conversion (see [Multi-Currency User Guide](./docs/guides/multi-currency-user-guide.md))
- **Weekly Locking**: Automatic locking of past weeks' transactions
- **Recursive Permissions**: Managers can view/manage churches and accounts in their scope
- **Audit Trail**: Complete logging of all system actions (see [Audit Logging](./docs/features/audit-logging.md))
- **Financial Reports**: Generate reports by church or account
- **Dashboard Analytics**: Real-time financial statistics
- **Push Notifications**: Real-time PWA notifications for transaction approvals (see [Push Notifications](./docs/features/push-notifications.md))
- **Offline Support**: Progressive Web App with offline capabilities
- **Background Sync**: Automatic sync when connection is restored

> **📖 See Also**: 
> - [Approval Workflow Documentation](./docs/features/approval-workflow.md)
> - [Multi-Currency User Guide](./docs/guides/multi-currency-user-guide.md)
> - [Push Notifications Setup](./docs/features/push-notifications.md)

### Security
- **NextAuth Authentication**: Secure credential-based authentication
- **Password Hashing**: bcrypt encryption for all passwords
- **Session Management**: JWT-based sessions
- **Permission Checks**: Server-side validation on all API routes
- **Audit Trail**: Complete logging of all system actions ([docs](./docs/features/audit-logging.md))

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **UI**: Material-UI (MUI)
- **Language**: TypeScript
- **File Uploads**: Local filesystem storage

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd flc-accounts
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate VAPID keys for push notifications**
   ```bash
   node scripts/generate-vapid-keys.js
   ```
   Copy the generated keys to your `.env.local` file. See [Push Notifications Setup](./docs/features/push-notifications.md) for details.

4. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/flc_accounts"

   # NextAuth
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"

   # Cron Secret (for locking transactions)
   CRON_SECRET="your-cron-secret-here"
   ```

5. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

6. **Seed the database**
   ```bash
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

> **💡 For detailed setup instructions**, see [Multi-Currency User Guide](./docs/guides/multi-currency-user-guide.md) and [Quick Reference](./docs/quick-reference.md)

### Default Login Credentials

After seeding, you can log in with:

- **SuperAdmin**: `admin@flc.org` / `password123`
- **Campus Manager**: `campus.admin@flc.org` / `password123`
- **Account Holder**: `council.leader@flc.org` / `password123`

> **🔒 For role information**, see [Role Management](./docs/roles/role-management.md) and [Multiple Admins](./docs/roles/multiple-admins.md)

## Project Structure

```
flc-accounts/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeding script
├── src/
│   ├── app/
│   │   ├── api/            # API routes
│   │   │   ├── auth/       # NextAuth configuration
│   │   │   ├── transactions/
│   │   │   ├── departments/
│   │   │   ├── users/
│   │   │   ├── upload/     # File upload endpoint
│   │   │   ├── dashboard/
│   │   │   └── cron/       # Cron jobs
│   │   ├── dashboard/      # Dashboard page
│   │   ├── transactions/   # Transaction pages
│   │   ├── departments/    # Department pages
│   │   ├── users/          # User management
│   │   ├── reports/        # Reports page
│   │   └── auth/login/     # Login page
│   ├── components/         # React components
│   ├── lib/
│   │   ├── auth.ts         # NextAuth configuration
│   │   ├── prisma.ts       # Prisma client
│   │   ├── departments.ts  # Department utilities
│   │   └── utils.ts        # Utility functions
│   └── types/              # TypeScript type definitions
└── public/
    └── uploads/            # Uploaded files storage
```

## Key Features Explained

### Church hierarchy
Churches only — no money at these levels:
1. **HQ** - Denominational headquarters
2. **Oversight** - Oversight regions or zones
3. **Campus** - Lowest church / organisation level

### Bank accounts
Accounts sit under a campus. They are not churches and not part of the hierarchy ladder.
- **Operating** — deposits + withdrawals, balance, expense window
- **Special project** — withdrawals only, receipt-gated

### Roles and Permissions
- **SuperAdmin**: Full system access (email-locked to primary admin)
- **Managers** (HQ, Oversight, Campus): Can manage churches and accounts in their scope
- **Holders** (HQ, Oversight, Campus): Church-level holders for their unit
- **Account holders**: Request withdrawals / track balance on their bank account
- **Multiple Roles**: Users can have multiple role–church combinations and switch between them

> **📖 See**: [Role Management](./docs/roles/role-management.md) | [Multiple Admins](./docs/roles/multiple-admins.md) | [Multiple Roles](./docs/roles/multiple-roles.md)

### Transaction Locking
- Transactions are automatically locked after the week ends
- Locked transactions cannot be edited or deleted
- Prevents historical data manipulation
- Can be triggered via cron job: `/api/cron/lock-weeks`

### Multi-Currency System
- **Base Currencies**: Denomination and Oversight admins can select their department's base currency
- **Automatic Conversion**: Transactions converted to user's contextual currency
- **Exchange Rates**: System maintains rates between currencies
- **Dynamic Calculation**: Conversions happen in real-time during data fetch
- **Hierarchy**: Sub-departments inherit their parent's base currency unless explicitly set

> **📖 See**: [Currency Architecture](./docs/architecture/currency-system-status.md) | [User Guide](./docs/guides/multi-currency-user-guide.md)

### Communication Channels
- **Authentication**: Email-based login with phone number as secondary identifier
- **SMS Notifications**: Primary notification channel via SMSOptics (Ghana)
  - Password reset codes
  - Role assignment notifications
  - Transaction alerts
- **Push Notifications**: PWA push notifications for real-time updates
  - Transaction approvals/rejections
  - System alerts

> **📖 See**: [Push Notifications](./docs/features/push-notifications.md) | [Phone Migration](./docs/migrations/phone-migration.md)

### File Uploads
- Support for multiple file attachments per transaction
- Files stored in `public/uploads/`
- Accessible via transaction details

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth endpoints
- `POST /api/auth/forgot-password` - Request password reset (SMS)
- `POST /api/auth/reset-password` - Reset password with code

### Transactions
- `GET /api/transactions` - List transactions (with currency conversion)
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions` - Update transaction
- `DELETE /api/transactions?id={id}` - Delete transaction
- `POST /api/transactions/[id]/approve` - Approve/reject transaction
- `POST /api/transactions/[id]/correct` - Correct transaction amount

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department
- `GET /api/departments/[id]` - Get department details
- `GET /api/departments/[id]/stats` - Get department statistics

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/[id]` - Update user
- `GET /api/users/me` - Get current user with base currency
- `PATCH /api/users/me` - Update current user (includes base currency)
- `POST /api/users/select-role` - Switch active role

### Currencies
- `GET /api/currencies` - List all currencies
- `POST /api/currencies` - Create currency
- `PUT /api/currencies/[id]` - Update currency
- `GET /api/exchange-rates` - List exchange rates
- `POST /api/exchange-rates` - Create exchange rate
- `POST /api/currencies/recalculate` - Recalculate transaction amounts

### Admin
- `GET /api/admin/base-currencies` - View department base currencies
- `POST /api/admin/base-currencies` - Set base currency for department
- `GET /api/admin/sms-templates` - Get SMS templates
- `POST /api/admin/sms/send` - Send manual SMS

### Notifications
- `POST /api/notifications/subscribe` - Subscribe to push notifications
- `DELETE /api/notifications/subscribe` - Unsubscribe
- `POST /api/notifications/send` - Send push notification

### Audit
- `GET /api/audit` - Get audit logs (superadmin only)

### Dashboard
- `GET /api/dashboard/stats` - Get financial statistics (currency-converted)

### File Upload
- `POST /api/upload` - Upload file
- `POST /api/users/upload-image` - Upload user avatar
- `POST /api/profile/upload-image` - Upload profile image

### Reports
- `POST /api/reports/pdf` - Generate PDF report

### Cron Jobs
- `GET /api/cron/lock-weeks` - Lock past weeks' transactions

> **📝 Note**: All transaction and dashboard endpoints automatically convert amounts to user's contextual base currency

> **🔐 For role information**, see [Role Management](./docs/roles/role-management.md) and [Multiple Admins](./docs/roles/multiple-admins.md)

## Database Schema

### Main Models
- **Department**: Hierarchical organization structure (5 levels: DENOMINATION, OVERSIGHT, CAMPUS, STREAM, COUNCIL)
- **User**: System users with multiple roles
- **UserRole**: Role-department assignments (many-to-many)
- **Transaction**: Financial transactions with currency support
- **Currency**: Supported currencies (USD, GHS, EUR, etc.)
- **ExchangeRate**: Exchange rates between currencies
- **DepartmentBaseCurrency**: Department currency preferences (typically set at Denomination/Oversight level)
- **File**: File attachments for transactions
- **AuditLog**: Enhanced audit trail with field-level changes
- **PushSubscription**: Web push notification subscriptions
- **SMSTemplate**: SMS message templates

### Key Relationships
- User ↔ UserRole ↔ Department (many-to-many via UserRole)
- Transaction → Currency (original currency)
- Transaction → Department (belongs to)
- Department ↔ DepartmentBaseCurrency (optional base currency)
- Currency ↔ ExchangeRate (bidirectional rates)

See `prisma/schema.prisma` for complete schema definition.

> **📖 See**: [Multi-Department Migration](./docs/migrations/multi-department-migration.md) for UserRole details

## Development

### Running Migrations
```bash
npx prisma migrate dev --name migration_name
```

### Viewing Database
```bash
npx prisma studio
```

### Building for Production
```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| NEXTAUTH_SECRET | Secret for NextAuth | Yes |
| NEXTAUTH_URL | Application URL | Yes |
| CRON_SECRET | Secret for cron endpoints | Yes |
| SMSOPTICS_API_KEY | SMSOptics API key for SMS | Yes |
| SMSOPTICS_SENDER_ID | SMS sender ID (e.g., CI-OFFICE) | Yes |
| NEXT_PUBLIC_VAPID_PUBLIC_KEY | VAPID public key for push notifications | Yes |
| VAPID_PRIVATE_KEY | VAPID private key for push notifications | Yes |
| VAPID_SUBJECT | Contact email for VAPID | Yes |

> **💡 Tip**: Run `node scripts/generate-vapid-keys.js` to generate VAPID keys

## Security Considerations

1. **Change default passwords** after first login
2. **Use strong NEXTAUTH_SECRET** in production
3. **Enable HTTPS** in production
4. **Set up proper CORS** policies
5. **Regular database backups**
6. **Implement rate limiting** for API routes
7. **Use environment-specific** `.env` files

## Implemented Features ✅

- [x] Multi-currency support with automatic conversion
- [x] PDF report generation
- [x] Export to CSV
- [x] Advanced audit logging
- [x] Push notifications (PWA)
- [x] SMS notifications
- [x] Offline support (PWA)
- [x] Transaction approval workflow
- [x] Multiple roles per user
- [x] Role switching
- [x] Department base currencies

## Future Enhancements

- [ ] Budget planning module
- [ ] Financial forecasting
- [ ] Automated exchange rate updates
- [ ] Mobile app (native)
- [ ] Two-factor authentication (SMS-based)
- [ ] Recurring transactions
- [ ] Transaction templates
- [ ] Advanced analytics dashboards
- [ ] Department budgets and limits
- [ ] Approval delegation

## License

Private - All rights reserved

## Support

For support, contact your system administrator.
