# Email Integration - Cron Jobs Setup

This document explains how to set up scheduled email notifications for the CI Office Financial System.

## Overview

The system includes two scheduled email features:

1. **Financial Reports** - Weekly/Monthly summaries of department financial activity
2. **Department Alerts** - Automated alerts for pending transactions and inactivity

## Environment Variables

Add these to your `.env` file:

```env
# Cron job authentication
CRON_SECRET=your-secure-random-secret-here

# Email configuration (already set up)
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_SECRET_KEY=your-mailjet-secret-key
MAILJET_SENDER_EMAIL=your-verified-sender@example.com
MAILJET_SENDER_NAME=CI Office
APP_URL=https://your-production-domain.com
```

Generate a secure CRON_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API Endpoints

### 1. Financial Reports
- **Endpoint**: `POST /api/cron/financial-reports`
- **Authentication**: Bearer token in Authorization header
- **Payload**:
  ```json
  {
    "reportType": "weekly" | "monthly"
  }
  ```

### 2. Department Alerts
- **Endpoint**: `POST /api/cron/department-alerts`
- **Authentication**: Bearer token in Authorization header
- **No payload required**

## Scheduling Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/financial-reports",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/department-alerts",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Note**: Vercel Cron automatically handles authentication. Update the endpoints to skip auth check when `req.headers.get('x-vercel-cron')` is present.

### Option 2: External Cron Service (cron-job.org, EasyCron, etc.)

1. Create a new cron job for each endpoint
2. Set the URL to your production endpoints
3. Add Authorization header: `Bearer YOUR_CRON_SECRET`
4. Set the schedule:
   - **Weekly Reports**: `0 9 * * 1` (Every Monday at 9 AM)
   - **Monthly Reports**: `0 9 1 * *` (1st of month at 9 AM)
   - **Department Alerts**: `0 8 * * *` (Daily at 8 AM)

Example cURL commands:

```bash
# Weekly financial reports
curl -X POST https://your-domain.com/api/cron/financial-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reportType": "weekly"}'

# Monthly financial reports
curl -X POST https://your-domain.com/api/cron/financial-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reportType": "monthly"}'

# Department alerts
curl -X POST https://your-domain.com/api/cron/department-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 3: GitHub Actions

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Scheduled Email Jobs

on:
  schedule:
    # Weekly reports - Every Monday at 9 AM UTC
    - cron: '0 9 * * 1'
    # Department alerts - Daily at 8 AM UTC
    - cron: '0 8 * * *'

jobs:
  weekly-reports:
    if: github.event.schedule == '0 9 * * 1'
    runs-on: ubuntu-latest
    steps:
      - name: Send Weekly Reports
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/financial-reports \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{"reportType": "weekly"}'

  department-alerts:
    if: github.event.schedule == '0 8 * * *'
    runs-on: ubuntu-latest
    steps:
      - name: Check Department Alerts
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/department-alerts \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets to your GitHub repository:
- `APP_URL`: Your production URL
- `CRON_SECRET`: Your cron secret key

## Alert Thresholds

The following thresholds trigger department alerts:

### High Pending Transactions
- **Count**: 5+ pending transactions
- **Amount**: GHS 5,000+ total pending amount

### Low Activity
- **Days**: 14+ days with no transactions

### Budget Threshold (Future)
- **Percentage**: 85%+ of allocated budget used

These can be adjusted in `/api/cron/department-alerts/route.ts`.

## Testing

Test the endpoints locally:

```bash
# Test financial reports
curl -X POST http://localhost:3000/api/cron/financial-reports \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"reportType": "weekly"}'

# Test department alerts
curl -X POST http://localhost:3000/api/cron/department-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Email Recipients

### Financial Reports
Sent to:
- Department admins (all admin roles for that department)
- SUPERADMIN users (receive reports for all departments)

### Department Alerts
Sent to:
- Department admins (all admin roles for that department)
- SUPERADMIN users (receive alerts for all departments)

## Monitoring

Both endpoints return JSON responses with details:

```json
{
  "success": true,
  "results": [
    {
      "department": "Finance",
      "recipient": "admin@example.com",
      "status": "sent" | "failed",
      "error": "Error message if failed"
    }
  ]
}
```

Check your server logs for any email delivery issues.

## Troubleshooting

### Emails not being sent
1. Verify Mailjet sender email is verified in Mailjet dashboard
2. Check `MAILJET_API_KEY` and `MAILJET_SECRET_KEY` are correct
3. Ensure `CRON_SECRET` matches in both `.env` and cron job config

### Reports are empty
- Check that transactions exist in the database for the date range
- Verify department assignments are correct
- Check admin role assignments

### Alerts not triggering
- Verify thresholds are being met (pending count, inactivity days)
- Check department data exists
- Ensure users have admin roles assigned

## Production Checklist

- [ ] Set `CRON_SECRET` environment variable
- [ ] Verify Mailjet sender email in dashboard
- [ ] Test both cron endpoints locally
- [ ] Set up cron scheduling (Vercel/external/GitHub Actions)
- [ ] Monitor first scheduled run
- [ ] Verify email delivery to recipients
- [ ] Adjust thresholds if needed
