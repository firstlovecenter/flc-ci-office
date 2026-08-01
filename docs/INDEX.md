# Documentation Index

Welcome to the FLC Accounts documentation. This index provides quick access to all technical documentation organized by topic.

## 📚 Quick Navigation

- [Quick Reference](./quick-reference.md) - Fast lookup for common tasks and fixes
- [Architecture](#architecture) - System design and technical details
- [Features](#features) - Feature documentation and implementation guides
- [User Guides](#user-guides) - End-user documentation
- [Roles & Permissions](#roles--permissions) - Role-based access control
- [Migrations](#migrations) - Database and system migrations

---

## 🏗️ Architecture

### Currency System
**[Currency System Status](./architecture/currency-system-status.md)**
- Multi-currency architecture overview
- Currency determination hierarchy (International → National → Sub-National)
- Conversion flow and dynamic calculations
- Exchange rate management
- Performance considerations
- **Related**: [Multi-Currency User Guide](./guides/multi-currency-user-guide.md), [Session Fix Summary](./migrations/session-fix-summary.md)

---

## ✨ Features

### Transaction Approval System
**[Approval Workflow](./features/approval-workflow.md)**
- Leader vs Admin transaction creation
- Approval/rejection process
- Transaction statuses (PENDING/APPROVED/REJECTED)
- API endpoints for approval actions
- UI components and filters
- **Related**: [Audit Logging](./features/audit-logging.md), [Push Notifications](./features/push-notifications.md)

### Account Closure
**[Closing an account](./features/account-closure.md)**
- Funds disposition — transfer the remaining balance or withdraw it
- Blockers (pending transactions) and warnings (overdrawn accounts)
- Atomic sweep + closure, and the BankAccount mirror write
- Closed accounts stay listed, faded and at the bottom
- Reopening — oversight and HQ only, never the campus that closed it
- Preflight, close and reopen endpoints, audit entries
- **Related**: [Bank-account split](./migrations/bank-account-split.md), [Audit Logging](./features/audit-logging.md)

### Audit Logging
**[Audit Logging System](./features/audit-logging.md)**
- Enhanced audit log schema
- Auto-generated descriptions
- Change tracking (before/after)
- Severity levels (LOW/MEDIUM/HIGH/CRITICAL)
- Metadata enrichment
- Querying and reporting
- **Related**: [Approval Workflow](./features/approval-workflow.md), [Role Management](./roles/role-management.md)

### Push Notifications
**[Push Notifications Setup](./features/push-notifications.md)**
- Web Push notifications overview
- VAPID key generation
- Browser support and PWA features
- API endpoints for subscription management
- Service worker configuration
- **Implementation**: [Push Notifications Implementation](./features/push-notifications-implementation.md)

**[Push Notifications Implementation](./features/push-notifications-implementation.md)**
- Complete implementation checklist
- Component details (PushNotificationManager)
- Database schema (PushSubscription model)
- Testing and production deployment
- Known issues and edge cases
- **Related**: [Approval Workflow](./features/approval-workflow.md)

---

## 📖 User Guides

### Multi-Currency Guide
**[Multi-Currency User Guide](./guides/multi-currency-user-guide.md)**
- Currency display rules by role
- Selecting base currency (National Admins)
- Recording transactions in multiple currencies
- Understanding exchange rates
- Dashboard and reporting
- Troubleshooting common issues
- **Technical Details**: [Currency System Status](./architecture/currency-system-status.md)

---

## 👥 Roles & Permissions

### Multiple Roles Per User
**[Multiple Roles Implementation](./roles/multiple-roles.md)**
- Users with multiple role assignments
- Role selection at login
- RoleSwitcher component
- Session management with multiple roles
- Database schema (roles array + activeRole)
- **Related**: [Role Management](./roles/role-management.md), [Multiple Admins](./roles/multiple-admins.md)

### Multiple Admins Per Department
**[Multiple Admins Per Department](./roles/multiple-admins.md)**
- Shared admin roles (except SUPERADMIN/GLOBAL_ADMIN)
- Role assignment rules and validation
- Team collaboration benefits
- API endpoints and error messages
- **Related**: [Multiple Roles](./roles/multiple-roles.md), [Role Management](./roles/role-management.md)

### Role Management
**[Role Management & SUPERADMIN Protection](./roles/role-management.md)**
- SUPERADMIN email lock mechanism
- Add/remove roles UI
- Role validation logic
- Email protection and security
- Testing and edge cases
- **Related**: [Multiple Roles](./roles/multiple-roles.md), [Multiple Admins](./roles/multiple-admins.md)

---

## 🗄️ Migrations

### Database Migrations

**[Multi-Department Role Support Migration](./migrations/multi-department-migration.md)**
- UserRole model introduction
- Migration from single department per user to multiple
- SQL migration scripts
- Application code updates needed
- **Related**: [Role Management](./roles/role-management.md), [Multiple Roles](./roles/multiple-roles.md)

**[Phone Number Migration](./migrations/phone-migration.md)**
- Phone field made required and unique
- Placeholder phone numbers for existing users
- SMS-first notification strategy
- Action items for users with placeholder numbers
- **Related**: [Email Removal Summary](./migrations/email-removal-summary.md)

**[Email Integration Removed](./migrations/email-removal-summary.md)**
- Complete removal of email notifications
- SMS-only system implementation
- Changes to password reset flow
- Deleted email templates and cron jobs
- **Related**: [Phone Migration](./migrations/phone-migration.md)

### Bug Fixes

**[Session Fix Summary - Currency Conversion](./migrations/session-fix-summary.md)**
- Critical async/Promise bug in currency conversion
- Root cause analysis
- Validation enhancements
- Comprehensive logging added
- FL Ghana verification results
- Rollout recommendations
- **Related**: [Currency System Status](./architecture/currency-system-status.md), [Multi-Currency User Guide](./guides/multi-currency-user-guide.md)

---

## 🔗 Cross-Reference Matrix

| Feature | Architecture | User Guide | Migrations |
|---------|-------------|-----------|-----------|
| **Multi-Currency** | [Currency System Status](./architecture/currency-system-status.md) | [User Guide](./guides/multi-currency-user-guide.md) | [Session Fix](./migrations/session-fix-summary.md) |
| **Approvals** | - | - | - |
| **Audit Logging** | - | - | - |
| **Push Notifications** | - | - | - |
| **Role System** | - | - | [Multi-Dept Migration](./migrations/multi-department-migration.md) |
| **SMS System** | - | - | [Email Removal](./migrations/email-removal-summary.md), [Phone Migration](./migrations/phone-migration.md) |

---

## 📋 Document Status

| Document | Status | Last Updated | Relevance |
|----------|--------|--------------|-----------|
| Currency System Status | ✅ Current | Latest | Active Feature |
| Multi-Currency User Guide | ✅ Current | Latest | Active Feature |
| Approval Workflow | ✅ Current | Nov 2024 | Active Feature |
| Audit Logging | ✅ Current | Nov 2024 | Active Feature |
| Push Notifications | ✅ Current | Dec 2024 | Active Feature |
| Push Notifications Implementation | ✅ Current | Dec 2024 | Active Feature |
| Multiple Roles | ✅ Current | Dec 2024 | Active Feature |
| Multiple Admins | ✅ Current | Dec 2024 | Active Feature |
| Role Management | ✅ Current | Dec 2024 | Active Feature |
| Multi-Department Migration | 📜 Historical | Dec 2024 | Migration Reference |
| Session Fix Summary | 📜 Historical | Latest | Bug Fix Reference |
| Phone Migration | 📜 Historical | Dec 2024 | Migration Reference |
| Email Removal Summary | 📜 Historical | Dec 2024 | Migration Reference |

**Legend:**
- ✅ Current - Active feature documentation
- 📜 Historical - Migration/fix reference (completed)

---

## 🆘 Getting Help

### For Developers
1. Check [Quick Reference](./quick-reference.md) for common operations
2. Review relevant feature documentation
3. Check migrations for historical context
4. See [Main README](../README.md) for setup and architecture

### For End Users
1. See [Multi-Currency User Guide](./guides/multi-currency-user-guide.md) for currency features
2. Contact your department admin for role and permission questions
3. Report bugs to system administrators

---

## 📝 Contributing to Documentation

When adding new documentation:

1. **Choose the right folder:**
   - `architecture/` - System design, technical architecture
   - `features/` - Feature specifications and implementation guides
   - `guides/` - End-user how-to guides
   - `migrations/` - Database migrations and system changes
   - `roles/` - Role and permission documentation

2. **Use descriptive filenames:** Use kebab-case (e.g., `multi-currency-guide.md`)

3. **Include cross-references:** Link to related documents

4. **Update this index:** Add your new document to the appropriate section

5. **Add to cross-reference matrix:** If your feature relates to multiple areas

---

**Last Updated**: February 2026  
**Maintained By**: Development Team
