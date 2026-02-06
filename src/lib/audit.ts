import { PrismaClient, ActionType, AuditSeverity } from '@prisma/client';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

interface AuditLogData {
  userId: string;
  actionType: ActionType;
  entityType: string;
  entityId: string;
  description: string;
  beforeData?: any;
  afterData?: any;
  metadata?: Record<string, any>;
  severity?: AuditSeverity;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Calculate detailed field-by-field changes between before and after data
 */
function calculateChanges(beforeData: any, afterData: any): Record<string, any> | null {
  if (!beforeData || !afterData) return null;

  const changes: Record<string, any> = {};
  const allKeys = new Set([
    ...Object.keys(beforeData),
    ...Object.keys(afterData),
  ]);

  for (const key of allKeys) {
    const before = beforeData[key];
    const after = afterData[key];

    // Skip if values are the same
    if (JSON.stringify(before) === JSON.stringify(after)) continue;

    changes[key] = {
      from: before,
      to: after,
      changed: true,
    };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Get client IP address from request headers
 */
function getIpAddress(headersList: Headers): string | null {
  return (
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    null
  );
}

/**
 * Get user agent from request headers
 */
function getUserAgent(headersList: Headers): string | null {
  return headersList.get('user-agent') || null;
}

/**
 * Generate human-readable description based on action type
 */
function generateDescription(
  actionType: ActionType,
  entityType: string,
  metadata?: Record<string, any>
): string {
  const entity = entityType.toLowerCase();

  switch (actionType) {
    case 'CREATE':
      return `Created new ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}`;
    case 'UPDATE':
      return `Updated ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}${
        metadata?.fields ? ` (${metadata.fields.join(', ')})` : ''
      }`;
    case 'DELETE':
      return `Deleted ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}`;
    case 'APPROVE':
      return `Approved ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}`;
    case 'REJECT':
      return `Declined ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}${
        metadata?.reason ? ` - Reason: ${metadata.reason}` : ''
      }`;
    case 'ARCHIVE':
      return `Archived ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}`;
    case 'RESTORE':
      return `Restored ${entity}${metadata?.name ? ` "${metadata.name}"` : ''}`;
    case 'LOGIN':
      return `User logged in${metadata?.role ? ` as ${metadata.role}` : ''}`;
    case 'LOGOUT':
      return `User logged out`;
    case 'ROLE_CHANGE':
      return `Changed role from ${metadata?.oldRole || 'N/A'} to ${metadata?.newRole || 'N/A'}`;
    case 'LOCK_OVERRIDE':
      return `Override lock on ${entity}${metadata?.reason ? ` - Reason: ${metadata.reason}` : ''}`;
    case 'FILE_UPLOAD':
      return `Uploaded ${metadata?.fileCount || 1} file(s) to ${entity}`;
    case 'TRANSFER':
      return `Transferred ${entity} from ${metadata?.from || 'N/A'} to ${metadata?.to || 'N/A'}`;
    case 'RECALCULATE':
      return `Recalculated ${entity}${metadata?.count ? ` (${metadata.count} items)` : ''}`;
    default:
      return `Performed ${actionType} on ${entity}`;
  }
}

/**
 * Determine audit severity based on action type and entity
 */
function determineSeverity(
  actionType: ActionType,
  entityType: string,
  metadata?: Record<string, any>
): AuditSeverity {
  // Critical actions
  if (
    actionType === 'DELETE' ||
    (actionType === 'UPDATE' && metadata?.critical === true) ||
    actionType === 'LOCK_OVERRIDE'
  ) {
    return 'CRITICAL';
  }

  // High severity actions
  if (
    actionType === 'APPROVE' ||
    actionType === 'REJECT' ||
    actionType === 'ROLE_CHANGE' ||
    actionType === 'TRANSFER' ||
    (entityType === 'User' && actionType === 'UPDATE')
  ) {
    return 'HIGH';
  }

  // Medium severity actions
  if (actionType === 'CREATE' || actionType === 'RECALCULATE') {
    return 'MEDIUM';
  }

  // Low severity (default)
  return 'LOW';
}

/**
 * Create a comprehensive audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = getIpAddress(headersList);
    const userAgent = getUserAgent(headersList);

    // Calculate detailed changes if both before and after data exist
    const changes = calculateChanges(data.beforeData, data.afterData);

    // Auto-generate description if not provided
    const description = data.description || generateDescription(
      data.actionType,
      data.entityType,
      data.metadata
    );

    // Auto-determine severity if not provided
    const severity = data.severity || determineSeverity(
      data.actionType,
      data.entityType,
      data.metadata
    );

    // Extract changed field names for metadata
    const changedFields = changes ? Object.keys(changes) : [];

    // Enhance metadata with additional context
    const enhancedMetadata = {
      ...data.metadata,
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    };

    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        actionType: data.actionType,
        entityType: data.entityType,
        entityId: data.entityId,
        description,
        beforeData: data.beforeData || null,
        afterData: data.afterData || null,
        changes: changes as any,
        metadata: enhancedMetadata,
        ipAddress,
        userAgent,
        severity,
        success: data.success ?? true,
        errorMessage: data.errorMessage || null,
      },
    });
  } catch (error) {
    // Log the error but don't throw - we don't want audit logging to break the main flow
  }
}

/**
 * Create audit log for failed operations
 */
export async function createFailedAuditLog(
  data: Omit<AuditLogData, 'success'> & { errorMessage: string }
): Promise<void> {
  await createAuditLog({
    ...data,
    success: false,
  });
}

/**
 * Batch create multiple audit logs (for bulk operations)
 */
export async function createBulkAuditLogs(
  items: AuditLogData[]
): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = getIpAddress(headersList);
    const userAgent = getUserAgent(headersList);

    const auditLogs = items.map((data) => {
      const changes = calculateChanges(data.beforeData, data.afterData);
      const description = data.description || generateDescription(
        data.actionType,
        data.entityType,
        data.metadata
      );
      const severity = data.severity || determineSeverity(
        data.actionType,
        data.entityType,
        data.metadata
      );

      return {
        userId: data.userId,
        actionType: data.actionType,
        entityType: data.entityType,
        entityId: data.entityId,
        description,
        beforeData: data.beforeData || null,
        afterData: data.afterData || null,
        changes: changes || null,
        metadata: data.metadata || null,
        ipAddress,
        userAgent,
        severity,
        success: data.success ?? true,
        errorMessage: data.errorMessage || null,
      };
    });

    await prisma.auditLog.createMany({
      data: auditLogs as any,
    });
  } catch (error) {
  }
}
