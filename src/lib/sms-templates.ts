/**
 * SMS notification templates for mNotify
 * Note: SMS has 160 character limit for single message, 153 per segment for multi-part
 */

import { prisma } from '@/lib/prisma';

interface PasswordResetSmsParams {
    resetCode: string;
    expirationMinutes?: number;
    resetUrl?: string;
}

// Helper to replace variables in template (supports both {{var}} and {var} formats)
function replaceVariables(template: string, params: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
        // Replace double braces {{variable}} format
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
        // Replace single braces {variable} format
        result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    return result;
}

export async function generatePasswordResetSms(params: PasswordResetSmsParams): Promise<string> {
    const { resetCode, expirationMinutes = 30 } = params;
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'password_reset' },
    });

    if (!template) {
        throw new Error('Password reset SMS template not found in database');
    }

    return replaceVariables(template.template, {
        resetCode,
        expirationHours: expirationMinutes / 60,
    });
}

interface FirstRoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
    resetLink: string;
}

export async function generateFirstRoleAssignmentSms(params: FirstRoleAssignmentSmsParams): Promise<string> {
    const { userName, role, department, resetLink } = params;
    const roleDisplay = role.replace(/_/g, ' ');
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'first_role_assignment' },
    });

    if (!template) {
        throw new Error('First role assignment SMS template not found in database');
    }

    return replaceVariables(template.template, {
        userName,
        role: roleDisplay,
        department,
        resetLink,
    });
}

interface RoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
}

export async function generateRoleAssignmentSms(params: RoleAssignmentSmsParams): Promise<string> {
    const { userName, role, department } = params;
    const roleDisplay = role.replace(/_/g, ' ');
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'role_assignment' },
    });

    if (!template) {
        throw new Error('Role assignment SMS template not found in database');
    }

    return replaceVariables(template.template, {
        userName,
        role: roleDisplay,
        department,
    });
}

interface TransactionNotificationSmsParams {
    userName: string;
    type: 'INCOME' | 'EXPENSE';
    amount: string;
    status: string;
}

export async function generateTransactionNotificationSms(params: TransactionNotificationSmsParams): Promise<string> {
    const { userName, type, amount, status } = params;
    const action = type === 'INCOME' ? 'Income' : 'Expense';
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'transaction_notification' },
    });

    if (!template) {
        throw new Error('Transaction notification SMS template not found in database');
    }

    return replaceVariables(template.template, {
        userName,
        type: action,
        amount,
        status,
    });
}

interface DepartmentAlertSmsParams {
    departmentName: string;
    message: string;
}

export async function generateDepartmentAlertSms(params: DepartmentAlertSmsParams): Promise<string> {
    const { departmentName, message } = params;
    const maxMessageLength = 130;
    const truncatedMessage = message.length > maxMessageLength 
        ? message.substring(0, maxMessageLength) + '...' 
        : message;
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'department_alert' },
    });

    if (!template) {
        throw new Error('Department alert SMS template not found in database');
    }

    return replaceVariables(template.template, {
        departmentName,
        message: truncatedMessage,
    });
}

interface WeekLockNotificationSmsParams {
    userName: string;
    weekNumber: number;
}

export async function generateWeekLockNotificationSms(params: WeekLockNotificationSmsParams): Promise<string> {
    const { userName, weekNumber } = params;
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'week_lock_notification' },
    });

    if (!template) {
        throw new Error('Week lock notification SMS template not found in database');
    }

    return replaceVariables(template.template, {
        userName,
        weekNumber,
    });
}

interface ApprovalReminderSmsParams {
    userName: string;
    pendingCount: number;
}

export async function generateApprovalReminderSms(params: ApprovalReminderSmsParams): Promise<string> {
    const { userName, pendingCount } = params;
    
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'approval_reminder' },
    });

    if (!template) {
        throw new Error('Approval reminder SMS template not found in database');
    }

    return replaceVariables(template.template, {
        userName,
        pendingCount,
        dashboardLink: '',
    });
}

interface TransactionApprovedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    chargeText: string;
    departmentName: string;
    balance: string;
}

export async function generateTransactionApprovedSms(params: TransactionApprovedSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'TRANSACTION_APPROVED' },
    });

    if (!template) {
        throw new Error('Transaction approved SMS template not found in database');
    }

    return replaceVariables(template.template, params);
}

interface TransactionDeclinedSmsParams {
    transactionType: string;
    currency: string;
    amount: string;
    reasonText: string;
}

export async function generateTransactionDeclinedSms(params: TransactionDeclinedSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'TRANSACTION_DECLINED' },
    });

    if (!template) {
        throw new Error('Transaction declined SMS template not found in database');
    }

    return replaceVariables(template.template, params);
}

interface TransactionChargeSmsParams {
    currency: string;
    chargeAmount: string;
    departmentName: string;
    transactionRef: string;
    description: string;
}

export async function generateTransactionChargeSms(params: TransactionChargeSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'TRANSACTION_CHARGE' },
    });

    if (!template) {
        throw new Error('Transaction charge SMS template not found in database');
    }

    return replaceVariables(template.template, params);
}

interface PendingApprovalRequestSmsParams {
    userName: string;
    transactionType: string;
    currency: string;
    amount: string;
    description: string;
}

export async function generatePendingApprovalRequestSms(params: PendingApprovalRequestSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'PENDING_APPROVAL_REQUEST' },
    });

    if (!template) {
        throw new Error('Pending approval request SMS template not found in database');
    }

    return replaceVariables(template.template, params);
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
}

export async function generateCorrectionNotificationSms(params: CorrectionNotificationSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'CORRECTION_NOTIFICATION' },
    });

    if (!template) {
        throw new Error('Correction notification SMS template not found in database');
    }

    return replaceVariables(template.template, params);
}

interface CreditAlertSmsParams {
    currency: string;
    amount: string;
    departmentName: string;
    description: string;
    balance: string;
}

export async function generateCreditAlertSms(params: CreditAlertSmsParams): Promise<string> {
    const template = await prisma.smsTemplate.findUnique({
        where: { key: 'CREDIT_ALERT' },
    });

    if (!template) {
        throw new Error('Credit alert SMS template not found in database');
    }

    return replaceVariables(template.template, params);
}
