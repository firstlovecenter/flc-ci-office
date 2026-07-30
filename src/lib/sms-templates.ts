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
    organisation: string;
    resetLink: string;
}

export function generateFirstRoleAssignmentSms(params: FirstRoleAssignmentSmsParams): string {
    const { userName, resetLink } = params;
    return `Welcome ${userName}! to CI-OFFICE. Set your password here: ${resetLink}`;
}

interface RoleAssignmentSmsParams {
    userName: string;
    role: string;
    organisation: string;
}

export function generateRoleAssignmentSms(params: RoleAssignmentSmsParams): string {
    const { userName, role, organisation } = params;
    const roleDisplay = role.replace(/_/g, ' ');
    return `Hello ${userName}, your role has been updated to ${roleDisplay} for ${organisation}.`;
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

interface OrganisationAlertSmsParams {
    organisationName: string;
    message: string;
}

export function generateOrganisationAlertSms(params: OrganisationAlertSmsParams): string {
    const { organisationName, message } = params;
    const maxMessageLength = 130;
    const truncatedMessage = message.length > maxMessageLength 
        ? message.substring(0, maxMessageLength) + '...' 
        : message;
    return `${organisationName}: ${truncatedMessage}`;
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
    organisationName: string;
    balance: string;
    description: string;
}

export function generateTransactionApprovedSms(params: TransactionApprovedSmsParams): string {
    const { transactionType, currency, amount, chargeText, balance, description } = params;
    return `Your ${transactionType} request of ${currency}${amount} has been approved.${chargeText} Ref: ${description}. Your new balance is ${currency}${balance}.`;
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

interface ApproverApprovedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    submitterName: string;
    organisationName: string;
    balance: string;
    chargeText: string;
}

export function generateApproverApprovedSms(params: ApproverApprovedSmsParams): string {
    const { transactionType, currency, amount, submitterName, organisationName, balance, chargeText } = params;
    return `You approved a ${transactionType} request of ${currency}${amount} from ${submitterName} (${organisationName}).${chargeText} New balance: ${currency}${balance}.`;
}

interface ApproverDeclinedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    submitterName: string;
    organisationName: string;
    reasonText: string;
}

export function generateApproverDeclinedSms(params: ApproverDeclinedSmsParams): string {
    const { transactionType, currency, amount, submitterName, organisationName, reasonText } = params;
    return `You declined a ${transactionType} request of ${currency}${amount} from ${submitterName} (${organisationName}).${reasonText}`;
}

interface TransactionChargeSmsParams {
    currency: string;
    chargeAmount: string;
    organisationName: string;
    transactionRef: string;
    description: string;
}

export function generateTransactionChargeSms(params: TransactionChargeSmsParams): string {
    const { currency, chargeAmount, organisationName, transactionRef, description } = params;
    return `Transaction charge of ${currency}${chargeAmount} has been applied to ${organisationName}. Ref: ${transactionRef}. Original: ${description}.`;
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
    organisationName: string;
    currency: string;
    originalAmount: string;
    newAmount: string;
    correctionType: string;
    adjustmentAmount: string;
    reason: string;
    balance: string;
}

export function generateCorrectionNotificationSms(params: CorrectionNotificationSmsParams): string {
    const { transactionType, organisationName, currency, originalAmount, newAmount, correctionType, adjustmentAmount, reason, balance } = params;
    // Truncate reason to keep message within 2 SMS segments
    const shortReason = reason.length > 20 ? reason.substring(0, 20) + '...' : reason;
    return `CORRECTION: ${organisationName} ${transactionType} ${currency}${originalAmount} to ${currency}${newAmount}. ${correctionType}: ${currency}${adjustmentAmount}. ${shortReason}. Bal: ${currency}${balance}.`;
}

interface OrganisationTransferSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    fromOrganisation: string;
    toOrganisation: string;
    reason: string;
    balance: string;
}

export function generateOrganisationTransferSms(params: OrganisationTransferSmsParams): string {
    const { transactionType, currency, amount, fromOrganisation, toOrganisation, reason, balance } = params;
    const shortReason = reason.length > 20 ? reason.substring(0, 20) + '...' : reason;
    return `TRANSFER: ${transactionType} ${currency}${amount} moved from ${fromOrganisation} to ${toOrganisation}. ${shortReason}. Bal: ${currency}${balance}.`;
}

interface CreditAlertSmsParams {
    currency: string;
    amount: string;
    organisationName: string;
    description: string;
    balance: string;
}

export function generateCreditAlertSms(params: CreditAlertSmsParams): string {
    const { currency, amount, organisationName, description, balance } = params;
    return `${currency}${amount} credited to your ${organisationName} account. Ref: ${description}. Your new balance is ${currency}${balance}.`;
}

interface DebitAlertSmsParams {
    currency: string;
    amount: string;
    organisationName: string;
    description: string;
    balance: string;
}

export function generateDebitAlertSms(params: DebitAlertSmsParams): string {
    const { currency, amount, organisationName, description, balance } = params;
    return `${currency}${amount} debited from your ${organisationName} account. Ref: ${description}. Your new balance is ${currency}${balance}.`;
}

interface AdminTransactionAlertSmsParams {
    transactionType: 'INCOME' | 'EXPENSE';
    currency: string;
    amount: string;
    organisationName: string;
    description: string;
    balance: string;
}

// Confirmation sent to the admin who recorded a credit/debit (the actor),
// distinct from the credit/debit alert that goes to the account owner (leader).
export function generateAdminTransactionAlertSms(params: AdminTransactionAlertSmsParams): string {
    const { transactionType, currency, amount, organisationName, description, balance } = params;
    const verb = transactionType === 'INCOME' ? 'credited' : 'debited';
    const preposition = transactionType === 'INCOME' ? 'to' : 'from';
    return `You ${verb} ${currency}${amount} ${preposition} the ${organisationName} account. Ref: ${description}. New balance is ${currency}${balance}.`;
}

interface PublicExpenseRequestSmsParams {
    requesterName: string;
    churchName: string;
    amount: number | string;
    momoName: string;
    momoNumber: string;
    description: string;
    campusOrganisationName: string;
    /** @deprecated use campusOrganisationName */
    oversightOrganisationName?: string;
}

export function generatePublicExpenseRequestSms(params: PublicExpenseRequestSmsParams): string {
    const { requesterName, churchName, amount, momoNumber, description } = params;
    const campusName = params.campusOrganisationName || params.oversightOrganisationName || 'your campus';
    const shortDesc = description.length > 30 ? description.substring(0, 30) + '...' : description;
    return `New public expense request for ${campusName}. From: ${requesterName} (${churchName}), GHS${amount}. Momo: ${momoNumber}. Reason: ${shortDesc}. Please log in to review.`;
}

interface TransactionEditNotificationSmsParams {
    organisationName: string;
    description: string;
    changes: string;
    editedBy: string;
}

export function generateTransactionEditNotificationSms(params: TransactionEditNotificationSmsParams): string {
    const { organisationName, description, changes, editedBy } = params;
    const shortDesc = description.length > 25 ? description.substring(0, 25) + '...' : description;
    return `EDIT ALERT: "${shortDesc}" in ${organisationName} was modified by ${editedBy}. Changes: ${changes}.`;
}

interface PublicExpenseLeaderSubmittedSmsParams {
    requesterName: string;
    amount: number | string;
    churchName: string;
}

export function generatePublicExpenseLeaderSubmittedSms(params: PublicExpenseLeaderSubmittedSmsParams): string {
    const { requesterName, amount, churchName } = params;
    return `CI Office: Your expense request of GHS${amount} for ${churchName} has been submitted and is pending review. Ref: ${requesterName}.`;
}

interface PublicExpenseLeaderApprovedSmsParams {
    requesterName: string;
    amount: number | string;
    churchName: string;
}

export function generatePublicExpenseLeaderApprovedSms(params: PublicExpenseLeaderApprovedSmsParams): string {
    const { requesterName, amount, churchName } = params;
    return `CI Office: Your expense request of GHS${amount} for ${churchName} has been approved. The amount will be sent to the provided Momo number. Ref: ${requesterName}.`;
}

interface PublicExpenseLeaderDeclinedSmsParams {
    requesterName: string;
    amount: number | string;
    churchName: string;
}

export function generatePublicExpenseLeaderDeclinedSms(params: PublicExpenseLeaderDeclinedSmsParams): string {
    const { requesterName, amount, churchName } = params;
    return `CI Office: Your expense request of GHS${amount} for ${churchName} has been declined. Please contact your oversight leader for details. Ref: ${requesterName}.`;
}
