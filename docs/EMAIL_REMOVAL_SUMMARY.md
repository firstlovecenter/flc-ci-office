# Email Integration Removed - SMS Only

## Summary
All email integration has been completely removed from the application. The system now uses **SMS exclusively** for all notifications.

## Changes Made

### 1. Password Reset (Forgot Password)
- **Before**: Email-based with fallback
- **After**: SMS-only via phone number
- **Route**: `/api/auth/forgot-password`
- **UI**: `/auth/forgot-password`
- **Changes**:
  - Accepts email or phone number as identifier
  - Sends 6-digit reset code via SMS to registered phone number
  - Updated UI to reflect SMS-only approach
  - Changed icon from Email to SMS

### 2. User Role Assignment Notifications
- **Before**: SMS preferred, email fallback
- **After**: SMS-only
- **Route**: `/api/users/[id]`
- **Changes**:
  - Removed all email fallback logic
  - First role assignment sends SMS with password setup code
  - Subsequent role changes send SMS notification
  - No email sent even if SMS fails

### 3. Files Deleted
- `src/lib/email.ts` - Email service
- `src/lib/email-templates/` - All email templates directory:
  - `welcome.ts`
  - `transaction-notification.ts`
  - `role-assignment.ts`
  - `password-reset.ts`
  - `first-role-assignment.ts`
  - `financial-report.ts`
  - `department-alert.ts`
- `src/app/api/cron/financial-reports/route.ts` - Email-only cron job
- `src/app/api/cron/department-alerts/route.ts` - Email-only cron job

### 4. Transaction Notifications
- **Route**: `/api/transactions`
- **Before**: Sent email to admins for pending transactions, email to users for status changes
- **After**: No email notifications (SMS could be added later if needed)

### 5. Dependencies Removed
From `package.json`:
- `mailersend@2.6.0`
  
Previous email providers (were already unused):
- Mailjet
- Resend

### 6. Environment Variables
No email API keys in `.env`:
- ❌ No MAILJET_*
- ❌ No RESEND_*
- ❌ No MAILERSEND_*
- ✅ Only `MNOTIFY_API_KEY` and `MNOTIFY_SENDER_ID`

## Current SMS Configuration

**Provider**: mNotify (Ghana SMS Gateway)
**Environment Variables**:
```env
MNOTIFY_API_KEY="IzlIz2VcSl1EcYwNSarKbmhKc"
MNOTIFY_SENDER_ID="CODESLAW"
```

**SMS Templates** (in `src/lib/sms-templates.ts`):
1. Password reset (6-digit code)
2. First role assignment (welcome + password setup)
3. Role assignment change
4. Transaction notifications
5. Department alerts
6. Week lock notifications
7. Approval reminders

## Phone Number Requirement

All users MUST have a phone number (made compulsory in previous update):
- Database schema: `phone String @unique` (required, unique)
- Forms: Phone field marked as `required`
- APIs: Validate phone presence
- Login: Can use phone number or email

## Important Notes

⚠️ **SMS-Only System**: No fallback to email if SMS fails. Make sure mNotify API key is valid and account has sufficient credits.

⚠️ **Placeholder Phone Numbers**: 6 existing users have placeholder phones (233000xxxxxx). These users need to update their phone numbers to receive notifications.

⚠️ **Transaction Notifications**: Currently removed. Consider adding SMS notifications for:
- Pending transaction approval requests (to admins)
- Transaction status changes (to users)

## Testing Checklist

- [x] Password reset sends SMS code
- [ ] First role assignment sends SMS with setup code
- [ ] Role change sends SMS notification
- [ ] Users can login with phone number
- [ ] All forms require phone number

## Future Enhancements

**Consider adding SMS notifications for**:
1. Transaction pending approval (to admin phones)
2. Transaction approved/rejected (to user phones)
3. Department alerts (configurable SMS alerts)
4. Weekly/monthly financial summaries (SMS digest)

**Cost Consideration**: SMS has per-message costs. Monitor mNotify usage and implement:
- Message batching
- Rate limiting
- User notification preferences
- SMS credit alerts
