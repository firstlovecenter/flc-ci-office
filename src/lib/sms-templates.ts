/**
 * SMS notification templates for mNotify
 * Note: SMS has 160 character limit for single message, 153 per segment for multi-part
 */

interface PasswordResetSmsParams {
    resetCode: string;
    expirationMinutes?: number;
    resetUrl?: string;
}

export function generatePasswordResetSms(params: PasswordResetSmsParams): string {
    const { resetCode, expirationMinutes = 30 } = params;
    
    // Simple code-based message (no URL to avoid truncation issues)
    return `FLC CI Office: Your password reset code is ${resetCode}. Valid for ${expirationMinutes/60} hours. Go to the reset page and enter this code.`;
}

interface FirstRoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
    resetLink: string;
}

export function generateFirstRoleAssignmentSms(params: FirstRoleAssignmentSmsParams): string {
    const { userName, role, department, resetLink } = params;
    
    const roleDisplay = role.replace(/_/g, ' ');
    
    return `Welcome ${userName}! You've been assigned as ${roleDisplay} for ${department}. Set your password here: ${resetLink}`;
}

interface RoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
}

export function generateRoleAssignmentSms(params: RoleAssignmentSmsParams): string {
    const { userName, role, department } = params;
    
    const roleDisplay = role.replace(/_/g, ' ');
    
    return `FLC CI Office: Hello ${userName}, your role has been updated to ${roleDisplay} for ${department}.`;
}

interface TransactionNotificationSmsParams {
    userName: string;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
    status: string;
}

export function generateTransactionNotificationSms(params: TransactionNotificationSmsParams): string {
    const { userName, type, amount, status } = params;
    
    const action = type === 'INCOME' ? 'Income' : 'Expense';
    
    return `FLC CI: ${userName}, your ${action} transaction of ${amount} is now ${status}.`;
}

interface DepartmentAlertSmsParams {
    departmentName: string;
    message: string;
}

export function generateDepartmentAlertSms(params: DepartmentAlertSmsParams): string {
    const { departmentName, message } = params;
    
    // Truncate message if too long (leave room for prefix)
    const maxMessageLength = 130; // 160 - prefix length
    const truncatedMessage = message.length > maxMessageLength 
        ? message.substring(0, maxMessageLength) + '...' 
        : message;
    
    return `FLC CI - ${departmentName}: ${truncatedMessage}`;
}

interface WeekLockNotificationSmsParams {
    userName: string;
    weekNumber: number;
}

export function generateWeekLockNotificationSms(params: WeekLockNotificationSmsParams): string {
    const { userName, weekNumber } = params;
    
    return `FLC CI: Hello ${userName}, Week ${weekNumber} has been locked. No further changes can be made to transactions for this week.`;
}

interface ApprovalReminderSmsParams {
    userName: string;
    pendingCount: number;
}

export function generateApprovalReminderSms(params: ApprovalReminderSmsParams): string {
    const { userName, pendingCount } = params;
    
    return `FLC CI: Hello ${userName}, you have ${pendingCount} transaction${pendingCount > 1 ? 's' : ''} pending your approval.`;
}
