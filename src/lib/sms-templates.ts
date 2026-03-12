/**
 * SMS notification templates for CodeslawBMS
 * Note: SMS has 160 character limit for single message, 153 per segment for multi-part
 * 
 * These templates are hardcoded for system notifications.
 * Database templates (SmsTemplate model) are for manual superadmin-initiated SMS only.
 */

interface PasswordResetSmsParams {
    resetCode: string;
    expirationMinutes?: number;
    resetUrl?: string;
}

export function generatePasswordResetSms(params: PasswordResetSmsParams): string {
    const { resetCode, expirationMinutes = 30 } = params;
    const validityText = expirationMinutes < 60
        ? `${expirationMinutes} minute${expirationMinutes !== 1 ? 's' : ''}`
        : `${Math.round(expirationMinutes / 60)} hour${Math.round(expirationMinutes / 60) !== 1 ? 's' : ''}`;
    return `Your password reset code is ${resetCode}. Valid for ${validityText}. If you did not request this, please ignore.`;
}

interface FirstRoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
    resetLink: string;
}

export function generateFirstRoleAssignmentSms(params: FirstRoleAssignmentSmsParams): string {
    const { userName, resetLink } = params;
    return `Welcome ${userName}! to CI-OFFICE. Set your password here: ${resetLink}`;
}

interface RoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
}

export function generateRoleAssignmentSms(params: RoleAssignmentSmsParams): string {
    const { userName, role, department } = params;
    const roleDisplay = role.replace(/_/g, ' ');
    return `Hello ${userName}, your role has been updated to ${roleDisplay} for ${department}.`;
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
    return `${userName}, your ${action} transaction of ${amount} is now ${status}.`;
}

interface DepartmentAlertSmsParams {
    departmentName: string;
    message: string;
}

export function generateDepartmentAlertSms(params: DepartmentAlertSmsParams): string {
    const { departmentName, message } = params;
    const maxMessageLength = 130;
    const truncatedMessage = message.length > maxMessageLength 
        ? message.substring(0, maxMessageLength) + '...' 
        : message;
    return `${departmentName}: ${truncatedMessage}`;
}

interface WeekLockNotificationSmsParams {
    userName: string;
    weekNumber: number;
}

export function generateWeekLockNotificationSms(params: WeekLockNotificationSmsParams): string {
    const { userName, weekNumber } = params;
    return `Hello ${userName}, Week ${weekNumber} has been locked.`;
}

interface ApprovalReminderSmsParams {
    userName: string;
    pendingCount: number;
}

export function generateApprovalReminderSms(params: ApprovalReminderSmsParams): string {
    const { userName, pendingCount } = params;
    return `Hello ${userName}, you have ${pendingCount} transaction(s) pending approval. Please review.`;
}

interface TransactionApprovedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    chargeText: string;
    departmentName: string;
    balance: string;
}

export function generateTransactionApprovedSms(params: TransactionApprovedSmsParams): string {
    const { transactionType, currency, amount, chargeText, departmentName, balance } = params;
    return `Your ${transactionType} request of ${currency}${amount} has been approved.${chargeText}. Your new  balance is ${currency}${balance}.`;
}

interface TransactionDeclinedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    reasonText: string;
}

export function generateTransactionDeclinedSms(params: TransactionDeclinedSmsParams): string {
    const { transactionType, currency, amount, reasonText } = params;
    return `Your ${transactionType} request of ${currency}${amount} has been declined.${reasonText} Contact the office for details`;
}

interface TransactionChargeSmsParams {
    currency: string;
    chargeAmount: string;
    departmentName: string;
    transactionRef: string;
    description: string;
}

export function generateTransactionChargeSms(params: TransactionChargeSmsParams): string {
    const { currency, chargeAmount, departmentName, transactionRef, description } = params;
    return `Transaction charge of ${currency}${chargeAmount} has been applied to ${departmentName}. Ref: ${transactionRef}. Original: ${description}.`;
}

interface PendingApprovalRequestSmsParams {
    userName: string;
    transactionType: string;
    currency: string;
    amount: string;
    description: string;
}

export function generatePendingApprovalRequestSms(params: PendingApprovalRequestSmsParams): string {
    const { userName, transactionType, currency, amount, description } = params;
    return `${userName} submitted a ${transactionType} request of ${currency}${amount}. Ref: ${description}. Please review.`;
}

interface CorrectionNotificationSmsParams {
    transactionType: string;
    departmentName: string;
    currency: string;
    originalAmount: string;
    newAmount: string;
    correctionType: string;
    adjustmentAmount: string;
    reason: string;
    balance: string;
}

export function generateCorrectionNotificationSms(params: CorrectionNotificationSmsParams): string {
    const { transactionType, departmentName, currency, originalAmount, newAmount, correctionType, adjustmentAmount, reason, balance } = params;
    // Truncate reason to keep message within 2 SMS segments
    const shortReason = reason.length > 20 ? reason.substring(0, 20) + '...' : reason;
    return `CORRECTION: ${departmentName} ${transactionType} ${currency}${originalAmount} to ${currency}${newAmount}. ${correctionType}: ${currency}${adjustmentAmount}. ${shortReason}. Bal: ${currency}${balance}.`;
}

interface DepartmentTransferSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    fromDepartment: string;
    toDepartment: string;
    reason: string;
    balance: string;
}

export function generateDepartmentTransferSms(params: DepartmentTransferSmsParams): string {
    const { transactionType, currency, amount, fromDepartment, toDepartment, reason, balance } = params;
    const shortReason = reason.length > 20 ? reason.substring(0, 20) + '...' : reason;
    return `TRANSFER: ${transactionType} ${currency}${amount} moved from ${fromDepartment} to ${toDepartment}. ${shortReason}. Bal: ${currency}${balance}.`;
}

interface CreditAlertSmsParams {
    currency: string;
    amount: string;
    departmentName: string;
    description: string;
    balance: string;
}

export function generateCreditAlertSms(params: CreditAlertSmsParams): string {
    const { currency, amount, departmentName, description, balance } = params;
    return `${currency}${amount} credited to your ${departmentName} account. Ref: ${description}. Your new balance is ${currency}${balance}.`;
}

interface DebitAlertSmsParams {
    currency: string;
    amount: string;
    departmentName: string;
    description: string;
    balance: string;
}

export function generateDebitAlertSms(params: DebitAlertSmsParams): string {
    const { currency, amount, departmentName, description, balance } = params;
    return `${currency}${amount} debited from your ${departmentName} account. Ref: ${description}. Your new balance is ${currency}${balance}.`;
}

interface TransactionEditNotificationSmsParams {
    departmentName: string;
    description: string;
    changes: string;
    editedBy: string;
}

export function generateTransactionEditNotificationSms(params: TransactionEditNotificationSmsParams): string {
    const { departmentName, description, changes, editedBy } = params;
    const shortDesc = description.length > 25 ? description.substring(0, 25) + '...' : description;
    return `EDIT ALERT: "${shortDesc}" in ${departmentName} was modified by ${editedBy}. Changes: ${changes}.`;
}
