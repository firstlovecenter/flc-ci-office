# Transaction Approval Workflow

## Overview
Leaders (STREAM_LEADER, COUNCIL_LEADER) can only submit expense requests that require approval from admins (CAMPUS_ADMIN and above). This ensures proper financial oversight and control.

## Database Schema Changes

### Transaction Model Updates
Added the following fields to the `Transaction` model in `prisma/schema.prisma`:

- `status` - TransactionStatus enum (PENDING, APPROVED, REJECTED)
- `approvedBy` - ID of the user who approved/rejected the transaction
- `approvedAt` - Timestamp when the transaction was approved
- `rejectionReason` - Reason provided when rejecting a transaction

### Migration
Migration file: `20251120161421_add_transaction_approval_system`

## Approval Flow

### 1. Transaction Creation
- **Leaders (STREAM_LEADER, COUNCIL_LEADER)**:
  - Create transactions with `status: PENDING`
  - Cannot approve their own requests
  - Transactions do not affect financial totals until approved

- **Admins (CAMPUS_ADMIN and above)**:
  - Create transactions with `status: APPROVED`
  - Transactions are auto-approved with `approvedBy` and `approvedAt` set
  - Immediately affect financial totals

### 2. Approval Process
Admins can approve or reject pending transactions through:

**API Endpoint**: `POST /api/transactions/[id]/approve`

**Request Body**:
```json
{
  "action": "approve" | "reject",
  "reason": "Optional rejection reason"
}
```

**Permissions**:
- Only admins (CAMPUS_ADMIN and above) can approve/reject
- Admins can only approve transactions in their oversight area
- Transactions must be in PENDING status
- Creates audit log entry for tracking

### 3. Transaction Statuses

- **PENDING** (Yellow/Warning):
  - Waiting for admin approval
  - Not included in financial totals
  - Only visible to creator and admins with oversight

- **APPROVED** (Green/Success):
  - Approved by authorized admin
  - Included in financial totals and reports
  - Shows approval metadata (who approved, when)

- **REJECTED** (Red/Error):
  - Rejected by admin with reason
  - Not included in financial totals
  - Rejection reason visible to creator

## UI Components

### Transactions Page (`/transactions`)

**Filters**:
- Type (Income/Expense)
- Lock Status (Locked/Open)
- **Approval Status** (All/Pending/Approved/Rejected) - NEW

**Status Column**:
- Shows approval status with color-coded chip
- Shows lock status if week is locked
- Color scheme:
  - PENDING: Yellow outline
  - APPROVED: Green filled
  - REJECTED: Red filled

**Actions Column**:
- **Approve Button** (Green checkmark):
  - Visible only to admins
  - Only for PENDING transactions
  - Confirms before approving

- **Reject Button** (Red X):
  - Visible only to admins
  - Only for PENDING transactions
  - Prompts for rejection reason
  - Requires reason to proceed

**Financial Summary**:
- Total Income: Only APPROVED transactions
- Total Expense: Only APPROVED transactions
- Net Balance: Only APPROVED transactions

## Testing Checklist

### As Leader (STREAM_LEADER/COUNCIL_LEADER)
- [ ] Create new expense transaction
- [ ] Verify status shows as PENDING
- [ ] Verify transaction NOT included in totals
- [ ] Cannot see approve/reject buttons
- [ ] Cannot edit other users' pending transactions

### As Admin (CAMPUS_ADMIN and above)
- [ ] Create new expense transaction
- [ ] Verify status shows as APPROVED automatically
- [ ] Verify transaction included in totals immediately
- [ ] View pending transactions from leaders in oversight area
- [ ] Approve a pending transaction
- [ ] Reject a pending transaction with reason
- [ ] Verify approved transaction now in totals
- [ ] Verify rejected transaction NOT in totals
- [ ] Cannot approve transactions outside oversight area

### Filters and Display
- [ ] Filter by "Pending" shows only pending transactions
- [ ] Filter by "Approved" shows only approved transactions
- [ ] Filter by "Rejected" shows only rejected transactions
- [ ] Combined filters work correctly (e.g., Pending + Expense)
- [ ] Search works with approval status filter

## Future Enhancements

1. **Notifications**:
   - Email notification when transaction pending approval
   - Email notification when transaction approved/rejected
   - Push notifications for mobile app

2. **Dashboard Widget**:
   - Show count of pending approvals for admins
   - Show pending request status for leaders

3. **Reports**:
   - Option to include/exclude pending transactions in reports
   - Approval audit trail report
   - Time-to-approval metrics

4. **Bulk Actions**:
   - Approve multiple transactions at once
   - Bulk reject with same reason

5. **Comments/Discussion**:
   - Allow back-and-forth discussion on pending transactions
   - Request additional information before approval

## API Reference

### Approve/Reject Transaction
```
POST /api/transactions/[id]/approve
```

**Headers**:
```
Content-Type: application/json
Authorization: (via session)
```

**Request**:
```json
{
  "action": "approve" | "reject",
  "reason": "string (optional for approve, required for reject)"
}
```

**Responses**:
- `200 OK`: Transaction successfully approved/rejected
- `400 Bad Request`: Transaction not in pending status
- `401 Unauthorized`: Not logged in
- `403 Forbidden`: Not an admin or outside oversight area
- `404 Not Found`: Transaction not found

**Success Response**:
```json
{
  "message": "Transaction approved successfully",
  "transaction": {
    "id": "...",
    "status": "APPROVED",
    "approvedBy": "user-id",
    "approvedAt": "2024-01-01T12:00:00Z"
  }
}
```

## Notes

- All financial calculations and reports only include APPROVED transactions by default
- Audit logs are created for all approval/rejection actions
- Rejection reasons are required to ensure accountability
- Permissions are hierarchical - higher level admins can approve transactions from lower levels
