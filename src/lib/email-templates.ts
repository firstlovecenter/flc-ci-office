/**
 * Auth and access-change email templates — password reset, first login setup,
 * and losing access to an account when it is closed.
 * Transaction / report emails are intentionally not restored.
 */
import { emailLayout } from './email';
import { formatRoleLabel } from '@/lib/org-model';

type PillColor = 'green' | 'red' | 'blue' | 'amber' | 'slate';
type BtnStyle = 'primary' | 'success' | 'amber';
type BoxColor = 'blue' | 'green' | 'red' | 'amber';

function pill(text: string, color: PillColor): string {
  return `<span class="pill pill-${color}">${text}</span>`;
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

function divider(): string {
  return `<div class="div"></div>`;
}

interface PasswordResetEmailParams {
  userName?: string;
  resetCode: string;
  resetUrl?: string;
  expirationHours?: number;
  otpExpirationMinutes?: number;
}

export function generatePasswordResetEmail(
  params: PasswordResetEmailParams,
): { subject: string; html: string } {
  const { userName, resetCode, resetUrl, expirationHours = 12, otpExpirationMinutes = 15 } = params;
  const name = userName || 'there';

  const content = `
    ${heading(
      'Security',
      'Password Reset Requested',
      `Hi ${name}, we received a request to reset your password.`,
    )}
    ${otpBlock(resetCode)}
    ${resetUrl ? ctaButton('Reset My Password', resetUrl) : ''}
    ${divider()}
    <p class="helper">
      This code expires in <strong>${otpExpirationMinutes} minute${otpExpirationMinutes !== 1 ? 's' : ''}</strong>.
      ${resetUrl ? `The reset link expires in <strong>${expirationHours} hour${expirationHours !== 1 ? 's' : ''}</strong>.` : ''}
      If you didn&rsquo;t request a password reset, no action is needed &mdash; your account remains secure.
    </p>`;

  return {
    subject: 'Your password reset code',
    html: emailLayout(content, {
      preheader: `Your password reset code is ${resetCode}. Code expires in ${otpExpirationMinutes} minutes.`,
    }),
  };
}

interface FirstRoleAssignmentEmailParams {
  userName: string;
  role: string;
  organisation: string;
  resetLink: string;
}

export function generateFirstRoleAssignmentEmail(
  params: FirstRoleAssignmentEmailParams,
): { subject: string; html: string } {
  const { userName, role, organisation, resetLink } = params;
  const roleDisplay = formatRoleLabel(role);

  const content = `
    ${heading(
      'Welcome',
      `Hi ${userName}, you&rsquo;re in!`,
      'You&rsquo;ve been given access to CI&#8209;OFFICE. Set up your password to get started.',
    )}
    ${dataTable([
      ['Full name', userName],
      ['Role', `${pill(roleDisplay, 'blue')}`],
      ['Church', organisation],
    ])}
    ${infoBox('This is your first time signing in. Please set a strong password to secure your account.', 'blue')}
    ${ctaButton('Set Up My Password', resetLink, 'success')}
    ${divider()}
    <p class="helper">
      This link expires in <strong>7 days</strong>. If you didn&rsquo;t expect this invitation, please
      contact your administrator immediately.
    </p>`;

  return {
    subject: 'Welcome to CI-OFFICE — set up your password',
    html: emailLayout(content, {
      preheader: `Hi ${userName}, you've been added to CI-OFFICE as ${roleDisplay}. Set your password to get started.`,
    }),
  };
}

interface AccountClosureEmailParams {
  userName: string;
  accountName: string;
  campusName?: string | null;
  /** Where the money went, from `closureFundsSummary`. */
  fundsSummary: string;
  reason?: string | null;
  closedOn: Date;
  role?: string | null;
}

/**
 * Sent to everyone who held a role on an account at the moment it was closed.
 *
 * An access change, not a transaction notice: the recipient can no longer reach
 * the account, and the balance they were responsible for has been moved out.
 * Both facts are stated plainly, because the first thing someone does on losing
 * access is ask where the money went.
 */
export function generateAccountClosureEmail(
  params: AccountClosureEmailParams,
): { subject: string; html: string } {
  const { userName, accountName, campusName, fundsSummary, reason, closedOn, role } = params;

  const closedOnLabel = closedOn.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const content = `
    ${heading(
      'Account closed',
      `Hi ${userName}, the ${accountName} account has been closed`,
      'This is a record of what happened to the account and to the money that was in it.',
    )}
    ${dataTable([
      ['Account', accountName],
      ...(campusName ? [['Campus', campusName] as [string, string]] : []),
      ...(role ? [['Your role', pill(formatRoleLabel(role), 'slate')] as [string, string]] : []),
      ['Closed on', closedOnLabel],
      ['Remaining balance', fundsSummary],
      ...(reason?.trim() ? [['Reason', reason.trim()] as [string, string]] : []),
    ])}
    ${infoBox('Your access to this account has been removed. Transactions already recorded on it are kept for the records and remain auditable.', 'amber')}
    ${divider()}
    <p class="helper">
      If you believe this account was closed in error, contact your oversight manager
      &mdash; reopening a closed account is done at oversight or HQ level.
    </p>`;

  return {
    subject: `Account closed — ${accountName}`,
    html: emailLayout(content, {
      preheader: `${accountName} has been closed. ${fundsSummary}.`,
    }),
  };
}
