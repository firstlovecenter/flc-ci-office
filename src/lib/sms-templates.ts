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

// Helper to replace variables in template
function replaceVariables(template: string, params: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
}

export async function generatePasswordResetSms(params: PasswordResetSmsParams): Promise<string> {
    const { resetCode, expirationMinutes = 30 } = params;
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'password_reset' },
        });

        if (template) {
            return replaceVariables(template.template, {
                resetCode,
                expirationHours: expirationMinutes / 60,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    // Fallback to default template
    return `FLC CI Office: Your password reset code is ${resetCode}. Valid for ${expirationMinutes/60} hours. Go to the reset page and enter this code.`;
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
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'first_role_assignment' },
        });

        if (template) {
            return replaceVariables(template.template, {
                userName,
                role: roleDisplay,
                department,
                resetLink,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `Welcome ${userName}! You've been assigned as ${roleDisplay} for ${department}. Set your password here: ${resetLink}`;
}

interface RoleAssignmentSmsParams {
    userName: string;
    role: string;
    department: string;
}

export async function generateRoleAssignmentSms(params: RoleAssignmentSmsParams): Promise<string> {
    const { userName, role, department } = params;
    const roleDisplay = role.replace(/_/g, ' ');
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'role_assignment' },
        });

        if (template) {
            return replaceVariables(template.template, {
                userName,
                role: roleDisplay,
                department,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `FLC CI Office: Hello ${userName}, your role has been updated to ${roleDisplay} for ${department}.`;
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
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'transaction_notification' },
        });

        if (template) {
            return replaceVariables(template.template, {
                userName,
                type: action,
                amount,
                status,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `FLC CI: ${userName}, your ${action} transaction of ${amount} is now ${status}.`;
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
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'department_alert' },
        });

        if (template) {
            return replaceVariables(template.template, {
                departmentName,
                message: truncatedMessage,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `FLC CI - ${departmentName}: ${truncatedMessage}`;
}

interface WeekLockNotificationSmsParams {
    userName: string;
    weekNumber: number;
}

export async function generateWeekLockNotificationSms(params: WeekLockNotificationSmsParams): Promise<string> {
    const { userName, weekNumber } = params;
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'week_lock_notification' },
        });

        if (template) {
            return replaceVariables(template.template, {
                userName,
                weekNumber,
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `FLC CI: Hello ${userName}, Week ${weekNumber} has been locked. No further changes can be made to transactions for this week.`;
}

interface ApprovalReminderSmsParams {
    userName: string;
    pendingCount: number;
}

export async function generateApprovalReminderSms(params: ApprovalReminderSmsParams): Promise<string> {
    const { userName, pendingCount } = params;
    
    try {
        const template = await prisma.smsTemplate.findUnique({
            where: { key: 'approval_reminder' },
        });

        if (template) {
            return replaceVariables(template.template, {
                userName,
                pendingCount,
                dashboardLink: '',
            });
        }
    } catch (error) {
        console.error('Error fetching SMS template:', error);
    }
    
    return `FLC CI: Hello ${userName}, you have ${pendingCount} transaction${pendingCount > 1 ? 's' : ''} pending your approval.`;
}
