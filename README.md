# FLC Accounts - Church Accounting & Multi-Level Governance System

A comprehensive accounting system designed for church organizations with hierarchical department structures and role-based access control.

## Features

### Core Functionality
- **Multi-Level Department Hierarchy**: Global → International → National → Regional → Campus → Stream → Council
- **Role-Based Access Control (RBAC)**: 12 different role levels with granular permissions
- **Transaction Management**: Income and expense tracking with file attachments
- **Transaction Approval Workflow**: Leaders submit requests, admins approve/reject
- **Weekly Locking**: Automatic locking of past weeks' transactions
- **Recursive Permissions**: Admins can view/manage child departments
- **Audit Trail**: Complete logging of all system actions
- **Financial Reports**: Generate reports by department
- **Dashboard Analytics**: Real-time financial statistics
- **Push Notifications**: Real-time PWA notifications for transaction approvals
- **Offline Support**: Progressive Web App with offline capabilities
- **Background Sync**: Automatic sync when connection is restored

### Security
- **NextAuth Authentication**: Secure credential-based authentication
- **Password Hashing**: bcrypt encryption for all passwords
- **Session Management**: JWT-based sessions
- **Permission Checks**: Server-side validation on all API routes

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
   Copy the generated keys to your `.env.local` file.

4. **Set up environment variables**

3. **Set up environment variables**
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

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Seed the database**
   ```bash
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Default Login Credentials

After seeding, you can log in with:

- **SuperAdmin**: `admin@flc.org` / `password123`
- **Campus Admin**: `campus.admin@flc.org` / `password123`
- **Council Leader**: `council.leader@flc.org` / `password123`

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

### Department Hierarchy
The system supports a 7-level hierarchy:
1. **Global** - Top-level organization
2. **International** - International branches
3. **National** - Country-level
4. **Regional** - Regional offices
5. **Campus** - Individual campuses
6. **Stream** - Ministry streams
7. **Council** - Smallest unit

### Roles and Permissions
- **SuperAdmin**: Full system access
- **Admins** (Global, International, National, Regional, Campus): Can manage their department and all child departments
- **Leaders** (Global, International, National, Regional, Campus, Stream, Council): Can view and create transactions for their department

### Transaction Locking
- Transactions are automatically locked after the week ends
- Locked transactions cannot be edited or deleted
- Prevents historical data manipulation
- Can be triggered via cron job: `/api/cron/lock-weeks`

### File Uploads
- Support for multiple file attachments per transaction
- Files stored in `public/uploads/`
- Accessible via transaction details

## API Routes

### Authentication
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout

### Transactions
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions` - Update transaction
- `DELETE /api/transactions?id={id}` - Delete transaction

### Departments
- `GET /api/departments` - List departments
- `POST /api/departments` - Create department

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user

### Dashboard
- `GET /api/dashboard/stats` - Get financial statistics

### File Upload
- `POST /api/upload` - Upload file

### Cron Jobs
- `GET /api/cron/lock-weeks` - Lock past weeks' transactions

## Database Schema

### Main Models
- **Department**: Hierarchical organization structure
- **User**: System users with roles
- **Transaction**: Financial transactions
- **File**: File attachments
- **AuditLog**: System audit trail

See `prisma/schema.prisma` for complete schema definition.

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

## Security Considerations

1. **Change default passwords** after first login
2. **Use strong NEXTAUTH_SECRET** in production
3. **Enable HTTPS** in production
4. **Set up proper CORS** policies
5. **Regular database backups**
6. **Implement rate limiting** for API routes
7. **Use environment-specific** `.env` files

## Future Enhancements

- [ ] PDF report generation
- [ ] Email notifications
- [ ] Budget planning module
- [ ] Advanced analytics with charts
- [ ] Multi-currency support
- [ ] Export to Excel/CSV
- [ ] Mobile app
- [ ] Two-factor authentication

## License

Private - All rights reserved

## Support

For support, contact your system administrator.
