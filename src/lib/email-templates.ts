/**
 * Email notification templates for CI-OFFICE.
 * Each function returns { subject, html } ready to pass to sendEmail().
 */

import { emailLayout } from './email';

// ─── Private helpers ──────────────────────────────────────────────────────────

type PillColor = 'green' | 'red' | 'blue' | 'amber' | 'slate';
type CardColor = 'credit' | 'debit' | 'neutral' | 'amber';
type BoxColor  = 'blue' | 'green' | 'red' | 'amber';
type BtnStyle  = 'primary' | 'success' | 'amber';

function pill(text: string, color: PillColor): string {
  return `<span class="pill pill-${color}">${text}</span>`;
}

function amountCard(
  currency: string,
  amount: string,
  color: CardColor,
  label: string,
  sign?: '+' | '-',
  sub?: string,
): string {
  const signHtml = sign ? `<span class="ac-sign">${sign}&thinsp;</span>` : '';
  const subHtml  = sub  ? `<p class="ac-sub">${sub}</p>` : '';
  return `
    <div class="ac ac-${color}">
      <p class="ac-lbl ac-lbl-${color}">${label}</p>
      <p class="ac-val ac-val-${color}">${signHtml}${currency}${amount}</p>
      ${subHtml}
    </div>`;
}

function dataTable(rows: [string, string][]): string {
  const html = rows
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join('');
  return `<div class="dt-wrap"><table class="dt" role="presentation">${html}</table></div>`;
}

function infoBox(content: string, color: BoxColor): string {
  return `<div class="ib ib-${color}"><p>${content}</p></div>`;
}

function ctaButton(text: string, url: string, style: BtnStyle = 'primary'): string {
  return `<div class="btn-wrap"><a href="${url}" class="btn btn-${style}">${text}</a></div>`;
}

function otpBlock(code: string): string {
  return `
    <div class="otp-wrap">
      <p class="otp-lbl">Your Reset Code</p>
      <p class="otp-code">${code}</p>
      <p class="otp-sub">Enter this code to reset your password</p>
    </div>`;
}

function heading(eyebrow: string, title: string, subtitle?: string): string {
  const sub = subtitle
    ? `<p class="sub">${subtitle}</p>`
    : `<div style="height:20px;"></div>`;
  return `
    <p class="eyebrow">${eyebrow}</p>
    <h1 class="h1">${title}</h1>
    ${sub}`;
}

function balanceCallout(currency: string, balance: string, label = 'Updated Balance'): string {
  return `
    <div class="bal-row">
      <p class="bal-lbl">${label}</p>
      <p class="bal-val">${currency}${balance}</p>
    </div>`;
}

function transferVisual(from: string, to: string): string {
  return `
    <div class="dt-wrap" style="margin:24px 0;">
      <table class="tf-table" role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td class="tf-dept">
            <span class="tf-lbl">From</span>
            <span class="tf-name">${from}</span>
          </td>
          <td class="tf-mid">&#8594;</td>
          <td class="tf-dept">
            <span class="tf-lbl">To</span>
            <span class="tf-name">${to}</span>
          </td>
        </tr>
      </table>
    </div>`;
}

function divider(): string {
  return `<div class="div"></div>`;
}

// ─── 1. Password Reset ────────────────────────────────────────────────────────

interface PasswordResetEmailParams {
  userName?: string;
  resetCode: string;
  resetUrl?: string;
  expirationHours?: number;
}

export function generatePasswordResetEmail(
  params: PasswordResetEmailParams,
): { subject: string; html: string } {
  const { userName, resetCode, resetUrl, expirationHours = 24 } = params;
  const name = userName || 'there';

  const content = `
    ${heading(
      'Security',
      'Password Reset Requested',
      `Hi ${name}, we received a request to reset your CI&#8209;OFFICE password.`,
    )}
    ${otpBlock(resetCode)}
    ${resetUrl ? ctaButton('Reset My Password', resetUrl) : ''}
    ${divider()}
    <p class="helper">
      This code expires in <strong>${expirationHours} hour${expirationHours !== 1 ? 's' : ''}</strong>.
      If you didn&rsquo;t request a password reset, no action is needed &mdash; your account remains secure.
    </p>`;

  return {
    subject: 'Your CI-OFFICE password reset code',
    html: emailLayout(content, {
      preheader: `Your password reset code is ${resetCode}. It expires in ${expirationHours} hours.`,
    }),
  };
}

// ─── 2. First Role Assignment (Welcome) ──────────────────────────────────────

interface FirstRoleAssignmentEmailParams {
  userName: string;
  role: string;
  department: string;
  resetLink: string;
}

export function generateFirstRoleAssignmentEmail(
  params: FirstRoleAssignmentEmailParams,
): { subject: string; html: string } {
  const { userName, role, department, resetLink } = params;
  const roleDisplay = role.replace(/_/g, ' ');

  const content = `
    ${heading(
      'Welcome',
      `Hi ${userName}, you&rsquo;re in!`,
      'You&rsquo;ve been given access to CI&#8209;OFFICE. Set up your password to get started.',
    )}
    ${dataTable([
      ['Full name',   userName],
      ['Role',        `${pill(roleDisplay, 'blue')}`],
      ['Department',  department],
    ])}
    ${infoBox('This is your first time signing in. Please set a strong password to secure your account.', 'blue')}
    ${ctaButton('Set Up My Password', resetLink, 'success')}
    ${divider()}
    <p class="helper">
      This link expires in <strong>7 days</strong>. If you didn&rsquo;t expect this invitation, please
      contact your department administrator immediately.
    </p>`;

  return {
    subject: `Welcome to CI-OFFICE — set up your password`,
    html: emailLayout(content, {
      preheader: `Hi ${userName}, you've been added to CI-OFFICE as ${roleDisplay}. Set your password to get started.`,
    }),
  };
}

// ─── 3. Role Assignment (existing user) ──────────────────────────────────────

interface RoleAssignmentEmailParams {
  userName: string;
  role: string;
  department: string;
}

export function generateRoleAssignmentEmail(
  params: RoleAssignmentEmailParams,
): { subject: string; html: string } {
  const { userName, role, department } = params;
  const roleDisplay = role.replace(/_/g, ' ');

  const content = `
    ${heading(
      'Role Update',
      'Your role has been updated',
      `Hi ${userName}, your CI&#8209;OFFICE role has changed.`,
    )}
    ${dataTable([
      ['New role',    `${pill(roleDisplay, 'blue')}`],
      ['Department',  department],
    ])}
    ${infoBox('Log in to CI&#8209;OFFICE to explore your updated access and permissions.', 'blue')}`;

  return {
    subject: `CI-OFFICE — your role has been updated`,
    html: emailLayout(content, {
      preheader: `Your role has been updated to ${roleDisplay} in the ${department} department.`,
    }),
  };
}

// ─── 4. Transaction Approved ──────────────────────────────────────────────────

interface TransactionApprovedEmailParams {
  userName: string;
  transactionType: string;
  currency: string;
  amount: string;
  chargeAmount?: string;
  departmentName: string;
  balance: string;
  description?: string;
}

export function generateTransactionApprovedEmail(
  params: TransactionApprovedEmailParams,
): { subject: string; html: string } {
  const { userName, transactionType, currency, amount, chargeAmount, departmentName, balance, description } = params;
  const typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1).toLowerCase();
  const isCredit  = transactionType.toUpperCase() === 'INCOME' || transactionType.toUpperCase() === 'CREDIT';
  const cardColor: CardColor = isCredit ? 'credit' : 'debit';
  const cardSign  = isCredit ? '+' : '-';

  const content = `
    ${heading(
      'Transaction Update',
      'Transaction Approved',
      `Great news, ${userName} — your transaction has been approved.`,
    )}
    ${pill('Approved', 'green')}
    ${amountCard(currency, amount, cardColor, `${typeLabel} Amount`, cardSign)}
    ${dataTable([
      ['Description',         description || '—'],
      ['Department',          departmentName],
      ...(chargeAmount ? [['Transaction charge', `${currency}${chargeAmount}`] as [string, string]] : []),
    ])}
    ${balanceCallout(currency, balance)}`;

  return {
    subject: `Transaction approved — ${currency}${amount}`,
    html: emailLayout(content, {
      preheader: `Your ${typeLabel.toLowerCase()} of ${currency}${amount} has been approved. New balance: ${currency}${balance}.`,
    }),
  };
}

// ─── 5. Transaction Declined ──────────────────────────────────────────────────

interface TransactionDeclinedEmailParams {
  userName: string;
  transactionType: string;
  currency: string;
  amount: string;
  reason?: string;
  description?: string;
}

export function generateTransactionDeclinedEmail(
  params: TransactionDeclinedEmailParams,
): { subject: string; html: string } {
  const { userName, transactionType, currency, amount, reason, description } = params;
  const typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1).toLowerCase();

  const content = `
    ${heading(
      'Transaction Update',
      'Transaction Declined',
      `Hi ${userName}, unfortunately your transaction was not approved.`,
    )}
    ${pill('Declined', 'red')}
    ${amountCard(currency, amount, 'neutral', `${typeLabel} Amount`)}
    ${dataTable([
      ['Description', description || '—'],
      ['Type',        typeLabel],
    ])}
    ${reason
      ? infoBox(`<strong>Reason:</strong> ${reason}`, 'red')
      : infoBox('No reason was provided. Please contact the approving administrator for details.', 'amber')}
    <p style="margin-top:20px;">If you believe this is an error, please contact the office and quote the details above.</p>`;

  return {
    subject: `Transaction declined — ${currency}${amount}`,
    html: emailLayout(content, {
      preheader: `Your ${typeLabel.toLowerCase()} of ${currency}${amount} has been declined.${reason ? ' Reason: ' + reason : ''}`,
    }),
  };
}

// ─── 6. Transaction Charge Notification ──────────────────────────────────────

interface TransactionChargeEmailParams {
  recipientName: string;
  currency: string;
  chargeAmount: string;
  departmentName: string;
  transactionRef: string;
  description: string;
}

export function generateTransactionChargeEmail(
  params: TransactionChargeEmailParams,
): { subject: string; html: string } {
  const { recipientName, currency, chargeAmount, departmentName, transactionRef, description } = params;

  const content = `
    ${heading(
      'Charge Notice',
      'Transaction Charge Applied',
      `Hi ${recipientName}, a charge has been applied to your department account.`,
    )}
    ${amountCard(currency, chargeAmount, 'amber', 'Charge Amount', '-', `Department: ${departmentName}`)}
    ${dataTable([
      ['Department',            departmentName],
      ['Reference',             transactionRef],
      ['Original transaction',  description],
    ])}
    ${infoBox('This charge is automatically applied as part of the transaction processing. Contact the office if you have questions.', 'amber')}`;

  return {
    subject: `Charge notice — ${currency}${chargeAmount} deducted`,
    html: emailLayout(content, {
      preheader: `A transaction charge of ${currency}${chargeAmount} has been applied to ${departmentName}.`,
    }),
  };
}

// ─── 7. Pending Approval Request ─────────────────────────────────────────────

interface PendingApprovalEmailParams {
  adminName: string;
  submittedBy: string;
  transactionType: string;
  currency: string;
  amount: string;
  description: string;
  departmentName?: string;
}

export function generatePendingApprovalEmail(
  params: PendingApprovalEmailParams,
): { subject: string; html: string } {
  const { adminName, submittedBy, transactionType, currency, amount, description, departmentName } = params;
  const typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1).toLowerCase();

  const content = `
    ${heading(
      'Action Required',
      'A transaction needs your approval',
      `Hi ${adminName}, a new ${typeLabel.toLowerCase()} transaction is waiting for your review.`,
    )}
    ${amountCard(currency, amount, 'amber', `${typeLabel} — Pending Approval`)}
    ${dataTable([
      ['Submitted by',  submittedBy],
      ['Description',   description],
      ...(departmentName ? [['Department', departmentName] as [string, string]] : []),
    ])}
    ${infoBox('Please log in to CI&#8209;OFFICE to approve or decline this transaction.', 'amber')}`;

  return {
    subject: `Approval needed — ${currency}${amount} ${typeLabel}`,
    html: emailLayout(content, {
      preheader: `${submittedBy} submitted a ${typeLabel.toLowerCase()} of ${currency}${amount} that needs your approval.`,
    }),
  };
}

// ─── 8. Credit Alert ─────────────────────────────────────────────────────────

interface CreditAlertEmailParams {
  recipientName: string;
  currency: string;
  amount: string;
  departmentName: string;
  description: string;
  balance: string;
}

export function generateCreditAlertEmail(
  params: CreditAlertEmailParams,
): { subject: string; html: string } {
  const { recipientName, currency, amount, departmentName, description, balance } = params;

  const content = `
    ${heading(
      'Credit Alert',
      `${currency}${amount} credited`,
      `Hi ${recipientName}, your department account has been credited.`,
    )}
    ${amountCard(currency, amount, 'credit', 'Amount Credited', '+')}
    ${dataTable([
      ['Department',  departmentName],
      ['Description', description],
    ])}
    ${balanceCallout(currency, balance)}`;

  return {
    subject: `Credit alert — +${currency}${amount} to ${departmentName}`,
    html: emailLayout(content, {
      preheader: `${currency}${amount} has been credited to ${departmentName}. New balance: ${currency}${balance}.`,
    }),
  };
}

// ─── 9. Debit Alert ───────────────────────────────────────────────────────────

interface DebitAlertEmailParams {
  recipientName: string;
  currency: string;
  amount: string;
  departmentName: string;
  description: string;
  balance: string;
}

export function generateDebitAlertEmail(
  params: DebitAlertEmailParams,
): { subject: string; html: string } {
  const { recipientName, currency, amount, departmentName, description, balance } = params;

  const content = `
    ${heading(
      'Debit Alert',
      `${currency}${amount} debited`,
      `Hi ${recipientName}, a debit has been recorded against your department account.`,
    )}
    ${amountCard(currency, amount, 'debit', 'Amount Debited', '-')}
    ${dataTable([
      ['Department',  departmentName],
      ['Description', description],
    ])}
    ${balanceCallout(currency, balance)}`;

  return {
    subject: `Debit alert — -${currency}${amount} from ${departmentName}`,
    html: emailLayout(content, {
      preheader: `${currency}${amount} has been debited from ${departmentName}. New balance: ${currency}${balance}.`,
    }),
  };
}

// ─── 10. Transaction Edit Notification ───────────────────────────────────────

interface TransactionEditEmailParams {
  recipientName: string;
  departmentName: string;
  description: string;
  changes: string;
  editedBy: string;
}

export function generateTransactionEditEmail(
  params: TransactionEditEmailParams,
): { subject: string; html: string } {
  const { recipientName, departmentName, description, changes, editedBy } = params;

  const content = `
    ${heading(
      'Transaction Modified',
      'A transaction was edited',
      `Hi ${recipientName}, a transaction in your department has been updated.`,
    )}
    ${dataTable([
      ['Department',  departmentName],
      ['Transaction', description],
      ['Changes',     changes],
      ['Edited by',   editedBy],
    ])}
    ${infoBox('If you didn&rsquo;t expect this change or believe it&rsquo;s incorrect, please contact a system administrator right away.', 'blue')}`;

  return {
    subject: `Transaction edited in ${departmentName}`,
    html: emailLayout(content, {
      preheader: `A transaction in ${departmentName} was edited by ${editedBy}: ${changes}`,
    }),
  };
}

// ─── 11. Correction Notification ─────────────────────────────────────────────

interface CorrectionEmailParams {
  recipientName: string;
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

export function generateCorrectionEmail(
  params: CorrectionEmailParams,
): { subject: string; html: string } {
  const {
    recipientName, transactionType, departmentName, currency,
    originalAmount, newAmount, correctionType, adjustmentAmount, reason, balance,
  } = params;
  const typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1).toLowerCase();
  const isIncrease = parseFloat(newAmount) > parseFloat(originalAmount);
  const adjColor: CardColor = isIncrease ? 'credit' : 'debit';
  const adjSign = isIncrease ? '+' : '-';

  const content = `
    ${heading(
      'Correction Applied',
      'Transaction correction recorded',
      `Hi ${recipientName}, an amount correction has been made to a ${typeLabel.toLowerCase()} in your department.`,
    )}
    ${amountCard(currency, adjustmentAmount, adjColor, `${correctionType} Adjustment`, adjSign)}
    ${dataTable([
      ['Department',      departmentName],
      ['Transaction',     typeLabel],
      ['Original amount', `${currency}${originalAmount}`],
      ['Corrected amount',`${currency}${newAmount}`],
      ['Reason',          reason],
    ])}
    ${balanceCallout(currency, balance)}`;

  return {
    subject: `Transaction correction in ${departmentName}`,
    html: emailLayout(content, {
      preheader: `A ${typeLabel.toLowerCase()} in ${departmentName} has been corrected from ${currency}${originalAmount} to ${currency}${newAmount}.`,
    }),
  };
}

// ─── 12. Department Transfer Notification ────────────────────────────────────

interface DepartmentTransferEmailParams {
  recipientName: string;
  transactionType: string;
  currency: string;
  amount: string;
  fromDepartment: string;
  toDepartment: string;
  reason: string;
  balance: string;
}

export function generateDepartmentTransferEmail(
  params: DepartmentTransferEmailParams,
): { subject: string; html: string } {
  const { recipientName, transactionType, currency, amount, fromDepartment, toDepartment, reason, balance } = params;
  const typeLabel = transactionType.charAt(0).toUpperCase() + transactionType.slice(1).toLowerCase();

  const content = `
    ${heading(
      'Department Transfer',
      'Transaction moved between departments',
      `Hi ${recipientName}, a ${typeLabel.toLowerCase()} transaction has been transferred.`,
    )}
    ${amountCard(currency, amount, 'neutral', `${typeLabel} Transfer Amount`)}
    ${transferVisual(fromDepartment, toDepartment)}
    ${dataTable([
      ['Reason', reason],
    ])}
    ${balanceCallout(currency, balance)}`;

  return {
    subject: `Department transfer — ${currency}${amount} ${typeLabel}`,
    html: emailLayout(content, {
      preheader: `A ${typeLabel.toLowerCase()} of ${currency}${amount} has been transferred from ${fromDepartment} to ${toDepartment}.`,
    }),
  };
}

// ─── 13. General Notification ─────────────────────────────────────────────────

interface GeneralNotificationEmailParams {
  recipientName: string;
  title: string;
  message: string;
}

export function generateGeneralNotificationEmail(
  params: GeneralNotificationEmailParams,
): { subject: string; html: string } {
  const { recipientName, title, message } = params;

  const content = `
    ${heading('Notification', title, `Hi ${recipientName}, you have a new message from CI&#8209;OFFICE.`)}
    ${infoBox(message, 'blue')}`;

  return {
    subject: title,
    html: emailLayout(content, {
      preheader: message.replace(/<[^>]*>/g, '').slice(0, 90),
    }),
  };
}
