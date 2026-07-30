/**
 * User-facing vocabulary. One name per concept.
 *
 * The same transaction was previously described five ways depending on where
 * you stood — Deposit/Withdrawal in the filter, Credit/Debit in the table,
 * Inflows/Expenses on the dashboard, and the raw INCOME/EXPENSE enum in the
 * approvals queue. Status was worse: the filter said "Declined", the badge
 * rendered "REJECTED", and the button said "Reject".
 *
 * Rules:
 *   - Deposit / Withdrawal is what users do, so that is the default.
 *   - Credit / Debit appear ONLY in the statement table, where accounting
 *     convention applies and the column position carries the meaning.
 *   - Raw enum values are never rendered.
 */

export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/** Default user-facing name for a transaction type. */
export function transactionTypeLabel(type: TransactionType | string): string {
    return type === 'INCOME' ? 'Deposit' : type === 'EXPENSE' ? 'Withdrawal' : String(type);
}

/** Accounting-column name. Statement and ledger tables only. */
export function transactionColumnLabel(type: TransactionType | string): string {
    return type === 'INCOME' ? 'Credit' : type === 'EXPENSE' ? 'Debit' : String(type);
}

/** Aggregate labels for summary tiles. */
export const TOTALS_IN_LABEL = 'Total deposits';
export const TOTALS_OUT_LABEL = 'Total withdrawals';
export const BALANCE_LABEL = 'Account balance';

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Declined',
};

/** Never render the raw enum — "REJECTED" reads as shouting and mismatches the filter. */
export function transactionStatusLabel(status: TransactionStatus | string): string {
    return STATUS_LABELS[status] ?? String(status);
}

/** The verb for acting on a pending request, matching the status wording. */
export function decisionLabel(decision: 'approve' | 'reject'): string {
    return decision === 'approve' ? 'Approve' : 'Decline';
}

const ROLE_LABELS: Record<string, string> = {
    SUPERADMIN: 'System administrator',
    DENOMINATION_ADMIN: 'HQ manager',
    DENOMINATION_LEADER: 'HQ leader',
    OVERSIGHT_ADMIN: 'Oversight manager',
    OVERSIGHT_LEADER: 'Oversight leader',
    CAMPUS_ADMIN: 'Campus manager',
    CAMPUS_LEADER: 'Campus leader',
    STREAM_ADMIN: 'Stream manager',
    STREAM_LEADER: 'Stream leader',
    COUNCIL_ADMIN: 'Account manager',
    COUNCIL_LEADER: 'Account holder',
};

/**
 * Human name for a role. "Manager" for admins and "Leader" for leaders —
 * the two words already used in the churches list, rather than the DB's ADMIN.
 */
export function roleLabel(role: string | null | undefined): string {
    if (!role) return '';
    return ROLE_LABELS[role.toUpperCase()] ?? role;
}
