# Enhanced Audit Logging System

This document explains the comprehensive audit logging system implemented in the FLC Accounts application.

## Overview

The audit logging system has been significantly enhanced to provide detailed, searchable, and actionable audit trails for all system operations.

## New Features

### Schema Enhancements

**AuditLog Model** now includes:
- `description`: Human-readable description of what happened
- `changes`: Field-by-field changes (before/after for each field)
- `metadata`: Additional context (department, role, permissions, etc.)
- `userAgent`: Browser/client information  
- `severity`: LOW, MEDIUM, HIGH, CRITICAL categorization
- `success`: Boolean flag for operation success/failure
- `errorMessage`: Error details for failed operations
- **Indexes**: On userId, entityType+entityId, actionType, timestamp, severity for fast querying

**ActionType Enum** expanded with:
- `APPROVE` - Transaction/request approvals
- `REJECT` - Transaction/request rejections
- `ARCHIVE` - Archiving records
- `RESTORE` - Restoring archived records
- `TRANSFER` - Department/ownership transfers
- `RECALCULATE` - Currency recalculations
- `LOGOUT` - User logout events

**New AuditSeverity Enum**:
- `LOW` - Read operations, routine updates
- `MEDIUM` - Create operations, standard modifications
- `HIGH` - Approvals, rejections, role changes, transfers
- `CRITICAL` - Deletions, lock overrides, security-sensitive operations

## Usage

### Basic Usage

```typescript
import { createAuditLog } from '@/lib/audit';

await createAuditLog({
  userId: session.user.id,
  actionType: 'UPDATE',
  entityType: 'Transaction',
  entityId: transaction.id,
  description: 'Updated transaction amount',
  beforeData: oldTransaction,
  afterData: updatedTransaction,
  metadata: {
    amount: updatedTransaction.amount,
    departmentName: department.name,
    fields: ['amount', 'description'],
  },
});
```

### Auto-Generated Descriptions

If you don't provide a `description`, the system automatically generates one:

```typescript
await createAuditLog({
  userId: session.user.id,
  actionType: 'APPROVE',
  entityType: 'Transaction',
  entityId: id,
  beforeData: transaction,
  afterData: updatedTransaction,
  metadata: {
    name: `Transaction #${transaction.id}`,
    amount: transaction.amount,
  },
  // Description auto-generated: "Approved transaction Transaction #xxx"
});
```

### Approval/Rejection Logging

```typescript
await createAuditLog({
  userId: session.user.id,
  actionType: action === 'approve' ? 'APPROVE' : 'REJECT',
  entityType: 'Transaction',
  entityId: id,
  description: action === 'approve' 
    ? `Approved transaction of ${formatCurrency(amount)} for ${departmentName}`
    : `Rejected transaction of ${formatCurrency(amount)} for ${departmentName}`,
  beforeData: transaction,
  afterData: updatedTransaction,
  metadata: {
    action,
    amount: transaction.amount,
    departmentId: transaction.departmentId,
    departmentName,
    transactionType: transaction.type,
    reason: action === 'reject' ? reason : undefined,
    approverRole: session.user.role,
  },
  severity: action === 'reject' ? 'HIGH' : 'MEDIUM',
});
```

### Failed Operation Logging

```typescript
import { createFailedAuditLog } from '@/lib/audit';

try {
  // ... operation
} catch (error) {
  await createFailedAuditLog({
    userId: session.user.id,
    actionType: 'DELETE',
    entityType: 'User',
    entityId: userId,
    description: `Failed to delete user ${user.name}`,
    errorMessage: error.message,
    metadata: {
      userName: user.name,
      userEmail: user.email,
    },
    severity: 'CRITICAL',
  });
  throw error;
}
```

### Bulk Operations

```typescript
import { createBulkAuditLogs } from '@/lib/audit';

const auditLogs = transactions.map(transaction => ({
  userId: session.user.id,
  actionType: 'RECALCULATE' as const,
  entityType: 'Transaction',
  entityId: transaction.id,
  description: `Recalculated transaction amount for ${transaction.description}`,
  beforeData: { amount: transaction.amount },
  afterData: { amount: newAmount },
  metadata: {
    oldAmount: transaction.amount,
    newAmount,
    currencyCode: transaction.currency.code,
  },
}));

await createBulkAuditLogs(auditLogs);
```

## Automatic Features

### 1. IP Address Capture
Automatically captures client IP from request headers (x-forwarded-for, x-real-ip)

### 2. User Agent Capture
Automatically captures browser/client information

### 3. Change Detection
Automatically calculates field-by-field changes:
```json
{
  "changes": {
    "status": {
      "from": "PENDING",
      "to": "APPROVED",
      "changed": true
    },
    "approvedAt": {
      "from": null,
      "to": "2025-11-22T10:30:00Z",
      "changed": true
    }
  }
}
```

### 4. Severity Auto-Detection
If not specified, severity is automatically determined:
- DELETE → CRITICAL
- LOCK_OVERRIDE → CRITICAL
- APPROVE, REJECT, ROLE_CHANGE, TRANSFER → HIGH
- CREATE, RECALCULATE → MEDIUM
- UPDATE, LOGIN, FILE_UPLOAD → LOW

### 5. Metadata Enhancement
Automatically adds:
- `changedFields`: Array of field names that changed
- `timestamp`: ISO timestamp of the action
- `environment`: NODE_ENV value

## Metadata Examples

### Transaction Approval
```json
{
  "action": "approve",
  "amount": 50000,
  "departmentId": "cmi7cdnug0006pg9mscuupb14",
  "departmentName": "FL GHANA",
  "transactionType": "INCOME",
  "approverRole": "NATIONAL_ADMIN",
  "changedFields": ["status", "approvedBy", "approvedAt"],
  "timestamp": "2025-11-22T10:30:00.000Z",
  "environment": "production"
}
```

### User Role Change
```json
{
  "oldRole": "COUNCIL_LEADER",
  "newRole": "CAMPUS_ADMIN",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "departmentName": "Accra Campus",
  "changedBy": "skaduteye@gmail.com",
  "changedFields": ["roles", "activeRole"],
  "timestamp": "2025-11-22T10:30:00.000Z",
  "environment": "production"
}
```

### Currency Recalculation
```json
{
  "count": 15,
  "currencyCode": "GHS",
  "exchangeRate": 10.5,
  "affectedTransactions": ["id1", "id2", "id3"],
  "totalAmountRecalculated": 150000,
  "changedFields": ["amountInBase", "exchangeRate"],
  "timestamp": "2025-11-22T10:30:00.000Z",
  "environment": "production"
}
```

## Querying Audit Logs

The enhanced schema includes performance indexes for fast querying:

```typescript
// By user
const userAudits = await prisma.auditLog.findMany({
  where: { userId },
  orderBy: { timestamp: 'desc' },
});

// By entity
const entityAudits = await prisma.auditLog.findMany({
  where: {
    entityType: 'Transaction',
    entityId: transactionId,
  },
  orderBy: { timestamp: 'asc' },
});

// By severity
const criticalEvents = await prisma.auditLog.findMany({
  where: { severity: 'CRITICAL' },
  orderBy: { timestamp: 'desc' },
});

// By action type
const approvals = await prisma.auditLog.findMany({
  where: { actionType: 'APPROVE' },
  include: { user: true },
});

// By time range and success
const recentFailures = await prisma.auditLog.findMany({
  where: {
    success: false,
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    },
  },
  orderBy: { timestamp: 'desc' },
});
```

## Best Practices

1. **Always log sensitive operations**: DELETE, role changes, approvals, etc.
2. **Include meaningful metadata**: Department names, amounts, reasons, etc.
3. **Use appropriate severity levels**: Don't mark everything as CRITICAL
4. **Provide descriptive descriptions**: Help future admins understand what happened
5. **Log failures**: Use `createFailedAuditLog` for operations that fail
6. **Include before/after data**: Helps with debugging and rollback
7. **Add context in metadata**: Role, department, IP address enhance security

## Migration from Old System

Old code:
```typescript
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    actionType: 'UPDATE',
    entityType: 'User',
    entityId: userId,
    afterData: { name, email },
  },
});
```

New code:
```typescript
await createAuditLog({
  userId: session.user.id,
  actionType: 'UPDATE',
  entityType: 'User',
  entityId: userId,
  description: `Updated user ${name} (${email})`,
  beforeData: oldUser,
  afterData: updatedUser,
  metadata: {
    userName: name,
    userEmail: email,
    fields: ['name', 'email'],
    updatedBy: session.user.email,
  },
});
```

## Error Handling

The audit logging system is designed to never break your application:

```typescript
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    // ... create audit log
  } catch (error) {
    // Log the error but don't throw - we don't want audit logging to break the main flow
    console.error('Failed to create audit log:', error);
  }
}
```

This ensures that even if audit logging fails, your main operations continue to work.

## Security Benefits

1. **Full audit trail**: Every action is logged with context
2. **IP tracking**: Know where actions originated from
3. **User agent tracking**: Identify suspicious client patterns
4. **Change tracking**: See exactly what changed
5. **Severity classification**: Quickly identify critical events
6. **Failure logging**: Track and investigate failed operations
7. **Performance indexes**: Fast querying for security analysis
